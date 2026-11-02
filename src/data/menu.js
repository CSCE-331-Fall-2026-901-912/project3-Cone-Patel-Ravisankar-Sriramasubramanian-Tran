// Menu data. Future: GET/POST/PATCH /api/menu backed by the menu table.
import { load, save } from "./store.js";

export const SHOP_NAME = "Boba Bliss"; // TODO: swap in our team's imaginary vendor name

export const CATEGORIES = ["Milk Tea", "Fruit Tea", "Specialty", "Seasonal"];

const MENU_KEY = "pos_menu";

const DEFAULT_MENU = [
  { id: 1, name: "Classic Milk Tea", category: "Milk Tea", price: 5.25, active: true },
  { id: 2, name: "Taro Milk Tea", category: "Milk Tea", price: 5.75, active: true },
  { id: 3, name: "Thai Milk Tea", category: "Milk Tea", price: 5.75, active: true },
  { id: 4, name: "Brown Sugar Milk Tea", category: "Milk Tea", price: 6.25, active: true },
  { id: 5, name: "Mango Green Tea", category: "Fruit Tea", price: 5.5, active: true },
  { id: 6, name: "Passion Fruit Tea", category: "Fruit Tea", price: 5.5, active: true },
  { id: 7, name: "Strawberry Black Tea", category: "Fruit Tea", price: 5.5, active: true },
  { id: 8, name: "Matcha Latte", category: "Specialty", price: 6.0, active: true },
  { id: 9, name: "Ube Cream Tea", category: "Specialty", price: 6.5, active: true },
  { id: 10, name: "Pumpkin Spice Milk Tea", category: "Seasonal", price: 6.5, active: true },
];

export const MENU_KEYS = [MENU_KEY];

export function getMenu() {
  return load(MENU_KEY, DEFAULT_MENU);
}

// Only items currently on sale, for the kiosk and cashier.
export function getActiveMenu() {
  return getMenu().filter((d) => d.active);
}

export function addMenuItem({ name, category, price }) {
  const menu = getMenu();
  const id = crypto.randomUUID();
  save(MENU_KEY, [...menu, { id, name, category, price, active: true }]);
}

export function updateMenuItem(id, changes) {
  save(MENU_KEY, getMenu().map((d) => (d.id === id ? { ...d, ...changes } : d)));
}

// Delete a menu item by ID
export function deleteMenuItem(id) {
  save(MENU_KEY, getMenu().filter((d) => d.id !== id));
}

export const SIZES = [
  { label: "Regular", extra: 0 },
  { label: "Large", extra: 0.75 },
];

export const SUGAR_LEVELS = ["0%", "25%", "50%", "75%", "100%"];
export const ICE_LEVELS = ["No Ice", "Less Ice", "Regular Ice", "Extra Ice"];

export const TOPPINGS = [
  { name: "Boba", price: 0.75 },
  { name: "Lychee Jelly", price: 0.75 },
  { name: "Pudding", price: 0.75 },
  { name: "Cheese Foam", price: 1.0 },
  { name: "Red Bean", price: 0.75 },
];
