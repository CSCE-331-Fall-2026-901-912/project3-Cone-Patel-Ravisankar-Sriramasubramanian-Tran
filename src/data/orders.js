// Database-backed orders shared by the Kiosk, Cashier, Kitchen, and Manager.
import { load, save } from "./store.js";

const KEY = "pos_db_orders";
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

// Backend is authoritative. An unsuccessful submission never clears the cart or
// creates a fake local order. Local storage is only a view cache for other tabs.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function refreshOrders() {
  const response = await fetch(`${API_URL}/api/pos/orders`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to load orders");
  save(KEY, data.orders);
  return data.orders;
}

export async function placeOrder(items, { source, employee = null, payment = "Card" }) {
  const response = await fetch(`${API_URL}/api/pos/orders`, {
    method: "POST",
    credentials: "include", // cashier orders are tied to the logged-in employee
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, source, employee, payment }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to submit order");
  await refreshOrders().catch((error) => console.warn("Order saved; list refresh failed:", error));
  return result;
}

// Cached view of GET /api/pos/orders
export function getAllOrders() {
  return readAll();
}

// Cached view of GET /api/pos/orders?status=new,in-progress
// Cancelled orders never reach the kitchen queue.
export function getActiveOrders() {
  return readAll().filter((o) => o.status !== "ready" && o.status !== "cancelled");
}

// Cached view of GET /api/pos/orders?status=ready&limit=n
export function getRecentlyReady(limit = 5) {
  return readAll()
    .filter((o) => o.status === "ready")
    .slice(-limit)
    .reverse();
}

// Cached view of GET /api/pos/orders?status=ready (newest completed first)
export function getCompletedOrders() {
  return readAll()
    .filter((o) => o.status === "ready")
    .sort((a, b) => (b.completedAt ?? b.placedAt) - (a.completedAt ?? a.placedAt));
}

// Persist kitchen changes so every browser sees the same status.
export async function updateStatus(number, status) {
  try {
  const response = await fetch(`${API_URL}/api/pos/orders/${number}/status`, {
    method: "PATCH", credentials: "include", // kitchen or manager login required
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to update order status");
  await refreshOrders();
  } catch (error) {
    console.error("Could not update order status:", error);
    window.alert(`Could not save kitchen status: ${error.message}`);
  }
}

// What the shop actually kept for an order after any cancellation or refund.
export function netTotal(order) {
  return Math.max(0, (Number(order.total) || 0) - (order.refund?.amount || 0));
}

// SCRUM-41: Manager cancels an order (full refund) or refunds part/all of it.
// POST /api/refunds - manager login required.
export async function refundOrder({ orderId, type, amount, reason }) {
  const response = await fetch(`${API_URL}/api/refunds`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, type, amount, reason }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to process the refund");
  await refreshOrders().catch((error) => console.warn("Refund saved; list refresh failed:", error));
  return data.refund;
}
