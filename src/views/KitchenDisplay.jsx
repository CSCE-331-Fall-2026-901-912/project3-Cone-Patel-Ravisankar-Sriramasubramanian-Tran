import { useEffect, useState } from "react";
import { getActiveOrders, getRecentlyReady, updateStatus, ORDER_KEYS } from "../data/orders.js";
import { useLive } from "../data/store.js";

// Shows every order that still needs to be made, oldest first.
// Staff tap "Start" when they begin a ticket and "Mark Ready" when it's done.
export default function KitchenDisplay() {
  const orders = useLive(getActiveOrders, ORDER_KEYS);
  const ready = useLive(getRecentlyReady, ORDER_KEYS);
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

      {orders.length === 0 ? (
        <p className="kitchen-empty">No orders right now. New orders from the kiosk and cashier appear here automatically.</p>
      ) : (
        <section className="ticket-grid" aria-label="Open orders" aria-live="polite">
          {orders.map((order) => (
            <Ticket key={order.number} order={order} now={now} />
          ))}
        </section>
      )}

      {ready.length > 0 && (
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
  
  const [showConfirmation, setShowConfirmation] = useState(false);

  function confirmReady() {
    updateStatus(order.number, "ready");
    setShowConfirmation(false);
  }


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
        <button
          className="btn btn-success btn-block"
          onClick={() => setShowConfirmation(true)}
        >
          Mark Ready
        </button>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => updateStatus(order.number, "in-progress")}>
          Start
        </button>
      )}
      
      {showConfirmation && (
        <div
          className="kitchen-confirm-overlay"
          role="presentation"
          onClick={() => setShowConfirmation(false)}
        >
          <div
            className="kitchen-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`confirm-ready-${order.number}`}
            aria-describedby={`confirm-ready-description-${order.number}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`confirm-ready-${order.number}`}>
              Complete Order #{order.number}?
            </h2>

            <p id={`confirm-ready-description-${order.number}`}>
              Are you sure this order is finished and ready for pickup?
            </p>

            <div className="kitchen-confirm-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={confirmReady}
              >
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}

    </article>
  );
}
