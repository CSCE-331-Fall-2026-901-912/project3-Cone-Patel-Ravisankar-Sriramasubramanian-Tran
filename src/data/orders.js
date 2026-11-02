// Orders shared by the Kiosk, Cashier, Kitchen Display, and Manager Dashboard.
// Future endpoints are noted above each function.
import { load, save } from "./store.js";

const KEY = "pos_orders";
const NEXT_KEY = "pos_next_order_number";
export const ORDER_KEYS = [KEY];
export const TAX_RATE = 0.0825;

function readAll() {
  return load(KEY, []);
}

export function itemPrice(item) {
  const toppings = item.toppings.reduce((sum, t) => sum + t.price, 0);
  return (item.basePrice + item.size.extra + toppings) * item.quantity;
}

export function orderTotals(items) {
  const subtotal = items.reduce((sum, i) => sum + itemPrice(i), 0);
  const tax = subtotal * TAX_RATE;
  return { subtotal, tax, total: subtotal + tax };
}

// Future: POST /api/orders
// source is "Kiosk" or "Cashier"; employee and payment are only set by the cashier.
export function placeOrder(items, { source, employee = null, payment = "Card" }) {
  const number = Number(localStorage.getItem(NEXT_KEY) || 101);
  localStorage.setItem(NEXT_KEY, String(number + 1));
  const order = {
    number,
    items,
    source,
    employee,
    payment,
    ...orderTotals(items),
    status: "new", // new -> in-progress -> ready
    placedAt: Date.now(),
  };
  save(KEY, [...readAll(), order]);
  return order;
}

// Future: GET /api/orders
export function getAllOrders() {
  return readAll();
}

// Future: GET /api/orders?status=new,in-progress
export function getActiveOrders() {
  return readAll().filter((o) => o.status !== "ready");
}

// Future: GET /api/orders?status=ready&limit=n
export function getRecentlyReady(limit = 5) {
  return readAll()
    .filter((o) => o.status === "ready")
    .slice(-limit)
    .reverse();
}

// Future: GET /api/orders?status=ready (newest completed first)
export function getCompletedOrders() {
  return readAll()
    .filter((o) => o.status === "ready")
    .sort((a, b) => (b.completedAt ?? b.placedAt) - (a.completedAt ?? a.placedAt));
}

// Future: PATCH /api/orders/:number { status }
// Also records when an order was started and completed for the kitchen history.
export function updateStatus(number, status) {
  const now = Date.now();
  save(
    KEY,
    readAll().map((o) => {
      if (o.number !== number) return o;
      const updated = { ...o, status };
      if (status === "in-progress") {
        updated.startedAt = o.startedAt ?? now;
        delete updated.completedAt; // a recalled order is no longer complete
      }
      if (status === "ready") {
        updated.startedAt = o.startedAt ?? now;
        updated.completedAt = now;
      }
      return updated;
    })
  );
}
