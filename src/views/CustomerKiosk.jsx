import { useEffect, useRef, useState } from "react";
import { SHOP_NAME } from "../data/menu.js";
import { placeOrder, itemPrice, orderTotals } from "../data/orders.js";
import { useLive, money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";
import OrderReview from "../components/OrderReview.jsx";

export default function CustomerKiosk() {
  const [menu, setMenu] = useState([]);
const [category, setCategory] = useState("");
const [loading, setLoading] = useState(true);
const [menuError, setMenuError] = useState("");
const [drinkImages, setDrinkImages] = useState({});
const [search, setSearch] = useState("");
const requestedImages = useRef(new Set());

const categories = [...new Set(menu.map((drink) => drink.category))];

useEffect(() => {
  const controller = new AbortController();

  async function fetchMenu() {
    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3001";

      const response = await fetch(`${API_URL}/api/menu`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to load menu");
      }

      const data = await response.json();

      // Convert PostgreSQL fields to the format used by the kiosk.
      const formattedMenu = data.items
        .filter((item) => item.availability)
        .map((item) => ({
          id: item.menu_id,
          name: item.item_name,
          category: item.category,
          price: Number(item.price),
          active: item.availability,
        }));

      setMenu(formattedMenu);

      setCategory((current) =>
        formattedMenu.some((item) => item.category === current)
          ? current
          : formattedMenu[0]?.category ?? ""
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Menu API error:", error);
        setMenuError("Unable to load menu. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  fetchMenu();

  return () => controller.abort();
}, []);



useEffect(() => {
  if (menu.length === 0) return;

  const controller = new AbortController();
  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3001";

  const searchTerm = search.trim().toLowerCase();

  const visibleDrinks = menu.filter((drink) =>
    searchTerm
      ? drink.name.toLowerCase().includes(searchTerm)
      : drink.category === category
  );

  async function fetchImages() {
    for (const drink of visibleDrinks) {
    if (controller.signal.aborted) break;

    if (requestedImages.current.has(drink.id)) continue;

    requestedImages.current.add(drink.id);

    try {
        const response = await fetch(
          `${API_URL}/api/images?query=${encodeURIComponent(drink.name)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          requestedImages.current.delete(drink.id);
          continue;
        }

        const image = await response.json();

        if (controller.signal.aborted) {
            requestedImages.current.delete(drink.id);
            break;
          }

          setDrinkImages((current) => ({
            ...current,
            [drink.id]: image,
          }));
      } catch (error) {
  requestedImages.current.delete(drink.id);

  if (error.name === "AbortError") break;

  console.error(`Image error for ${drink.name}:`, error);
}
    }
  }

  fetchImages();

  return () => controller.abort();
}, [menu, category, search]);



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

      {loading && <p role="status">Loading menu...</p>}
      {menuError && <p role="alert">{menuError}</p>}


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


<div key={drink.id} className="drink-card-wrapper">
  <button
    type="button"
    className="drink-card"
    onClick={() => setCustomizing(drink)}
  >
    <div className="drink-image-container">
      {drinkImages[drink.id]?.imageUrl ? (
        <img
          src={drinkImages[drink.id].imageUrl}
          alt={drinkImages[drink.id].alt || drink.name}
          className="drink-image"
          loading="lazy"
        />
      ) : (
        <div className="drink-image-placeholder" aria-hidden="true">
          🧋
        </div>
      )}
    </div>

    <div className="drink-card-info">
      <span className="drink-name">{drink.name}</span>
      <span className="drink-price">{money(drink.price)}</span>
    </div>
  </button>

  {drinkImages[drink.id]?.imageUrl && (
    <div className="drink-photo-credit">
      Photo by{" "}
      <a
        href={drinkImages[drink.id].photographerUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {drinkImages[drink.id].photographer}
      </a>
      {" on "}
      <a
        href={drinkImages[drink.id].unsplashUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Unsplash
      </a>
    </div>
  )}
</div>

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
