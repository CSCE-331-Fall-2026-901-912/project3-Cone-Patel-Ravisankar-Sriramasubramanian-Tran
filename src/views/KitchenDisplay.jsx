import { useEffect, useState } from "react";
import { getAllOrders, getRecentlyReady, updateStatus, ORDER_KEYS } from "../data/orders.js";
import { getActiveOrders, getRecentlyReady, getCompletedOrders, updateStatus, ORDER_KEYS } from "../data/orders.js";
import { useLive } from "../data/store.js";
import KitchenHistory from "../components/KitchenHistory.jsx";

export default function KitchenDisplay() {
  const allOrders = useLive(getAllOrders, ORDER_KEYS);
  const [statusFilter, setStatusFilter] = useState("active");
  const orders = allOrders.filter((order) =>
    statusFilter === "all" ? true : statusFilter === "active" ? order.status !== "ready" : order.status === statusFilter
  );
  const openCount = allOrders.filter((order) => order.status !== "ready").length;
  const ready = useLive(getRecentlyReady, ORDER_KEYS);
  const completedCount = useLive(getCompletedOrders, ORDER_KEYS).length;
  const totalOpen = orders.length;
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inProgressOrders = orders.filter(
    (order) => order.status === "in-progress"
  ).length;
  const [tab, setTab] = useState("active"); // "active" or "history"
  const [now, setNow] = useState(Date.now());
  const [sortBy, setSortBy] = useState("longest");
  const sortedOrders = [...orders].sort((a, b) => {
    const aTime = new Date(a.placedAt).getTime();
    const bTime = new Date(b.placedAt).getTime();

    switch (sortBy) {
      case "newest":
        return bTime - aTime;

      case "oldest":
        return aTime - bTime;

      case "longest":
      default:
        return aTime - bTime;
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="kitchen">
      <header className="kitchen-header">
        <h1>Kitchen Display</h1>
        <p>
          {openCount} open {openCount === 1 ? "order" : "orders"}
        </p>
      </header>
      <section className="kitchen-summary" aria-label="Kitchen order summary">
        <div className="kitchen-summary-card">
          <span className="kitchen-summary-label">Total Open</span>
          <strong className="kitchen-summary-value">{totalOpen}</strong>
        </div>

<<<<<<< HEAD
      <div className="kitchen-filters" role="group" aria-label="Filter orders by status">
        {[
          ["active", "Active"],
          ["all", "All Orders"],
          ["new", "New"],
          ["in-progress", "In Progress"],
          ["ready", "Ready"],
        ].map(([value, label]) => (
          <button key={value} type="button" className={`kitchen-filter-btn ${statusFilter === value ? "selected" : ""}`} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
            {label} ({allOrders.filter((o) => value === "all" || (value === "active" ? o.status !== "ready" : o.status === value)).length})
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="kitchen-empty">No orders match this filter. New orders from the kiosk and cashier appear automatically.</p>
=======
        <div className="kitchen-summary-card">
          <span className="kitchen-summary-label">New</span>
          <strong className="kitchen-summary-value">{newOrders}</strong>
        </div>

        <div className="kitchen-summary-card">
          <span className="kitchen-summary-label">In Progress</span>
          <strong className="kitchen-summary-value">{inProgressOrders}</strong>
        </div>
      </section>
      <div className="kitchen-toolbar">
        <nav className="kitchen-tabs" aria-label="Kitchen views">
          <button
            className={`kitchen-tab ${tab === "active" ? "kitchen-tab-active" : ""}`}
            aria-pressed={tab === "active"}
            onClick={() => setTab("active")}
          >
            Active
            <span className="kitchen-tab-count">{orders.length}</span>
          </button>

          <button
            className={`kitchen-tab ${tab === "history" ? "kitchen-tab-active" : ""}`}
            aria-pressed={tab === "history"}
            onClick={() => setTab("history")}
          >
            History
            <span className="kitchen-tab-count">{completedCount}</span>
          </button>
        </nav>

        {tab === "active" && (
          <div className="kitchen-sort">
            <label htmlFor="kitchen-sort-select">Sort orders by:</label>
            <select
              id="kitchen-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="longest">Longest Waiting Time</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        )}
      </div>

      {tab === "history" ? (
        <KitchenHistory />
      ) : orders.length === 0 ? (
        <p className="kitchen-empty">No orders right now. New orders from the kiosk and cashier appear here automatically.</p>
>>>>>>> 65ca286c8f39688ffcb0c66ec079ca7c917d60f9
      ) : (
        <section className="ticket-grid" aria-label="Open orders" aria-live="polite">
          {sortedOrders.map((order) => (
            <Ticket key={order.number} order={order} now={now} />
          ))}
        </section>
      )}

      {tab === "active" && ready.length > 0 && (
        <footer className="ready-bar" aria-label="Recently completed">
          <span>Recently ready:</span>
          {ready.map((o) => (
            <span key={o.number} className="ready-chip">
              #{o.number}
              <button className="btn-link" onClick={() => updateStatus(o.number, "in-progress")} aria-label={`Recall order ${o.number}`}>
                Recall
              </button>
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}

function Ticket({ order, now }) {
  const seconds = Math.max(0, Math.floor((now - order.placedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const waitText = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  const urgency = minutes >= 10 ? "late" : minutes >= 5 ? "warn" : "ok";
  const inProgress = order.status === "in-progress";

  return (
    <article className={`ticket ${inProgress ? "ticket-progress" : ""} ${order.status === "ready" ? "ticket-ready" : ""}`}>
      <header className="ticket-header">
        <h2>#{order.number}</h2>
        <span className={`timer timer-${urgency}`} aria-label={`Waiting ${minutes} minutes`}>
          {waitText}
        </span>
      </header>
      <p className="ticket-status">
        {order.status === "ready" ? "Ready" : inProgress ? "In progress" : "New"} · {order.source}
      </p>

      <ul className="ticket-items">
        {order.items.map((item, i) => (
          <li key={i}>
            <strong>
              {item.quantity} × {item.name}
            </strong>
            <ul className="mods">
              <li>{item.size.label}</li>
              <li>{item.sugar} sugar</li>
              <li>{item.ice}</li>
              {item.toppings.map((t) => (
                <li key={t.name}>+ {t.name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {order.status === "ready" ? (
        <button className="btn btn-primary btn-block" onClick={() => updateStatus(order.number, "in-progress")}>
          Recall
        </button>
      ) : inProgress ? (
        <button className="btn btn-success btn-block" onClick={() => updateStatus(order.number, "ready")}>
          Mark Ready
        </button>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => updateStatus(order.number, "in-progress")}>
          Start
        </button>
      )}
    </article>
  );
}