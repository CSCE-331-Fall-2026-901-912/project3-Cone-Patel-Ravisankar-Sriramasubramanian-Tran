import { useEffect, useState } from "react";
import { getActiveOrders, getRecentlyReady, getCompletedOrders, updateStatus, ORDER_KEYS } from "../data/orders.js";
import { useLive } from "../data/store.js";
import KitchenHistory from "../components/KitchenHistory.jsx";

// Active tab: every order that still needs to be made, oldest first.
// Staff tap "Start" when they begin a ticket and "Mark Ready" when it's done.
// History tab: completed orders with timestamps and details.
export default function KitchenDisplay() {
  const orders = useLive(getActiveOrders, ORDER_KEYS);
  const ready = useLive(getRecentlyReady, ORDER_KEYS);
  const completedCount = useLive(getCompletedOrders, ORDER_KEYS).length;
  const [tab, setTab] = useState("active"); // "active" or "history"
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Tick every second so the wait timers stay current.
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="kitchen">
      <header className="kitchen-header">
        <h1>Kitchen Display</h1>
        <p>
          {orders.length} open {orders.length === 1 ? "order" : "orders"}
        </p>
      </header>

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

      {tab === "history" ? (
        <KitchenHistory />
      ) : orders.length === 0 ? (
        <p className="kitchen-empty">No orders right now. New orders from the kiosk and cashier appear here automatically.</p>
      ) : (
        <section className="ticket-grid" aria-label="Open orders" aria-live="polite">
          {orders.map((order) => (
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
  // Color the timer so slow tickets stand out: yellow after 5 min, red after 10.
  const urgency = minutes >= 10 ? "late" : minutes >= 5 ? "warn" : "ok";
  const inProgress = order.status === "in-progress";

  return (
    <article className={`ticket ${inProgress ? "ticket-progress" : ""}`}>
      <header className="ticket-header">
        <h2>#{order.number}</h2>
        <span className={`timer timer-${urgency}`} aria-label={`Waiting ${minutes} minutes`}>
          {waitText}
        </span>
      </header>
      <p className="ticket-status">
        {inProgress ? "In progress" : "New"} · {order.source}
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

      {inProgress ? (
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
