
import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// SCRUM-54: Retrieve the latest 20 orders for the kitchen
router.get("/", async (req, res) => {
  try {
    const result = await pool.query({
      text: `
        SELECT
          o.order_id,
          o.employee_id,
          o.menu_id,
          m.item_name,
          o.quantity,
          o.size,
          o.sugar_level,
          o.ice_level,
          o.toppings,
          s.sale_time
        FROM (
          SELECT *
          FROM orders
          ORDER BY order_id DESC
          LIMIT 20
        ) AS o
        JOIN menu AS m ON o.menu_id = m.menu_id
        LEFT JOIN LATERAL (
          SELECT sale_time
          FROM sale
          WHERE order_id = o.order_id
          ORDER BY sale_time DESC NULLS LAST
          LIMIT 1
        ) AS s ON true
        ORDER BY o.order_id DESC
      `,
      query_timeout: 10000
    });

    res.json({ orders: result.rows });
  } catch (error) {
    console.error("Failed to fetch orders:", error.message);
    res.status(500).json({
      error: "Unable to retrieve orders"
    });
  }
});

export default router;
