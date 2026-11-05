import { useEffect, useRef, useState } from "react";
import { getActiveOrders, getRecentlyReady, getCompletedOrders, updateStatus, ORDER_KEYS } from "../data/orders.js";
import { useLive } from "../data/store.js";
import KitchenHistory from "../components/KitchenHistory.jsx";

export default function KitchenDisplay() {
  const orders = useLive(getActiveOrders, ORDER_KEYS);
  const ready = useLive(getRecentlyReady, ORDER_KEYS);
  const completedCount = useLive(getCompletedOrders, ORDER_KEYS).length;
  const totalOpen = orders.length;
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inProgressOrders = orders.filter(
    (order) => order.status === "in-progress"
  ).length;
  const [tab, setTab] = useState("active"); // "active" or "history"
  
  // SCRUM-46: Kitchen sound notifications
  const [soundEnabled, setSoundEnabled] = useState(
  () => localStorage.getItem("kitchenSoundEnabled") === "true"
);
  const audioContextRef = useRef(null);
  const previousOrdersRef = useRef(null);

  // Enable or disable notification sounds.
  
async function toggleSound() {
  if (soundEnabled) {
    setSoundEnabled(false);
    localStorage.setItem("kitchenSoundEnabled", "false");
    return;
  }

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    alert("Sound notifications are not supported in this browser.");
    return;
  }

  try {
    const context = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = context;

    await context.resume();

    setSoundEnabled(true);
    localStorage.setItem("kitchenSoundEnabled", "true");
  } catch (error) {
    console.error("Could not enable kitchen sound:", error);
    alert("Could not enable sound notifications.");
  }
}


  // Play a short two-tone notification.
  function playNotification() {
    const context = audioContextRef.current;

    if (!context || context.state !== "running") return;

    [0, 0.18].forEach((delay) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;

      oscillator.type = "sine";
      oscillator.frequency.value = 850;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }

  // Detect newly arriving orders.
  useEffect(() => {
    const currentOrders = new Set(orders.map((order) => order.number));

    // On first load, remember existing orders without making a sound.
    if (previousOrdersRef.current === null) {
      previousOrdersRef.current = currentOrders;
      return;
    }

    const hasNewOrder = orders.some(
      (order) =>
        order.status === "new" &&
        !previousOrdersRef.current.has(order.number)
    );

    if (hasNewOrder && soundEnabled) {
      playNotification();
    }

    previousOrdersRef.current = currentOrders;
  }, [orders, soundEnabled]);

  // Release audio resources when the kitchen component closes.
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const [now, setNow] = useState(Date.now());
  const [sortBy, setSortBy] = useState("longest");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredOrders = orders.filter((order) => {
    if (statusFilter === "all") return true;
    return order.status === statusFilter;
  });
  const sortedOrders = [...filteredOrders].sort((a, b) => {
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
  <div>
    <h1>Kitchen Display</h1>
    <p>
      {orders.length} open {orders.length === 1 ? "order" : "orders"}
    </p>
  </div>

  <button
    className="btn"
    type="button"
    onClick={toggleSound}
    aria-pressed={soundEnabled}
  >
    {soundEnabled ? "🔔 Sound On" : "🔕 Enable Sound"}
  </button>
</header>

      <section className="kitchen-summary" aria-label="Kitchen order summary">
        <div className="kitchen-summary-card">
          <span className="kitchen-summary-label">Total Open</span>
          <strong className="kitchen-summary-value">{totalOpen}</strong>
        </div>

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
          <div className="kitchen-controls">
            <div className="kitchen-filter">
              <label htmlFor="kitchen-status-filter">
                Filter by status:
              </label>

              <select
                id="kitchen-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Active</option>
                <option value="new">New</option>
                <option value="in-progress">In Progress</option>
              </select>
            </div>

            <div className="kitchen-sort">
              <label htmlFor="kitchen-sort-select">
                Sort orders by:
              </label>

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
          </div>
        )}
      </div>

      {tab === "history" ? (
        <KitchenHistory />
      ) : filteredOrders.length === 0 ? (
        <p className="kitchen-empty">
          No orders match the selected status.
        </p>
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
