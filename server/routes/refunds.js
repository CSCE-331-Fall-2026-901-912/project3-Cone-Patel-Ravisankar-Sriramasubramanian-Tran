import { Router } from "express";
import { readFileSync } from "node:fs";
import { pool } from "../db.js";
import { requireRole } from "../middleware/authorize.js";

// SCRUM-41: Manager order cancellation and refund workflow.
//
// - A cancellation is for an order that hasn't been made yet: the full amount is
//   refunded and the order disappears from the kitchen queue.
// - A refund is for an order that was already made: the manager refunds the full
//   amount or part of it (e.g. a wrong topping).
//
// Each database order can be cancelled or refunded once. Refunds are stored in
// their own table (server/sql/order_refund.sql) so sales history is never edited.
const router = Router();

const TYPES = ["cancellation", "refund"];
const MAX_REASON_LENGTH = 300;

const createTableSql = readFileSync(new URL("../sql/order_refund.sql", import.meta.url), "utf8");

// Create the table on startup if it doesn't exist yet.
export async function ensureRefundTable() {
  await pool.query(createTableSql);
}

const fields = `
  r.refund_id, r.order_id, r.refund_type, r.amount, r.reason,
  r.employee_id, e.employee_name, r.created_at
`;

function toRefund(row) {
  return {
    id: Number(row.refund_id),
    orderId: Number(row.order_id),
    type: row.refund_type,
    amount: Number(row.amount),
    reason: row.reason,
    employeeId: row.employee_id,
    employee: row.employee_name || null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Used by the orders feed (routes/pos.js) to attach refund info to each order.
export async function getRefundsForOrders(orderIds) {
  if (orderIds.length === 0) return new Map();
  const result = await pool.query(
    `SELECT ${fields}
     FROM order_refund r
     LEFT JOIN employee e ON e.employee_id = r.employee_id
     WHERE r.order_id = ANY($1::int[])`,
    [orderIds]
  );
  return new Map(result.rows.map((row) => [Number(row.order_id), toRefund(row)]));
}

// GET /api/refunds - recent cancellations and refunds (newest first)
router.get("/", requireRole("manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${fields}
       FROM order_refund r
       LEFT JOIN employee e ON e.employee_id = r.employee_id
       ORDER BY r.created_at DESC
       LIMIT 200`
    );
    res.json({ refunds: result.rows.map(toRefund) });
  } catch (error) {
    console.error("Failed to fetch refunds:", error.message);
    res.status(500).json({ error: "Unable to retrieve refunds" });
  }
});

// POST /api/refunds { orderId, type, amount?, reason }
router.post("/", requireRole("manager"), async (req, res) => {
  const { orderId, type, amount, reason } = req.body || {};
  const id = Number(orderId);

  if (!Number.isSafeInteger(id) || id <= 0 || !TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid order or refund type" });
  }
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > MAX_REASON_LENGTH) {
    return res.status(400).json({ error: `Enter a reason under ${MAX_REASON_LENGTH} characters` });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Lock the order's sale rows so two managers can't refund the same order at once.
    const sale = await client.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS paid, COUNT(*) AS sales
       FROM (SELECT total_amount FROM sale WHERE order_id = $1 FOR UPDATE) s`,
      [id]
    );
    if (Number(sale.rows[0].sales) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    const existing = await client.query("SELECT 1 FROM order_refund WHERE order_id = $1", [id]);
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This order has already been cancelled or refunded" });
    }

    const paidCents = Math.round(Number(sale.rows[0].paid) * 100);
    // Cancellations always refund everything; refunds can be partial.
    const refundCents = type === "cancellation" ? paidCents : Math.round(Number(amount) * 100);

    if (!Number.isSafeInteger(refundCents) || refundCents <= 0 || refundCents > paidCents) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Refund amount must be between $0.01 and $${(paidCents / 100).toFixed(2)}`,
      });
    }

    const inserted = await client.query(
      `INSERT INTO order_refund (order_id, refund_type, amount, reason, employee_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING refund_id`,
      [id, type, (refundCents / 100).toFixed(2), reason.trim(), req.employee?.employee_id ?? null]
    );

    const saved = await client.query(
      `SELECT ${fields}
       FROM order_refund r
       LEFT JOIN employee e ON e.employee_id = r.employee_id
       WHERE r.refund_id = $1`,
      [inserted.rows[0].refund_id]
    );

    await client.query("COMMIT");
    res.status(201).json({ refund: toRefund(saved.rows[0]) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    // 23505 = unique violation: someone refunded this order a moment ago.
    if (error.code === "23505") {
      return res.status(409).json({ error: "This order has already been cancelled or refunded" });
    }
    console.error("Refund failed:", error.message);
    res.status(500).json({ error: "Unable to process the refund" });
  } finally {
    if (client) client.release();
  }
});

export default router;
