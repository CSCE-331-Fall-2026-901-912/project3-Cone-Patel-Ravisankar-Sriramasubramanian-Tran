import { useState } from "react";
import { SHOP_NAME, CATEGORIES, getMenu, addMenuItem, updateMenuItem, deleteMenuItem, MENU_KEYS } from "../data/menu.js";
import { getAllOrders, ORDER_KEYS, itemPrice } from "../data/orders.js";
import { getInventory, updateInventoryItem, addInventoryItem, isLowStock, INVENTORY_KEYS } from "../data/inventory.js";
import { getEmployees, addEmployee, updateEmployee, ROLES, EMPLOYEE_KEYS } from "../data/employees.js";
import { useLive, money } from "../data/store.js";

const TABS = ["Overview", "Reports", "Orders", "Menu", "Inventory", "Employees"];

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
        {tab === "Reports" && <Reports />}
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


/* ---------------- Reports ---------------- */

function localDateKey(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function Reports() {
  const orders = useLive(getAllOrders, ORDER_KEYS);
  const inventory = useLive(getInventory, INVENTORY_KEYS);
  const [date, setDate] = useState(() => localDateKey(Date.now()));

  // Orders placed on the selected date
  const dailyOrders = orders.filter(
    (o) => localDateKey(o.placedAt) === date
  );

  // Daily sales calculations
  const revenue = dailyOrders.reduce(
    (sum, o) => sum + (Number(o.total) || 0), 0
  );

  const subtotal = dailyOrders.reduce(
    (sum, o) => sum + (Number(o.subtotal) || 0), 0
  );

  const tax = dailyOrders.reduce(
    (sum, o) => sum + (Number(o.tax) || 0), 0
  );

  const itemsSold = dailyOrders.reduce(
    (sum, o) =>
      sum + o.items.reduce(
        (n, i) => n + (Number(i.quantity) || 0), 0
      ),
    0
  );

  const kioskOrders = dailyOrders.filter(
    (o) => o.source === "Kiosk"
  );

  const cashierOrders = dailyOrders.filter(
    (o) => o.source === "Cashier"
  );

  // Product sales calculations
  const products = new Map();

  dailyOrders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.name;

      const previous = products.get(key) || {
        name: key,
        quantity: 0,
        revenue: 0,
      };

      previous.quantity += Number(item.quantity) || 0;
      previous.revenue += itemPrice(item);

      products.set(key, previous);
    });
  });

  const productRows = [...products.values()].sort(
    (a, b) =>
      b.quantity - a.quantity ||
      a.name.localeCompare(b.name)
  );

  const maxQuantity = Math.max(
    1,
    ...productRows.map((p) => p.quantity)
  );

  const lowStock = inventory.filter(isLowStock);

  return (
    <>
      {/* Date selector */}
      <div className="order-filters">
        <label>
          Report date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn"
          onClick={() => setDate(localDateKey(Date.now()))}
        >
          Today
        </button>
      </div>

      {/* Daily sales report */}
      <section aria-label="Daily sales report">
        <h2>Daily sales report</h2>

        <div className="stat-row">
          <Stat
            label="Revenue (including tax)"
            value={money(revenue)}
          />
          <Stat
            label="Orders"
            value={dailyOrders.length}
          />
          <Stat
            label="Items sold"
            value={itemsSold}
          />
          <Stat
            label="Average order"
            value={money(
              dailyOrders.length
                ? revenue / dailyOrders.length
                : 0
            )}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Subtotal before tax</td>
                <td className="num">{money(subtotal)}</td>
              </tr>
              <tr>
                <td>Tax collected</td>
                <td className="num">{money(tax)}</td>
              </tr>
              <tr>
                <td>Total revenue</td>
                <td className="num">{money(revenue)}</td>
              </tr>
              <tr>
                <td>Kiosk orders</td>
                <td className="num">{kioskOrders.length}</td>
              </tr>
              <tr>
                <td>Cashier orders</td>
                <td className="num">{cashierOrders.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Product sales report */}
      <section
        className="panel"
        aria-label="Product sales report"
      >
        <h2>Product sales report</h2>

        {productRows.length === 0 ? (
          <p className="muted">
            No orders recorded for this date.
          </p>
        ) : (
          <>
            <h3>Drinks sold by quantity</h3>

            <ul className="bar-list">
              {productRows.slice(0, 10).map((p) => (
                <li key={p.name}>
                  <span className="bar-label">
                    {p.name}
                  </span>

                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{
                        width: `${
                          (p.quantity / maxQuantity) * 100
                        }%`,
                      }}
                    />
                  </span>

                  <span className="bar-value">
                    {p.quantity}
                  </span>
                </li>
              ))}
            </ul>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Drink</th>
                    <th className="num">Quantity sold</th>
                    <th className="num">Sales before tax</th>
                  </tr>
                </thead>

                <tbody>
                  {productRows.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td className="num">
                        {p.quantity}
                      </td>
                      <td className="num">
                        {money(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Inventory status report */}
      <section
        className="panel"
        aria-label="Inventory status report"
      >
        <h2>Inventory status report</h2>

        <p className="muted">
          Current inventory snapshot, not historical
          usage for the selected date.
        </p>

        <p>
          {lowStock.length} of {inventory.length} inventory
          items are below minimum.
        </p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingredient / supply</th>
                <th className="num">In stock</th>
                <th className="num">Minimum</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="num">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="num">
                    {item.minimum} {item.unit}
                  </td>
                  <td>
                    {isLowStock(item) ? "Low stock" : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted">
        Reports reflect orders saved in this browser
        until the shared database is connected.
      </p>
    </>
  );
}

/* ---------------- Orders ---------------- */


function Orders() {
  const orders = [...useLive(getAllOrders, ORDER_KEYS)].reverse();

  // Keep track of the manager's search and filter selections.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const searchTerm = search.trim().toLowerCase();

  // Only display orders that match both filters.
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      String(order.number).includes(searchTerm.replace(/^#/, "")) ||
      (order.employee ?? "").toLowerCase().includes(searchTerm) ||
      order.items.some((item) =>
        item.name.toLowerCase().includes(searchTerm)
      );

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  if (orders.length === 0) {
    return (
      <p className="muted">
        No orders yet. Place one from the kiosk or cashier.
      </p>
    );
  }

  return (
    <>
      <div className="order-filters">
        <label>
          Search orders
          <input
            type="search"
            placeholder="Order #, drink, or employee"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <label>
          Order status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in-progress">In progress</option>
            <option value="ready">Ready</option>
          </select>
        </label>

        <button
          type="button"
          className="btn"
          onClick={clearFilters}
          disabled={!search && statusFilter === "all"}
        >
          Clear filters
        </button>
      </div>

      <p className="muted" role="status">
        Showing {filteredOrders.length} of {orders.length} orders
      </p>

      {filteredOrders.length === 0 ? (
        <p className="muted">
          No orders match your search or filters.
        </p>
      ) : (
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
              {filteredOrders.map((o) => (
                <tr key={o.number}>
                  <td>#{o.number}</td>
                  <td>
                    {new Date(o.placedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{o.source}</td>
                  <td>{o.employee ?? "—"}</td>
                  <td>
                    {o.items
                      .map((i) => `${i.quantity}× ${i.name}`)
                      .join(", ")}
                  </td>
                  <td>{o.payment}</td>
                  <td className="num">{money(o.total)}</td>
                  <td>
                    <span className={`status status-${o.status}`}>
                      {o.status === "in-progress"
                        ? "In progress"
                        : o.status === "ready"
                          ? "Ready"
                          : "New"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}


/* ---------------- Menu ---------------- */

function MenuTab() {
  const menu = useLive(getMenu, MENU_KEYS);
  const [form, setForm] = useState({ name: "", category: "Seasonal", price: "" });

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "Milk Tea",
    price: "",
  });

  function startEditing(drink) {
    setEditingId(drink.id);
    setEditForm({
      name: drink.name,
      category: drink.category,
      price: String(drink.price),
    });
  }

  function saveEdit() {
    const name = editForm.name.trim();
    const price = Number(editForm.price);

    if (!name || !Number.isFinite(price) || price <= 0) return;

    updateMenuItem(editingId, {
      name,
      category: editForm.category,
      price,
    });

    setEditingId(null);
  }

  function handleDelete(drink) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${drink.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    deleteMenuItem(drink.id);

    if (editingId === drink.id) {
      setEditingId(null);
    }
  }

  const filteredMenu = menu.filter((drink) =>
    drink.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    drink.category.toLowerCase().includes(search.trim().toLowerCase())
  );

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
      <div className="order-filters">
        <label>
          Search menu
          <input
            type="search"
            placeholder="Search by drink or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn"
          onClick={() => setSearch("")}
          disabled={!search}
        >
          Clear search
        </button>
      </div>

      <p className="muted" role="status">
        Showing {filteredMenu.length} of {menu.length} drinks
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Drink</th>
              <th>Category</th>
              <th className="num">Price ($)</th>
              <th>On menu</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMenu.map((d) => (
              <tr key={d.id} className={d.active ? "" : "row-off"}>
                <td>
                  {editingId === d.id ? (
                    <input
                      className="cell-input"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      aria-label={`Edit name for ${d.name}`}
                    />
                  ) : (
                    d.name
                  )}
                </td>
                <td>
                  {editingId === d.id ? (
                    <select
                      className="cell-select"
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value })
                      }
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  ) : (
                    d.category
                  )}
                </td>
                <td className="num">
                  {editingId === d.id ? (
                    <input
                      className="cell-input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editForm.price}
                      onChange={(e) =>
                        setEditForm({ ...editForm, price: e.target.value })
                      }
                      aria-label={`Edit price for ${d.name}`}
                    />
                  ) : (
                    money(d.price)
                  )}
                </td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={d.active} onChange={() => updateMenuItem(d.id, { active: !d.active })} />
                    {d.active ? "Yes" : "No"}
                  </label>
                </td>
                <td>
                  {editingId === d.id ? (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        onClick={saveEdit}
                        disabled={
                          !editForm.name.trim() ||
                          !Number.isFinite(Number(editForm.price)) ||
                          Number(editForm.price) <= 0
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => startEditing(d)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => handleDelete(d)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
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
  
  // Inventory search and low-stock filtering.
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const [form, setForm] = useState({ name: "", unit: "", quantity: "", minimum: "" });

  function submit(e) {
    e.preventDefault();
    const quantity = parseInt(form.quantity, 10);
    const minimum = parseInt(form.minimum, 10);
    if (!form.name.trim() || isNaN(quantity) || isNaN(minimum)) return;
    addInventoryItem({ name: form.name.trim(), unit: form.unit.trim() || "unit", quantity, minimum });
    setForm({ name: "", unit: "", quantity: "", minimum: "" });
  }

  
  // Search by item name and optionally show only low-stock items.
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesLowStock =
      !showLowStockOnly || isLowStock(item);

    return matchesSearch && matchesLowStock;
  });

  // Keep low-stock items at the top of the filtered results.
  const sorted = [...filteredInventory].sort(
    (a, b) => Number(isLowStock(b)) - Number(isLowStock(a))
  );

  function clearInventoryFilters() {
    setSearch("");
    setShowLowStockOnly(false);
  }


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
      
      <div className="inventory-filters">
        <label>
          Search inventory
          <input
            type="search"
            placeholder="Search by item name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <label className="inventory-low-stock-toggle">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
          />
          Show low-stock items only
        </label>

        <button
          type="button"
          className="btn"
          onClick={clearInventoryFilters}
          disabled={!search && !showLowStockOnly}
        >
          Clear filters
        </button>
      </div>

      <p className="muted" role="status">
        Showing {sorted.length} of {inventory.length} inventory items
      </p>

      {sorted.length === 0 && (
        <p className="muted">
          {inventory.length === 0
            ? "No inventory items yet."
            : "No inventory items match your filters."}
        </p>
      )}

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
