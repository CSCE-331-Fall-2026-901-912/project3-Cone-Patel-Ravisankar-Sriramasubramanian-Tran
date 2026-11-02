// Employees. Future: GET/POST/PATCH /api/employees backed by the employee table.
import { load, save } from "./store.js";

const KEY = "pos_employees";
export const EMPLOYEE_KEYS = [KEY];
export const ROLES = ["Cashier", "Manager"];

const DEFAULT_EMPLOYEES = [
  { id: 1, name: "Alex Kim", role: "Manager", active: true },
  { id: 2, name: "Jordan Lee", role: "Cashier", active: true },
  { id: 3, name: "Sam Rivera", role: "Cashier", active: true },
  { id: 4, name: "Taylor Nguyen", role: "Cashier", active: true },
];

export function getEmployees() {
  return load(KEY, DEFAULT_EMPLOYEES);
}

export function addEmployee({ name, role }) {
  const list = getEmployees();
  const id = Math.max(0, ...list.map((e) => e.id)) + 1;
  save(KEY, [...list, { id, name, role, active: true }]);
}

export function updateEmployee(id, changes) {
  save(KEY, getEmployees().map((e) => (e.id === id ? { ...e, ...changes } : e)));
}
