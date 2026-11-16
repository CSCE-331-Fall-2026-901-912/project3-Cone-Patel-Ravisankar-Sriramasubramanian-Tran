import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/authorize.js';
import { getRefundsForOrders } from './refunds.js';

// This adapter uses the team's EXISTING menu, orders and sale tables.
// Database limitations: every cart line becomes its own orders/sale pair;
// source, payment method, checkout group and kitchen status have no columns.
const router = Router();

// SCRUM-40: Kiosk orders need no login. Cashier orders need a cashier or
// manager login, and kitchen status changes need kitchen or manager.
const requireCashier = requireRole('cashier', 'manager');
const requireKitchen = requireRole('kitchen', 'manager');
function requireCashierForCashierOrders(req, res, next) {
  if (req.body?.source === 'Cashier') return requireCashier(req, res, next);
  next();
}
const TAX_RATE = 0.0825;
const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const dollars = (value) => (value / 100).toFixed(2);
const TOPPING_PRICES = new Map([
  ['Boba', 75], ['Lychee Jelly', 75], ['Pudding', 75],
  ['Cheese Foam', 100], ['Red Bean', 75],
]);

// Kitchen status can only be temporary until the existing schema has a status
// column (or a team-approved related table). This cache resets on server restart.
const temporaryStatuses = new Map();

function invalid(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseToppings(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((entry) =>
      typeof entry === 'string'
        ? { name: entry, price: (TOPPING_PRICES.get(entry) ?? 0) / 100 }
        : { name: entry.name, price: Number(entry.price || 0) }
    );
  } catch { /* Legacy records may store a plain-text topping list. */ }
  return String(value).split(',').map((name) => name.trim()).filter(Boolean)
    .map((name) => ({ name, price: (TOPPING_PRICES.get(name) ?? 0) / 100 }));
}

function mapOrder(row, refunds = new Map()) {
  const statusInfo = temporaryStatuses.get(Number(row.order_id)) || {};
  const refund = refunds.get(Number(row.order_id)) || null;
  const basePrice = Number(row.price);
  const size = row.size || 'Regular';
  const extra = size === 'Large' ? 0.75 : 0;
  const toppings = parseToppings(row.toppings);
  const qty = Number(row.quantity);
  const subtotal = (basePrice + extra + toppings.reduce((sum, t) => sum + Number(t.price), 0)) * qty;
  // sale.total_amount is authoritative; old rows may not include calculated tax.
  const total = row.total_amount == null ? subtotal : Number(row.total_amount);
  const placedAt = row.sale_time ? new Date(row.sale_time).getTime() : 0;
  return {
    number: Number(row.order_id), source: 'Unknown', employee: row.employee_name || null,
    payment: 'Unknown',
    // A cancelled order leaves the kitchen queue (SCRUM-41).
    status: refund?.type === 'cancellation' ? 'cancelled' : (statusInfo.status || 'new'),
    refund,
    subtotal, tax: Math.max(0, total - subtotal), total, placedAt,
    startedAt: statusInfo.startedAt,
    completedAt: statusInfo.completedAt,
    items: [{
      drinkId: Number(row.menu_id), name: row.item_name, basePrice,
      size: { label: size, extra }, sugar: row.sugar_level || '100%',
      ice: row.ice_level || 'Regular Ice', toppings, quantity: qty,
    }],
  };
}

router.get('/', async (_req, res) => {
  try {
    // Only recent sales belong in the live queue; the original database has
    // a large historical data set. Return a bounded recent window.
    const result = await pool.query({
      text: `
        SELECT o.order_id, o.menu_id, o.quantity, o.size, o.sugar_level,
               o.ice_level, o.toppings, m.item_name, m.price,
               s.sale_time, s.total_amount, e.employee_name
        FROM (
          SELECT DISTINCT ON (order_id) order_id, sale_time, total_amount
          FROM sale
          WHERE sale_time >= CURRENT_TIMESTAMP - INTERVAL '14 days'
            AND order_id IS NOT NULL
          ORDER BY order_id, sale_time DESC NULLS LAST, sale_id DESC
        ) s
        JOIN orders o ON o.order_id = s.order_id
        JOIN menu m ON m.menu_id = o.menu_id
        LEFT JOIN employee e ON e.employee_id = o.employee_id
        ORDER BY s.sale_time DESC, o.order_id DESC LIMIT 500`,
      query_timeout: 10000,
    });
    // Attach cancellations/refunds. If that lookup fails, still return the orders.
    const refunds = await getRefundsForOrders(result.rows.map((row) => Number(row.order_id)))
      .catch((error) => {
        console.error('Refund lookup failed:', error.message);
        return new Map();
      });
    res.json({ orders: result.rows.reverse().map((row) => mapOrder(row, refunds)), limitations: {
      groupedCheckouts: false, persistentKitchenStatus: false,
      sourceAndPaymentStored: false,
    }});
  } catch (error) {
    console.error('Existing-orders retrieval failed:', error);
    res.status(500).json({ error: 'Unable to retrieve orders' });
  }
});

