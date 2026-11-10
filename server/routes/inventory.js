
import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

const fields = `
  inventory_id,
  item_name,
  item_type,
  quantity_on_hand,
  unit,
  minimum_quantity
`;

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

function validQuantity(value) {
  return (
    (typeof value === "number" || typeof value === "string") &&
    value !== "" &&
    value !== null &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    /^\d+(\.\d{1,2})?$/.test(String(value))
  );
}

function validateItem(body) {
  const { item_name, item_type, quantity_on_hand, unit, minimum_quantity } = body;

  if (
    typeof item_name !== "string" || !item_name.trim() ||
    typeof item_type !== "string" || !item_type.trim() ||
    typeof unit !== "string" || !unit.trim() ||
    !validQuantity(quantity_on_hand) ||
    (minimum_quantity != null && !validQuantity(minimum_quantity))
  ) {
    return false;
  }

  return true;
}

// GET all inventory items
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${fields}
      FROM inventory
      ORDER BY inventory_id
    `);

    res.json({ items: result.rows });
  } catch (error) {
    console.error("Failed to fetch inventory:", error.message);
    res.status(500).json({ error: "Unable to retrieve inventory" });
  }
});

// GET low-stock items
router.get("/low-stock", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${fields}
      FROM inventory
      WHERE minimum_quantity IS NOT NULL
        AND quantity_on_hand < minimum_quantity
      ORDER BY inventory_id
    `);

    res.json({ items: result.rows });
  } catch (error) {
    console.error("Failed to fetch low-stock inventory:", error.message);
    res.status(500).json({ error: "Unable to retrieve low-stock inventory" });
  }
});

// GET one inventory item
router.get("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid inventory ID" });
  }

  try {
    const result = await pool.query(
      `SELECT ${fields} FROM inventory WHERE inventory_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error("Failed to fetch inventory item:", error.message);
    res.status(500).json({ error: "Unable to retrieve inventory item" });
  }
});

// POST new inventory item
router.post("/", async (req, res) => {
  if (!validateItem(req.body)) {
    return res.status(400).json({ error: "Invalid inventory item data" });
  }

  const { item_name, item_type, quantity_on_hand, unit, minimum_quantity } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO inventory
        (item_name, item_type, quantity_on_hand, unit, minimum_quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${fields}`,
      [
        item_name.trim(),
        item_type.trim(),
        quantity_on_hand,
        unit.trim(),
        minimum_quantity ?? null
      ]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error("Failed to create inventory item:", error.message);
    res.status(500).json({ error: "Unable to create inventory item" });
  }
});

// PUT existing inventory item
router.put("/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid inventory ID" });
  }

  if (!validateItem(req.body)) {
    return res.status(400).json({ error: "Invalid inventory item data" });
  }

  const { item_name, item_type, quantity_on_hand, unit, minimum_quantity } = req.body;

  try {
    const result = await pool.query(
      `UPDATE inventory
       SET item_name = $1,
           item_type = $2,
           quantity_on_hand = $3,
           unit = $4,
           minimum_quantity = $5
       WHERE inventory_id = $6
       RETURNING ${fields}`,
      [
        item_name.trim(),
        item_type.trim(),
        quantity_on_hand,
        unit.trim(),
        minimum_quantity ?? null,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error("Failed to update inventory item:", error.message);
    res.status(500).json({ error: "Unable to update inventory item" });
  }
});

export default router;
