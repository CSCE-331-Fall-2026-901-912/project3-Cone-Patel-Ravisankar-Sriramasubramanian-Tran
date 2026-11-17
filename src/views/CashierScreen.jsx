import { useEffect, useState } from "react";
import { fetchMenu } from "../data/api.js";
import { CATEGORIES } from "../data/menu.js";
import { getEmployees, EMPLOYEE_KEYS } from "../data/employees.js";
import { placeOrder, itemPrice, orderTotals, getActiveOrders, ORDER_KEYS } from "../data/orders.js";
import { useLive, money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";
import Receipt from "../components/Receipt.jsx";

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
  const [menuError, setMenuError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const api = import.meta.env.VITE_API_URL || "http://localhost:3001";
    fetch(`${api}/api/menu`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Cannot load menu");
        return result;
      })
      .then((result) => setMenu(result.items.filter((item) => item.availability).map((item) => ({
        id: item.menu_id, name: item.item_name, category: item.category,
        price: Number(item.price), active: true,
      }))))
      .catch((error) => { if (error.name !== "AbortError") setMenuError(error.message); });
    return () => controller.abort();
  }, []);
  const employees = useLive(getEmployees, EMPLOYEE_KEYS).filter((e) => e.active);
  const openOrders = useLive(getActiveOrders, ORDER_KEYS);

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [customizing, setCustomizing] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  function charge(payment) {
    setPendingPayment(null);
    const order = placeOrder(cart, { source: "Cashier", employee: employee?.name ?? null, payment });
    setCart([]);
    setReceipt(order);
  async function charge(payment) {
    if (submitting || cart.length === 0) return;
    setSubmitting(true);
    setMessage("");
    try {
      const order = await placeOrder(cart, { source: "Cashier", employee: employee?.name ?? null, payment });
      setCart([]);
      setMessage(`Order #${order.number} sent to kitchen · ${payment} · ${money(order.total)}`);
    } catch (error) {
      setMessage(`Order not submitted: ${error.message}`);
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
          {menuError && <p role="alert">Menu unavailable: {menuError}</p>}
          {[...new Set([...CATEGORIES, ...visibleMenu.map((d) => d.category)])].filter((c) => visibleMenu.some((d) => d.category === c)).map((c) => (
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
          <div className="pay-buttons">
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0} onClick={() => setPendingPayment("Cash")}>
              Cash
            </button>
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0} onClick={() => setPendingPayment("Card")}>
              Card
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0 || submitting} onClick={() => charge("Cash")}>
              {submitting ? "Submitting…" : "Cash"}
            </button>
            <button className="btn btn-primary btn-lg" disabled={cart.length === 0 || submitting} onClick={() => charge("Card")}>
              {submitting ? "Submitting…" : "Card"}
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
