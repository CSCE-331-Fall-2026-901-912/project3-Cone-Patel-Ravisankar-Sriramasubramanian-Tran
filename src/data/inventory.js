// Inventory. Future: GET/POST/PATCH /api/inventory backed by the inventory table.
import { load, save } from "./store.js";

const KEY = "pos_inventory";
export const INVENTORY_KEYS = [KEY];

const DEFAULT_INVENTORY = [
  { id: 1, name: "Black tea leaves", unit: "lb", quantity: 18, minimum: 10 },
  { id: 2, name: "Green tea leaves", unit: "lb", quantity: 12, minimum: 10 },
  { id: 3, name: "Whole milk", unit: "gal", quantity: 6, minimum: 8 },
  { id: 4, name: "Taro powder", unit: "lb", quantity: 9, minimum: 5 },
  { id: 5, name: "Matcha powder", unit: "lb", quantity: 3, minimum: 4 },
  { id: 6, name: "Tapioca pearls", unit: "lb", quantity: 25, minimum: 15 },
  { id: 7, name: "Mango syrup", unit: "bottle", quantity: 7, minimum: 4 },
  { id: 8, name: "Regular cups", unit: "sleeve", quantity: 30, minimum: 20 },
  { id: 9, name: "Large cups", unit: "sleeve", quantity: 14, minimum: 20 },
  { id: 10, name: "Straws", unit: "box", quantity: 9, minimum: 5 },
];

export function getInventory() {
  return load(KEY, DEFAULT_INVENTORY);
}

export function isLowStock(item) {
  return item.quantity < item.minimum;
}

export function updateInventoryItem(id, changes) {
  save(KEY, getInventory().map((i) => (i.id === id ? { ...i, ...changes } : i)));
}

export function addInventoryItem({ name, unit, quantity, minimum }) {
  const items = getInventory();
  const id = Math.max(0, ...items.map((i) => i.id)) + 1;
  save(KEY, [...items, { id, name, unit, quantity, minimum }]);
}
