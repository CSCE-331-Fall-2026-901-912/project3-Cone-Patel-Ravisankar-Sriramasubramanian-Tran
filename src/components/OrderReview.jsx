import { useEffect, useRef } from "react";
import { itemPrice, orderTotals } from "../data/orders.js";
import { money } from "../data/store.js";
import { itemSummary } from "./CustomizeDialog.jsx";
import "./OrderReview.css";

// Full-screen review step the kiosk shows between "Review Order" and placing it.
// Customers can change quantities, remove drinks, go back to add more, or confirm.
export default function OrderReview({ cart, onChangeQuantity, onRemove, onBack, onConfirm }) {
  const headingRef = useRef(null);
  const { subtotal, tax, total } = orderTotals(cart);
  const drinkCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Move keyboard and screen-reader focus to the heading when this step opens.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="kiosk review">
      <header className="kiosk-header">
        <h1 ref={headingRef} tabIndex={-1}>
          Review Your Order
        </h1>
        <p>Check your drinks before you place your order.</p>
      </header>

      <div className="review-body">
        {cart.length === 0 ? (
          <section className="review-empty" aria-live="polite">
            <p>Your order is empty.</p>
            <button className="btn btn-primary btn-lg" onClick={onBack}>
              Back to Menu
            </button>
          </section>
        ) : (
          <>
            <section className="review-items" aria-label="Drinks in your order">
              <ul>
                {cart.map((item) => (
                  <li key={item.cartId} className="review-item">
                    <div className="review-item-info">
                      <h2>{item.name}</h2>
                      <p className="review-item-details">{itemSummary(item)}</p>
                      <p className="review-item-each">{money(itemPrice({ ...item, quantity: 1 }))} each</p>
                    </div>

                    <div className="review-qty" role="group" aria-label={`Quantity of ${item.name}`}>
                      <button
                        className="btn review-qty-btn"
                        onClick={() => onChangeQuantity(item.cartId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </button>
                      <span className="review-qty-value" aria-live="polite">
                        {item.quantity}
                      </span>
                      <button
                        className="btn review-qty-btn"
                        onClick={() => onChangeQuantity(item.cartId, item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="review-item-right">
                      <span className="review-item-price">{money(itemPrice(item))}</span>
                      <button className="btn-link" onClick={() => onRemove(item.cartId)} aria-label={`Remove ${item.name}`}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="review-summary" aria-label="Order total">
              <h2>Summary</h2>
              <p className="review-count">
                {drinkCount} {drinkCount === 1 ? "drink" : "drinks"}
              </p>
              <div className="cart-lines">
                <div>
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div>
                  <span>Tax</span>
                  <span>{money(tax)}</span>
                </div>
              </div>
              <div className="cart-total" aria-live="polite">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
              <button className="btn btn-primary btn-lg" onClick={onConfirm}>
                Confirm &amp; Place Order
              </button>
              <button className="btn btn-lg review-back" onClick={onBack}>
                Back to Menu
              </button>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
