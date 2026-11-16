import { Router } from "express";
import { pool } from "../db.js";
import { requireRole } from "../middleware/authorize.js";

// SCRUM-40: Managers add employees and assign their roles.
// An employee gets access by signing in with Google using the email saved here
// (see linkEmployeeAccount below, called from routes/auth.js).
//
// Roles: manager, cashier, kitchen, or inactive (no access). Employees are never
// deleted because past orders and sales reference them; set them to inactive.
const router = Router();

export const ROLES = ["manager", "cashier", "kitchen", "inactive"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fields = `
  e.employee_id, e.employee_name, e.role, e.email, e.account_id,
  a.last_login
`;

function toEmployee(row) {
  return {
    id: Number(row.employee_id),
    name: row.employee_name,
    role: row.role,
    email: row.email,
    // true once this employee has signed in with their Google account
    linked: row.account_id != null,
    lastLogin: row.last_login ? new Date(row.last_login).getTime() : null,
  };
}

function invalid(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Validates name/role/email. Missing fields are allowed when `partial` (for edits).
function readFields(body, { partial }) {
  const result = {};
  const { name, role, email } = body || {};

  if (name !== undefined || !partial) {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      throw invalid("Enter a name under 100 characters");
    }
    result.name = name.trim();
  }
  if (role !== undefined || !partial) {
    if (!ROLES.includes(role)) throw invalid("Choose a valid role");
    result.role = role;
  }
  if (email !== undefined) {
    if (email === null || email === "") {
      result.email = null;
    } else if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim()) || email.length > 254) {
      throw invalid("Enter a valid email address");
    } else {
      // Store emails lowercase so sign-in matching isn't case-sensitive.
      result.email = email.trim().toLowerCase();
    }
  }
  return result;
}

async function findEmployee(client, id) {
  const result = await client.query(
    `SELECT ${fields}
     FROM employee e
     LEFT JOIN user_accounts a ON a.account_id = e.account_id
     WHERE e.employee_id = $1`,
    [id]
  );
  return result.rows[0] ? toEmployee(result.rows[0]) : null;
}

// Links a signed-in Google account to the employee with the same email, if that
// employee isn't linked yet. Returns true when a link was made.
export async function linkEmployeeAccount(accountId, email, client = pool) {
  if (!accountId || !email) return false;
  const result = await client.query(
    `UPDATE employee
     SET account_id = $1
     WHERE LOWER(email) = LOWER($2)
       AND account_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM employee WHERE account_id = $1)`,
    [accountId, email]
  );
  return result.rowCount > 0;
}

// If someone with this email already signed in before being added, link them now.
async function linkExistingAccount(client, employeeId, email) {
  if (!email) return;
  const account = await client.query(
    "SELECT account_id FROM user_accounts WHERE LOWER(google_email) = LOWER($1)",
    [email]
  );
  if (!account.rowCount) return;
  await client.query(
    `UPDATE employee SET account_id = $1
     WHERE employee_id = $2
       AND NOT EXISTS (SELECT 1 FROM employee WHERE account_id = $1)`,
    [account.rows[0].account_id, employeeId]
  );
}

function sendError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  // 23505 = unique violation on employee.email
  if (error.code === "23505") {
    return res.status(409).json({ error: "Another employee already uses that email" });
  }
  console.error(fallback, error.message);
  res.status(500).json({ error: fallback });
}

// GET /api/employees - every employee with their role and sign-in status
router.get("/", requireRole("manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${fields}
       FROM employee e
       LEFT JOIN user_accounts a ON a.account_id = e.account_id
       ORDER BY (e.role = 'inactive'), e.employee_name`
    );
    res.json({ employees: result.rows.map(toEmployee), roles: ROLES });
  } catch (error) {
    sendError(res, error, "Unable to retrieve employees");
  }
});

// POST /api/employees { name, role, email }
router.post("/", requireRole("manager"), async (req, res) => {
  let client;
  try {
    const { name, role, email = null } = readFields(req.body, { partial: false });
    client = await pool.connect();
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO employee (employee_name, role, email)
       VALUES ($1, $2, $3)
       RETURNING employee_id`,
      [name, role, email]
    );
    const id = inserted.rows[0].employee_id;
    await linkExistingAccount(client, id, email);
    const employee = await findEmployee(client, id);
    await client.query("COMMIT");
    res.status(201).json({ employee });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    sendError(res, error, "Unable to add employee");
  } finally {
    if (client) client.release();
  }
});

// PATCH /api/employees/:id { name?, role?, email? }
router.patch("/:id", requireRole("manager"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid employee ID" });
  }

  let client;
  try {
    const changes = readFields(req.body, { partial: true });
    if (Object.keys(changes).length === 0) throw invalid("Nothing to update");

    // Stop a manager from locking themselves out of the manager view.
    if (id === req.employee.employee_id && changes.role && changes.role !== "manager") {
      throw invalid("You can't remove your own manager access. Ask another manager to change it.");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const current = await findEmployee(client, id);
    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Employee not found" });
    }

    const emailChanged = "email" in changes && changes.email !== current.email;
    await client.query(
      `UPDATE employee
       SET employee_name = COALESCE($1, employee_name),
           role = COALESCE($2, role),
           email = CASE WHEN $3 THEN $4 ELSE email END,
           -- a new email means a different Google account, so unlink the old one
           account_id = CASE WHEN $3 THEN NULL ELSE account_id END
       WHERE employee_id = $5`,
      [changes.name ?? null, changes.role ?? null, emailChanged, changes.email ?? null, id]
    );
    if (emailChanged) await linkExistingAccount(client, id, changes.email);

    const employee = await findEmployee(client, id);
    await client.query("COMMIT");
    res.json({ employee });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    sendError(res, error, "Unable to update employee");
  } finally {
    if (client) client.release();
  }
});

export default router;
