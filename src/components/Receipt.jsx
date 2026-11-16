import { useEffect } from "react";
import { itemSummary } from "./CustomizeDialog.jsx";
import { itemPrice, TAX_RATE } from "../data/orders.js";
import { money } from "../data/store.js";
import "./Receipt.css";

//small popup receipt shown after checkout (kiosk and cashier)
export default function Receipt({ order, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div className="dialog receipt">
        <h2 id="receipt-title">Receipt</h2>
        <p className="receipt-meta">
          Order #{order.number} · {new Date(order.placedAt).toLocaleString()}
        </p>
        {order.customerName && <p className="receipt-meta">Customer: {order.customerName}</p>}

        <ul className="receipt-items">
          {order.items.map((item) => (
            <li key={item.cartId}>
              <div className="receipt-row">
                <strong>{item.quantity} × {item.name}</strong>
                <span>{money(itemPrice(item))}</span>
              </div>
              <div className="receipt-row muted small">
                <span>Base drink (each)</span><span>{money(item.basePrice)}</span>
              </div>
              {item.size.extra > 0 && (
                <div className="receipt-row muted small">
                  <span>{item.size.label} size (each)</span><span>+{money(item.size.extra)}</span>
                </div>
              )}
              {item.toppings.map((t) => (
                <div key={t.name} className="receipt-row muted small">
                  <span>{t.name} (each)</span><span>+{money(t.price)}</span>
                </div>
              ))}
              <div className="muted small">{itemSummary(item)}</div>
            </li>
          ))}
        </ul>

        <div className="receipt-row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        <div className="receipt-row">
          <span>Tax ({(TAX_RATE * 100).toFixed(2)}%)</span><span>{money(order.tax)}</span>
        </div>
        <div className="receipt-row receipt-total"><span>Total</span><span>{money(order.total)}</span></div>
        <p className="muted small">Paid by {order.payment}</p>

        <div className="dialog-actions">
          <button className="btn" onClick={() => window.print()}>Print</button>
          <button className="btn btn-primary" autoFocus onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}