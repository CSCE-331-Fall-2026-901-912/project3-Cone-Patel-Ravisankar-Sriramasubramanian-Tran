import { useState } from "react";
import { CATEGORIES, getActiveMenu, MENU_KEYS } from "../data/menu.js";
import { getEmployees, EMPLOYEE_KEYS } from "../data/employees.js";
import { placeOrder, itemPrice, orderTotals, getActiveOrders, ORDER_KEYS } from "../data/orders.js";
import { useLive, money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";

// Built for speed: every drink on one screen, grouped by category,
// with the current order always visible on the right.
export default function CashierScreen() {
  const menu = useLive(getActiveMenu, MENU_KEYS);
  const employees = useLive(getEmployees, EMPLOYEE_KEYS).filter((e) => e.active);
  const openOrders = useLive(getActiveOrders, ORDER_KEYS);

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [customizing, setCustomizing] = useState(null);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const { subtotal, tax, total } = orderTotals(cart);
  const employee = employees.find((e) => e.id === Number(employeeId));

const query = search.trim().toLowerCase();
const visibleMenu = query ? menu.filter((d) => d.name.toLowerCase().includes(query)) : menu;

  function addToCart(item) {
    setCart([...cart, { ...item, cartId: crypto.randomUUID() }]);
    setCustomizing(null);
  }

  function changeQuantity(cartId, amount) {
    setCart((current) => current
      .map((item) => item.cartId === cartId
        ? { ...item, quantity: item.quantity + amount }
        : item)
      .filter((item) => item.quantity > 0));
  }

  function charge(payment) {
    const order = placeOrder(cart, { source: "Cashier", employee: employee?.name ?? null, payment });
    setCart([]);
    setMessage(`Order #${order.number} sent to kitchen · ${payment} · ${money(order.total)}`);
    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="cashier">
      <header className="cashier-header">
        <h1>Cashier</h1>
        <div className="cashier-header-right">
          <span className="muted-light">{openOrders.length} orders in kitchen</span>
          <label className="employee-select">
            Employee
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="cashier-body">
        <section className="cashier-menu" aria-label="Menu">
          {CATEGORIES.filter((c) => menu.some((d) => d.category === c)).map((c) => (
            <div key={c} className="cashier-category">
              <h2>{c}</h2>
              <div className="cashier-grid">
                {menu
                  .filter((d) => d.category === c)
                  .map((drink) => (
                    <button key={drink.id} className="cashier-item" onClick={() => setCustomizing(drink)}>
                      <span>{drink.name}</span>
                      <span className="cashier-item-price">{money(drink.price)}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="cashier-order" aria-label="Current order">
          <div className="cashier-order-head">
            <h2>Current Order</h2>
            <button className="btn-link" disabled={cart.length === 0} onClick={() => setCart([])}>
              Clear
            </button>
          </div>

          {cart.length === 0 ? (
            <p className="muted">Select a drink to start an order.</p>
          ) : (
            <ul className="cart-list">
              {cart.map((item) => (
                <li key={item.cartId} className="cart-item">
                  <div>
                    <strong>
                      {item.quantity} × {item.name}
                    </strong>
                    <div className="muted small">{itemSummary(item)}</div>
                  </div>
                  <div className="cart-item-right">
                    <span>{money(itemPrice(item))}</span>
                    <span>
                      <span className="cart-quantity-controls" aria-label={`Quantity for ${item.name}`}>
                        <button type="button" className="btn qty-btn" onClick={() => changeQuantity(item.cartId, -1)} aria-label={`Decrease ${item.name} quantity`}>−</button>
                        <span className="qty" aria-live="polite">{item.quantity}</span>
                        <button type="button" className="btn qty-btn" onClick={() => changeQuantity(item.cartId, 1)} aria-label={`Increase ${item.name} quantity`}>+</button>
                      </span>
                      <button
                        className="btn-link"
                        onClick={() => setCart(cart.filter((i) => i.cartId !== item.cartId))}
                        aria-label={`Remove ${item.name}`}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="cart-lines">
            <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div><span>Tax</span><span>{money(tax)}</span></div>
          </div>
          <div className="cart-total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          <div className="pay-buttons">
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0} onClick={() => charge("Cash")}>
              Cash
            </button>
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0} onClick={() => charge("Card")}>
              Card
            </button>
          </div>
          <p className="cashier-message" role="status">
            {message}
          </p>
        </aside>
      </div>

      {customizing && <CustomizeDialog drink={customizing} onAdd={addToCart} onCancel={() => setCustomizing(null)} />}
    </div>
  );
}