router.post('/', requireCashierForCashierOrders, async (req, res) => {
  const { items, source, payment = 'Card' } = req.body || {};
  if (!['Cashier', 'Kiosk'].includes(source) || !['Cash', 'Card'].includes(payment) ||
      (source === 'Kiosk' && payment !== 'Card') || !Array.isArray(items) ||
      items.length < 1 || items.length > 100) {
    return res.status(400).json({ error: 'Invalid order details' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const newOrderIds = [];
    let subtotalCents = 0;
    let taxCents = 0;

    for (const item of items) {
      const menuId = Number(item.drinkId);
      const quantity = Number(item.quantity);
      const size = item.size?.label;
      const sugar = item.sugar;
      const ice = item.ice;
      const toppings = item.toppings;
      if (!Number.isSafeInteger(menuId) || menuId < 1 ||
          !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 ||
          !['Regular', 'Large'].includes(size) ||
          !['0%', '25%', '50%', '75%', '100%'].includes(sugar) ||
          !['No Ice', 'Less Ice', 'Regular Ice', 'Extra Ice'].includes(ice) ||
          !Array.isArray(toppings) || toppings.length > 10 ||
          toppings.some((t) => typeof t?.name !== 'string')) {
        throw invalid('Invalid order item customization');
      }

      const menuResult = await client.query(
        'SELECT menu_id, price FROM menu WHERE menu_id = $1 AND availability = true',
        [menuId]
      );
      if (!menuResult.rowCount) throw invalid('A menu item is no longer available');
      const names = toppings.map((t) => t.name);
      if (new Set(names).size !== names.length || names.some((n) => !TOPPING_PRICES.has(n))) {
        throw invalid('Invalid toppings');
      }
      const base = cents(menuResult.rows[0].price);
      const extras = (size === 'Large' ? 75 : 0) +
        names.reduce((sum, name) => sum + TOPPING_PRICES.get(name), 0);
      const lineSubtotal = (base + extras) * quantity;
      const lineTax = Math.round(lineSubtotal * TAX_RATE);
      const lineTotal = lineSubtotal + lineTax;
      // sale.total_amount is NUMERIC(8,2).
      if (lineTotal > 99999999) throw invalid('Order amount exceeds database limit');
      subtotalCents += lineSubtotal;
      taxCents += lineTax;

      // employee_id comes from the verified login (set by requireRole), never
      // from the request body. Kiosk orders have no employee, so it stays NULL.
      const employeeId = source === 'Cashier' ? (req.employee?.employee_id ?? null) : null;
      const savedOrder = await client.query(
        `INSERT INTO orders (employee_id, menu_id, quantity, size,
                             sugar_level, ice_level, toppings)
         VALUES ($7, $1, $2, $3, $4, $5, $6) RETURNING order_id`,
        [menuId, quantity, size, sugar, ice,
          JSON.stringify(names.map((name) => ({ name, price: TOPPING_PRICES.get(name) / 100 }))),
          employeeId]
      );
      const id = Number(savedOrder.rows[0].order_id);
      await client.query(
        `INSERT INTO sale (order_id, employee_id, sale_time, total_amount)
         VALUES ($1, $3, CURRENT_TIMESTAMP, $2)`,
        [id, dollars(lineTotal), employeeId]
      );
      newOrderIds.push(id);
    }

    await client.query('COMMIT');
    const totalCents = subtotalCents + taxCents;
    res.status(201).json({
      number: newOrderIds[0], orderIds: newOrderIds,
      subtotal: subtotalCents / 100, tax: taxCents / 100,
      total: totalCents / 100,
      note: 'Each cart line is saved as a separate database order; payment and source are not stored.',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Existing-schema checkout failed:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save order' });
  } finally {
    if (client) client.release();
  }
});

router.patch('/:number/status', requireKitchen, async (req, res) => {
  const number = Number(req.params.number);
  const { status } = req.body || {};
  if (!Number.isSafeInteger(number) || number <= 0 ||
      !['new', 'in-progress', 'ready'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status update' });
  }
  try {
    const exists = await pool.query('SELECT 1 FROM orders WHERE order_id = $1', [number]);
    if (!exists.rowCount) return res.status(404).json({ error: 'Order not found' });
    const cancelled = await getRefundsForOrders([number]).catch(() => new Map());
    if (cancelled.get(number)?.type === 'cancellation') {
      return res.status(409).json({ error: 'This order was cancelled' });
    }
    const previous = temporaryStatuses.get(number) || {};
    temporaryStatuses.set(number, {
      status,
      startedAt: status === 'new' ? undefined : (previous.startedAt || Date.now()),
      completedAt: status === 'ready' ? Date.now() : undefined,
    });
    // Do not claim this is persisted to the database.
    res.json({ success: true, persistent: false, message: 'Status saved in server memory only' });
  } catch (error) {
    console.error('Temporary kitchen status failed:', error);
    res.status(500).json({ error: 'Unable to update kitchen status' });
  }
});

export default router;
