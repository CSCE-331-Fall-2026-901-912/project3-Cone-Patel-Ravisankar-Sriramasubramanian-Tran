import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

//GET /api/shifts/employees - real employees for the cashier dropdown
router.get("/employees", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT employee_id, employee_name, role FROM employee ORDER BY employee_name"
    );
    res.json({ employees: result.rows });
  } catch (error) {
    console.error("Failed to fetch employees:", error.message);
    res.status(500).json({ error: "Unable to retrieve employees" });
  }
});

//GET /api/shifts/status/:employeeId - the employee's open shift, or null
router.get("/status/:employeeId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employee_shift WHERE employee_id = $1 AND clock_out IS NULL",
      [req.params.employeeId]
    );
    res.json({ shift: result.rows[0] ?? null });
  } catch (error) {
    console.error("Failed to load shift status:", error.message);
    res.status(500).json({ error: "Unable to load shift status" });
  }
});

//POST /api/shifts/clock-in {employeeId}
router.post("/clock-in", async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  try {
    const open = await pool.query(
      "SELECT 1 FROM employee_shift WHERE employee_id = $1 AND clock_out IS NULL",
      [employeeId]
    );
    if (open.rowCount > 0) return res.status(409).json({ error: "Already clocked in" });

    const result = await pool.query(
      "INSERT INTO employee_shift (employee_id) VALUES ($1) RETURNING *",
      [employeeId]
    );
    res.status(201).json({ shift: result.rows[0] });
  } catch (error) {
    console.error("Clock-in failed:", error.message);
    res.status(500).json({ error: "Unable to clock in" });
  }
});

//POST /api/shifts/clock-out {employeeId}
router.post("/clock-out", async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  try {
    const result = await pool.query(
      `UPDATE employee_shift SET clock_out = NOW()
       WHERE employee_id = $1 AND clock_out IS NULL RETURNING *`,
      [employeeId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not clocked in" });
    res.json({ shift: result.rows[0] });
  } catch (error) {
    console.error("Clock-out failed:", error.message);
    res.status(500).json({ error: "Unable to clock out" });
  }
});

//GET /api/shifts - latest 50 shifts with hours worked (manager report)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.shift_id, s.employee_id, e.employee_name, s.clock_in, s.clock_out,
             EXTRACT(EPOCH FROM (COALESCE(s.clock_out, NOW()) - s.clock_in)) / 3600 AS hours
      FROM employee_shift s
      JOIN employee e ON e.employee_id = s.employee_id
      ORDER BY s.clock_in DESC
      LIMIT 50
    `);
    res.json({ shifts: result.rows });
  } catch (error) {
    console.error("Failed to fetch shifts:", error.message);
    res.status(500).json({ error: "Unable to retrieve shifts" });
  }
});

export default router;