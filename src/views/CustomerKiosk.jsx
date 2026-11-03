import { useState } from "react";
import { SHOP_NAME, CATEGORIES, getActiveMenu, MENU_KEYS } from "../data/menu.js";
import { placeOrder, itemPrice, orderTotals } from "../data/orders.js";
import { useLive, money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";
import OrderReview from "../components/OrderReview.jsx";

export default function CustomerKiosk() {
  const menu = useLive(getActiveMenu, MENU_KEYS);
  const categories = CATEGORIES.filter((c) => menu.some((d) => d.category === c));
  const [category, setCategory] = useState(categories[0]);
  
  const [search, setSearch] = useState("");

  const [customizing, setCustomizing] = useState(null); // drink being customized
  const [cart, setCart] = useState([]);
  const [reviewing, setReviewing] = useState(false); // showing the order review step
  const [confirmation, setConfirmation] = useState(null); // placed order number

  const { subtotal, tax, total } = orderTotals(cart);
  
  
  // Search all categories when typing; otherwise show the selected category.
  const searchTerm = search.trim().toLowerCase();

  const filteredMenu = menu.filter((drink) => {
    if (searchTerm) {
      return drink.name.toLowerCase().includes(searchTerm);
    }

    return drink.category === category;
  });


  function addToCart(item) {
    setCart([...cart, { ...item, cartId: crypto.randomUUID() }]);
    setCustomizing(null);
  }

  function changeQuantity(cartId, quantity) {
    if (quantity < 1) return;
    setCart(cart.map((i) => (i.cartId === cartId ? { ...i, quantity } : i)));
  }

  function removeFromCart(cartId) {
    setCart(cart.filter((i) => i.cartId !== cartId));
  }

  function checkout() {
    const order = placeOrder(cart, { source: "Kiosk" });
    setCart([]);
    setReviewing(false);
    setConfirmation(order.number);
  }

  if (reviewing) {
    return (
      <OrderReview
        cart={cart}
        onChangeQuantity={changeQuantity}
        onRemove={removeFromCart}
        onBack={() => setReviewing(false)}
        onConfirm={checkout}
      />
    );
  }

  if (confirmation) {
    return (
      <main className="kiosk kiosk-confirm">
        <h1>Thank you!</h1>
        <p>Your order number is</p>
        <p className="order-number" aria-live="polite">#{confirmation}</p>
        <p>We'll call your number when your drinks are ready.</p>
        <button className="btn btn-primary btn-lg" onClick={() => setConfirmation(null)}>
          Start a new order
        </button>
      </main>
    );
  }

  return (
    <div className="kiosk">
      <header className="kiosk-header">
        <h1>{SHOP_NAME}</h1>
        <p>Tap a drink to customize it</p>
      </header>
      
      <div className="kiosk-search">
        <label htmlFor="kiosk-drink-search">Search drinks</label>

        <div className="kiosk-search-controls">
          <input
            id="kiosk-drink-search"
            type="search"
            placeholder="Search for Taro, Mango, Milk Tea..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <button
              type="button"
              className="btn"
              onClick={() => setSearch("")}
            >
              Clear
            </button>
          )}
        </div>

        {searchTerm && (
          <p className="muted" role="status">
            {filteredMenu.length} {filteredMenu.length === 1 ? "drink" : "drinks"} found
          </p>
        )}
      </div>


      <nav className="category-tabs" aria-label="Menu categories">
        {categories.map((c) => (
          <button
            key={c}
            className={`tab ${c === category ? "tab-active" : ""}`}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </nav>

      <div className="kiosk-body">
        <section
          className="menu-grid"
          aria-label={searchTerm ? "Drink search results" : `${category} drinks`}
        >
          {filteredMenu.map((drink) => (

              <button key={drink.id} className="drink-card" onClick={() => setCustomizing(drink)}>
                <span className="drink-name">{drink.name}</span>
                <span className="drink-price">{money(drink.price)}</span>
              </button>
            ))}
            
          {filteredMenu.length === 0 && (
            <p className="kiosk-no-results">
              No drinks found. Try another search or clear your search.
            </p>
          )}

        </section>

        <aside className="cart" aria-label="Your order">
          <h2>Your Order</h2>
          {cart.length === 0 ? (
            <p className="muted">No drinks yet.</p>
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
                    <button
                      className="btn-link"
                      onClick={() => removeFromCart(item.cartId)}
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
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
          <button className="btn btn-primary btn-lg" disabled={cart.length === 0} onClick={() => setReviewing(true)}>
            Review Order
          </button>
        </aside>
      </div>

      {customizing && <CustomizeDialog drink={customizing} onAdd={addToCart} onCancel={() => setCustomizing(null)} />}
    </div>
  );
}
