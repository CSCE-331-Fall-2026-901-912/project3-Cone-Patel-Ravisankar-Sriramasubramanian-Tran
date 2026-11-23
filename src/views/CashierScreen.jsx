import { useEffect, useState } from "react";
import { fetchMenu, fetchEmployees } from "../data/api.js";
import { placeOrder, itemPrice, orderTotals, getActiveOrders, ORDER_KEYS } from "../data/orders.js";
import { useLive, money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";
import Receipt from "../components/Receipt.jsx";
import ClockInOut from "../components/ClockInOut.jsx";

//built for speed: every drink on one screen, grouped by category
//with the current order always visible on the right
export default function CashierScreen() {
  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");

  //load the live menu from the backend
  useEffect(() => {
    const controller = new AbortController();
    fetchMenu(controller.signal)
      .then(setMenu)
      .catch((err) => err.name !== "AbortError" && setMenuError(err.message))
      .finally(() => setMenuLoading(false));
    return () => controller.abort();
  }, []);

  const categories = [...new Set(menu.map((d) => d.category))];
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState("");

  //load the real employees from the database for the cashier dropdown.
  useEffect(() => {
    fetchEmployees()
      .then((list) => {
        setEmployees(list);
        setEmployeeId((current) => current || list[0]?.id || "");
      })
      .catch((err) => setEmployeeError(err.message));
  }, []);

  const openOrders = useLive(getActiveOrders, ORDER_KEYS);

  const [employeeId, setEmployeeId] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  const { subtotal, tax, total } = orderTotals(cart);
  const employee = employees.find((e) => e.id === Number(employeeId));
  //close the payment confirmation with the Escape key
  useEffect(() => {
    if (!pendingPayment) return undefined;
    const onKey = (e) => e.key === "Escape" && setPendingPayment(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingPayment]);

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

  async function charge(payment) {
    if (submitting || cart.length === 0) return;
    setPendingPayment(null);
    setSubmitting(true);
    setOrderError("");
    try {
      const result = await placeOrder(cart, { source: "Cashier", employee: employee?.name ?? null, payment });
      setReceipt({ ...result, items: cart, payment, placedAt: Date.now() });
      setCart([]);
    } catch (error) {
      setOrderError(`Order not submitted: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
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
          <ClockInOut employee={employee} />
        </div>
      </header>

      <div className="cashier-body">
        <section className="cashier-menu" aria-label="Menu">
          <div className="cashier-search">
          <label htmlFor="cashier-search-input">Search drinks</label>
          <input
            id="cashier-search-input"
            type="search"
            placeholder="Type a drink name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="btn btn-small" onClick={() => setSearch("")}>Clear</button>
          )}
          </div>
          <p className="muted" role="status">
            {query && visibleMenu.length === 0 ? `No drinks match "${search.trim()}".` : ""}
          </p>
          {menuLoading && <p className="muted" role="status">Loading menu...</p>}
          {menuError && <p className="muted" role="alert">{menuError}</p>}
          {categories.filter((c) => visibleMenu.some((d) => d.category === c)).map((c) => (
            <div key={c} className="cashier-category">
              <h2>{c}</h2>
              <div className="cashier-grid">
                {visibleMenu
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
          {orderError && <p className="muted" role="alert">{orderError}</p>}
          <div className="pay-buttons">
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0 || submitting} onClick={() => setPendingPayment("Cash")}>
              Cash
            </button>
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0 || submitting} onClick={() => setPendingPayment("Card")}>
              Card
            </button>
          </div>
        </aside>
      </div>
      {pendingPayment && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="dialog dialog-compact">
            <h2 id="confirm-title">Confirm {pendingPayment} payment</h2>
            <p>
              {cart.reduce((n, i) => n + i.quantity, 0)} item(s) · <strong>{money(total)}</strong> by {pendingPayment.toLowerCase()}. Send this order to the kitchen?
            </p>
            <div className="dialog-actions">
              <button className="btn" autoFocus onClick={() => setPendingPayment(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => charge(pendingPayment)}>Confirm {pendingPayment}</button>
            </div>
          </div>
        </div>
      )}
      {customizing && <CustomizeDialog drink={customizing} onAdd={addToCart} onCancel={() => setCustomizing(null)} />}
      {receipt && <Receipt order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
