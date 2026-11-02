import { useState } from "react";
import { SHOP_NAME, CATEGORIES, getMenu, addMenuItem, updateMenuItem, MENU_KEYS } from "../data/menu.js";
import { getAllOrders, ORDER_KEYS } from "../data/orders.js";
import { getInventory, updateInventoryItem, addInventoryItem, isLowStock, INVENTORY_KEYS } from "../data/inventory.js";
import { getEmployees, addEmployee, updateEmployee, ROLES, EMPLOYEE_KEYS } from "../data/employees.js";
import { useLive, money } from "../data/store.js";

const TABS = ["Overview", "Orders", "Menu", "Inventory", "Employees"];

export default function ManagerDashboard() {
  const [tab, setTab] = useState("Overview");

  return (
    <div className="manager">
      <nav className="manager-nav" aria-label="Manager sections">
        <p className="manager-brand">{SHOP_NAME}</p>
        <p className="manager-brand-sub">Manager</p>
        {TABS.map((t) => (
          <button
            key={t}
            className={`manager-tab ${t === tab ? "manager-tab-active" : ""}`}
            aria-current={t === tab ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="manager-main">
        <h1>{tab}</h1>
        {tab === "Overview" && <Overview />}
        {tab === "Orders" && <Orders />}
        {tab === "Menu" && <MenuTab />}
        {tab === "Inventory" && <InventoryTab />}
        {tab === "Employees" && <EmployeesTab />}
      </main>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview() {
  const orders = useLive(getAllOrders, ORDER_KEYS);
  const inventory = useLive(getInventory, INVENTORY_KEYS);

  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const today = orders.filter((o) => o.placedAt >= startOfDay);
  const revenue = today.reduce((sum, o) => sum + o.total, 0);
  const lowStock = inventory.filter(isLowStock);

  // Drinks sold today, most popular first.
  const counts = {};
  today.forEach((o) => o.items.forEach((i) => (counts[i.name] = (counts[i.name] || 0) + i.quantity)));
  const topDrinks = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCount = topDrinks[0]?.[1] || 1;

  const kioskCount = today.filter((o) => o.source === "Kiosk").length;

  return (
    <>
      <div className="stat-row">
        <Stat label="Revenue today" value={money(revenue)} />
        <Stat label="Orders today" value={today.length} />
        <Stat label="Average order" value={money(today.length ? revenue / today.length : 0)} />
        <Stat label="Kiosk vs cashier" value={`${kioskCount} / ${today.length - kioskCount}`} />
      </div>

      <div className="panel-row">
        <section className="panel">
          <h2>Top drinks today</h2>
          {topDrinks.length === 0 ? (
            <p className="muted">No sales yet today.</p>
          ) : (
            <ul className="bar-list">
              {topDrinks.map(([name, count]) => (
                <li key={name}>
                  <span className="bar-label">{name}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </span>
                  <span className="bar-value">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="muted">Everything is above its minimum.</p>
          ) : (
            <ul className="plain-list">
              {lowStock.map((i) => (
                <li key={i.id}>
                  <strong>{i.name}</strong>: {i.quantity} {i.unit} left (min {i.minimum})
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

/* ---------------- Orders ---------------- */

function Orders() {
  const orders = [...useLive(getAllOrders, ORDER_KEYS)].reverse();

  if (orders.length === 0) return <p className="muted">No orders yet. Place one from the kiosk or cashier.</p>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Time</th>
            <th>Source</th>
            <th>Employee</th>
            <th>Items</th>
            <th>Payment</th>
            <th className="num">Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.number}>
              <td>#{o.number}</td>
              <td>{new Date(o.placedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
              <td>{o.source}</td>
              <td>{o.employee ?? "—"}</td>
              <td>{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</td>
              <td>{o.payment}</td>
              <td className="num">{money(o.total)}</td>
              <td>
                <span className={`status status-${o.status}`}>{o.status === "in-progress" ? "In progress" : o.status === "ready" ? "Ready" : "New"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Menu ---------------- */

function MenuTab() {
  const menu = useLive(getMenu, MENU_KEYS);
  const [form, setForm] = useState({ name: "", category: "Seasonal", price: "" });

  function submit(e) {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (!form.name.trim() || !(price > 0)) return;
    addMenuItem({ name: form.name.trim(), category: form.category, price });
    setForm({ name: "", category: form.category, price: "" });
  }

  return (
    <>
      <form className="inline-form" onSubmit={submit} aria-label="Add menu item">
        <h2>Add a drink</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Category
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Price ($)
          <input type="number" min="0" step="0.25" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        </label>
        <button className="btn btn-primary">Add</button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Drink</th>
              <th>Category</th>
              <th className="num">Price ($)</th>
              <th>On menu</th>
            </tr>
          </thead>
          <tbody>
            {menu.map((d) => (
              <tr key={d.id} className={d.active ? "" : "row-off"}>
                <td>{d.name}</td>
                <td>{d.category}</td>
                <td className="num">
                  <input
                    className="cell-input"
                    type="number"
                    min="0"
                    step="0.25"
                    defaultValue={d.price.toFixed(2)}
                    aria-label={`Price for ${d.name}`}
                    onBlur={(e) => {
                      const price = parseFloat(e.target.value);
                      if (price > 0 && price !== d.price) updateMenuItem(d.id, { price });
                    }}
                  />
                </td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={d.active} onChange={() => updateMenuItem(d.id, { active: !d.active })} />
                    {d.active ? "Yes" : "No"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Inventory ---------------- */

function InventoryTab() {
  const inventory = useLive(getInventory, INVENTORY_KEYS);
  const [form, setForm] = useState({ name: "", unit: "", quantity: "", minimum: "" });

  function submit(e) {
    e.preventDefault();
    const quantity = parseInt(form.quantity, 10);
    const minimum = parseInt(form.minimum, 10);
    if (!form.name.trim() || isNaN(quantity) || isNaN(minimum)) return;
    addInventoryItem({ name: form.name.trim(), unit: form.unit.trim() || "unit", quantity, minimum });
    setForm({ name: "", unit: "", quantity: "", minimum: "" });
  }

  // Low-stock items first so they're the first thing a manager sees.
  const sorted = [...inventory].sort((a, b) => isLowStock(b) - isLowStock(a));

  return (
    <>
      <form className="inline-form" onSubmit={submit} aria-label="Add inventory item">
        <h2>Add an item</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Unit
          <input value={form.unit} placeholder="lb, box…" onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </label>
        <label>
          Quantity
          <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
        </label>
        <label>
          Minimum
          <input type="number" min="0" value={form.minimum} onChange={(e) => setForm({ ...form, minimum: e.target.value })} required />
        </label>
        <button className="btn btn-primary">Add</button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Quantity</th>
              <th>Unit</th>
              <th className="num">Minimum</th>
              <th>Status</th>
              <th>Restock</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td className="num">
                  <input
                    className="cell-input"
                    type="number"
                    min="0"
                    value={i.quantity}
                    aria-label={`Quantity of ${i.name}`}
                    onChange={(e) => updateInventoryItem(i.id, { quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                </td>
                <td>{i.unit}</td>
                <td className="num">{i.minimum}</td>
                <td>{isLowStock(i) ? <span className="status status-low">Low</span> : <span className="status status-ok">OK</span>}</td>
                <td>
                  <button className="btn btn-small" onClick={() => updateInventoryItem(i.id, { quantity: i.quantity + 10 })}>
                    +10
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Employees ---------------- */

function EmployeesTab() {
  const employees = useLive(getEmployees, EMPLOYEE_KEYS);
  const [form, setForm] = useState({ name: "", role: "Cashier" });

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addEmployee({ name: form.name.trim(), role: form.role });
    setForm({ name: "", role: "Cashier" });
  }

  return (
    <>
      <form className="inline-form" onSubmit={submit} aria-label="Add employee">
        <h2>Add an employee</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary">Add</button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className={e.active ? "" : "row-off"}>
                <td>{e.name}</td>
                <td>
                  <select className="cell-select" value={e.role} aria-label={`Role for ${e.name}`} onChange={(ev) => updateEmployee(e.id, { role: ev.target.value })}>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={e.active} onChange={() => updateEmployee(e.id, { active: !e.active })} />
                    {e.active ? "Yes" : "No"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
