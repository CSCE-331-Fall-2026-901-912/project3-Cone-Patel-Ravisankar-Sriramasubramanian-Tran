// SCRUM-40: Employees stored in the PostgreSQL employee table.
// All of these require a manager login (the session cookie is sent with credentials).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "kitchen", label: "Kitchen staff" },
  { value: "inactive", label: "No access" },
];

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}/api/employees${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// GET /api/employees
export async function fetchEmployees() {
  return (await request("")).employees;
}

// POST /api/employees { name, role, email }
export async function createEmployee({ name, role, email }) {
  return (await request("", { method: "POST", body: JSON.stringify({ name, role, email }) })).employee;
}

// PATCH /api/employees/:id { name?, role?, email? }
export async function saveEmployee(id, changes) {
  return (await request(`/${id}`, { method: "PATCH", body: JSON.stringify(changes) })).employee;
}

// GET /api/auth/me - the signed-in user (used to stop managers demoting themselves)
export async function fetchCurrentUser() {
  const response = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
  if (!response.ok) return null;
  return (await response.json()).user;
}
