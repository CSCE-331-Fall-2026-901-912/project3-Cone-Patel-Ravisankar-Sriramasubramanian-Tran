// Shared helpers for talking to the Express backend.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// JSON request that throws a readable error on failure.
export async function apiJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

// GET /api/menu, converted from the PostgreSQL column names to the shape the UI uses.
export async function fetchMenu(signal) {
  const data = await apiJson("/api/menu", { signal });
  return data.items
    .filter((item) => item.availability)
    .map((item) => ({
      id: item.menu_id,
      name: item.item_name,
      category: item.category,
      price: Number(item.price),
      active: item.availability,
    }));
}

// GET /api/shifts/employees, converted to the shape the UI uses.
export async function fetchEmployees() {
  const data = await apiJson("/api/shifts/employees");
  return data.employees.map((e) => ({ id: e.employee_id, name: e.employee_name, role: e.role }));
}