import { useEffect, useRef, useState } from "react";
import { getCompletedOrders, updateStatus, ORDER_KEYS } from "../data/orders.js";
import { useLive } from "../data/store.js";
import "./KitchenHistory.css";

// History tab for the Kitchen Display: completed orders with timestamps.
// Tapping an order opens a small window with its full details and timeline.
export default function KitchenHistory() {
  const orders = useLive(getCompletedOrders, ORDER_KEYS);
  const [selected, setSelected] = useState(null); // order number shown in the details window

  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const today = orders.filter((o) => (o.completedAt ?? o.placedAt) >= startOfDay);
  const timed = today.filter((o) => o.completedAt);
  const avgSeconds = timed.length
    ? timed.reduce((sum, o) => sum + (o.completedAt - o.placedAt) / 1000, 0) / timed.length
    : null;

  const selectedOrder = orders.find((o) => o.number === selected);

  if (orders.length === 0) {
    return <p className="kitchen-empty">No completed orders yet. Orders you mark ready will show up here.</p>;
  }

  return (
    <section className="history" aria-label="Completed orders">
      <div className="history-stats">
        <div className="history-stat">
          <span className="history-stat-label">Completed today</span>
          <span className="history-stat-value">{today.length}</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-label">Average order time today</span>
          <span className="history-stat-value">{avgSeconds === null ? "—" : formatDuration(avgSeconds)}</span>
        </div>
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Drinks</th>
              <th scope="col">Placed</th>
              <th scope="col">Completed</th>
              <th scope="col">Total time</th>
              <th scope="col">
                <span className="visually-hidden">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.number}>
                <td>
                  <strong>#{o.number}</strong>
                  <span className="history-source">{o.source}</span>
                </td>
                <td className="history-drinks">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</td>
                <td>{formatTime(o.placedAt)}</td>
                <td>{o.completedAt ? formatTime(o.completedAt) : "—"}</td>
                <td>{o.completedAt ? formatDuration((o.completedAt - o.placedAt) / 1000) : "—"}</td>
                <td>
                  <button className="btn history-view" onClick={() => setSelected(o.number)} aria-label={`View details for order ${o.number}`}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelected(null)} />}
    </section>
  );
}

function OrderDetails({ order, onClose }) {
  const closeRef = useRef(null);

  // Focus the window when it opens and close it with the Escape key.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function recall() {
    updateStatus(order.number, "in-progress");
    onClose();
  }

  const steps = [
    { label: "Placed", time: order.placedAt },
    { label: "Started", time: order.startedAt, wait: order.startedAt && order.startedAt - order.placedAt },
    { label: "Completed", time: order.completedAt, wait: order.completedAt && order.startedAt && order.completedAt - order.startedAt },
  ];

  return (
    <div className="overlay history-overlay" role="dialog" aria-modal="true" aria-labelledby="history-details-title" onClick={onClose}>
      <div className="history-window" onClick={(e) => e.stopPropagation()}>
        <header className="history-window-header">
          <div>
            <h2 id="history-details-title">Order #{order.number}</h2>
            <p className="history-window-sub">
              {order.source}
              {order.employee && ` · ${order.employee}`} · Completed
            </p>
          </div>
          <button ref={closeRef} className="btn history-close" onClick={onClose} aria-label="Close order details">
            ×
          </button>
        </header>

        <h3>Drinks</h3>
        <ul className="ticket-items history-items">
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

        <h3>Timeline</h3>
        <ol className="history-timeline">
          {steps.map((s) => (
            <li key={s.label} className={s.time ? "" : "history-step-missing"}>
              <span className="history-step-label">{s.label}</span>
              <span>{s.time ? formatTime(s.time, true) : "Not recorded"}</span>
              {s.wait > 0 && <span className="history-step-wait">+{formatDuration(s.wait / 1000)}</span>}
            </li>
          ))}
        </ol>
        {order.completedAt && (
          <p className="history-total">
            Total time: <strong>{formatDuration((order.completedAt - order.placedAt) / 1000)}</strong>
          </p>
        )}

        <div className="dialog-actions">
          <button className="btn" onClick={recall}>
            Recall to Active
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ms, withSeconds = false) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: withSeconds ? "2-digit" : undefined });
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}
