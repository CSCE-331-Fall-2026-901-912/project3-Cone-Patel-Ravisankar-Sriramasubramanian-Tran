import { useEffect, useRef, useState } from "react";
import { SHOP_NAME } from "../data/menu.js";
import { placeOrder, itemPrice, orderTotals } from "../data/orders.js";
import { useLive, money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";
import OrderReview from "../components/OrderReview.jsx";
import Receipt from "../components/Receipt.jsx";
import { useCurrentUser } from "../data/auth.js";
import { WeatherBanner } from "../components/Weather.jsx";

export default function CustomerKiosk() {
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [drinkImages, setDrinkImages] = useState({});
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("EN");
  const [translations, setTranslations] = useState({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const requestedImages = useRef(new Set());

  const categories = [...new Set(menu.map((drink) => drink.category))];

  // Display translated text when available.
  // Keep the original English text as a fallback.
  function t(text) {
    if (language === "EN") return text;

    return translations[language]?.[text] || text;
  }

  // Fetch translations when the selected language changes.
useEffect(() => {
  if (language === "EN" || menu.length === 0) {
    setTranslationLoading(false);
    return;
  }

  let cancelled = false;

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3001";

  // All text we want to translate.
  const texts = [
    // Header and search
    "Tap a drink to customize it",
    "Language:",
    "Search drinks",
    "Search for Taro, Mango, Milk Tea...",
    "Clear",
    "drink",
    "drinks",
    "found",
    "Loading menu...",
    "No drinks found. Try another search or clear your search.",

    // Cart
    "Your Order",
    "No drinks yet.",
    "Remove",
    "Subtotal",
    "Tax",
    "Total",
    "Review Order",

    // Customization popup

    "Size",
    "Regular",
    "Large",
    "Sugar",
    "Ice",
    "No Ice",
    "Less Ice",
    "Regular Ice",
    "Extra Ice",
    "Toppings (choose any)",
    "Boba",
    "Lychee Jelly",
    "Pudding",
    "Cheese Foam",
    "Red Bean",
    "Quantity",
    "Decrease quantity",
    "Increase quantity",
    "Cancel",
    "Add to Order",
    "sugar",

    // Review Order page
    "Review Your Order",
    "Check your drinks before you place your order.",
    "Your order is empty.",
    "Back to Menu",
    "Drinks in your order",
    "each",
    "Summary",
    "Confirm & Place Order",
    "Quantity of",
    "Decrease quantity of",
    "Increase quantity of",
    "Order total",

    // Weather banner
    "Today's weather",
    "Clear",
    "Partly cloudy",
    "Cloudy",
    "Foggy",
    "Drizzle",
    "Rain",
    "Snow",
    "Thunderstorms",
    "Rainy day? Warm up with a cozy milk tea.",
    "It's hot out! Cool off with an iced fruit tea.",
    "Chilly today. A warm milk tea hits the spot.",
    "Perfect weather for a classic milk tea.",

    // Confirmation page
    "Thank you!",
    "Your order number is",
    "We'll call your number when your drinks are ready.",
    "Start a new order",

    // Menu categories and drink names
    ...menu.map((drink) => drink.name),
    ...menu.map((drink) => drink.category),
  ];

  const uniqueTexts = [...new Set(texts)];

  async function fetchTranslations() {
    setTranslationLoading(true);

    try {
      // Reuse translations already fetched.
      const existing = translations[language] || {};

      const missingTexts = uniqueTexts.filter(
        (text) => !existing[text]
      );

      // Translate in small batches to avoid overwhelming DeepL.
const successfulTranslations = [];
let failedCount = 0;
const batchSize = 5;

for (let i = 0; i < missingTexts.length; i += batchSize) {
  if (cancelled) return;

  const batch = missingTexts.slice(i, i + batchSize);

  const results = await Promise.allSettled(
    batch.map(async (text) => {
      const response = await fetch(`${API_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          targetLang: language,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Translation failed: ${text} (HTTP ${response.status})`
        );
      }

      const data = await response.json();
      return [text, data.translatedText];
    })
  );

  const successful = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  successfulTranslations.push(...successful);

  failedCount += results.filter(
    (result) => result.status === "rejected"
  ).length;

  // Display successful translations as each batch finishes.
  if (!cancelled && successful.length > 0) {
    setTranslations((current) => ({
      ...current,
      [language]: {
        ...current[language],
        ...Object.fromEntries(successful),
      },
    }));
  }
}

if (failedCount > 0) {
  console.warn(`${failedCount} translations failed for ${language}`);
}
      if (cancelled) return;

      setTranslations((current) => ({
        ...current,
        [language]: {
          ...current[language],
          ...Object.fromEntries(successfulTranslations),
        },
      }));
    } catch (error) {
      if (!cancelled) {
        console.error("Translation API error:", error);
      }
    } finally {
      if (!cancelled) {
        setTranslationLoading(false);
      }
    }
  }

  fetchTranslations();

  return () => {
    cancelled = true;
  };
}, [language, menu]);

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



  const [customizing, setCustomizing] = useState(null); //drink being customized
  const [cart, setCart] = useState([]);
  const [reviewing, setReviewing] = useState(false); //showing the order review step
  const [confirmation, setConfirmation] = useState(null); //the placed order, shown after checkout
  const [showReceipt, setShowReceipt] = useState(false);
  const user = useCurrentUser(); //logged-in customer, if any
  const [reviewing, setReviewing] = useState(false); // showing the order review step
  const [confirmation, setConfirmation] = useState(null); // placed order number
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  function checkout() {
    const order = placeOrder(cart, { source: "Kiosk", customerName: user?.name ?? null });
    setCart([]);
    setReviewing(false);
    setConfirmation(order);
    setShowReceipt(true);
  }

  function removeFromCart(cartId) {
    setCart(cart.filter((i) => i.cartId !== cartId));
  function removeFromCart(cartId) {
    setCart(cart.filter((i) => i.cartId !== cartId));
  }

  async function checkout() {
    if (submitting || cart.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const order = await placeOrder(cart, { source: "Kiosk" });
      setCart([]);
      setReviewing(false);
      setConfirmation(order.number);
    } catch (error) {
      setSubmitError(`Order not submitted: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewing) {
    return (
      <OrderReview
        cart={cart}
        onChangeQuantity={changeQuantity}
        onRemove={removeFromCart}
        onBack={() => setReviewing(false)}
        onConfirm={checkout}
        submitting={submitting}
        submitError={submitError}
        t={t}
      />
    );
  }

  if (confirmation) {
  return (
    <main className="kiosk kiosk-confirm">
      <h1>{t("Thank you!")}</h1>
      <p>{t("Your order number is")}</p>

      <p className="order-number" aria-live="polite">
        #{confirmation.number}
      </p>

      <p>{t("We'll call your number when your drinks are ready.")}</p>

      <button
        className="btn btn-primary btn-lg"
        onClick={() => setConfirmation(null)}
      >
        {t("Start a new order")}
      </button>
      {showReceipt && <Receipt order={confirmation} onClose={() => setShowReceipt(false)} />}
    </main>
  );
}

  return (
    <div className="kiosk">
      <header className="kiosk-header">
        <h1>{SHOP_NAME}</h1>
        <p>{t("Tap a drink to customize it")}</p>

        <div className="kiosk-language">
          <label htmlFor="kiosk-language-select">
            {t("Language:")}
          </label>

          <select
            id="kiosk-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="EN">{t("English")}</option>
            <option value="ES">{t("Español")}</option>
            <option value="FR">{t("Français")}</option>
            <option value="DE">{t("Deutsch")}</option>
            <option value="JA">{t("日本語")}</option>
            <option value="ZH">{t("中文")}</option>
          </select>
        </div>
      </header>

      <WeatherBanner t={t} />

      <div className="kiosk-search">
        <label htmlFor="kiosk-drink-search">{t("Search drinks")}</label>

        <div className="kiosk-search-controls">
          <input
            id="kiosk-drink-search"
            type="search"
            placeholder={t("Search for Taro, Mango, Milk Tea...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <button
              type="button"
              className="btn"
              onClick={() => setSearch("")}
            >
              {t("Clear")}
            </button>
          )}
        </div>

        {searchTerm && (
          <p className="muted" role="status">
            {filteredMenu.length} {t(filteredMenu.length === 1 ? "drink" : "drinks")} {t("found")}
          </p>
        )}
      </div>

      {loading && <p role="status">{t("Loading menu...")}</p>}
      {menuError && <p role="alert">{menuError}</p>}


      <nav className="category-tabs" aria-label={t("Menu categories")}>
        {categories.map((c) => (
          <button
            key={c}
            className={`tab ${c === category ? "tab-active" : ""}`}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            {t(c)}
          </button>
        ))}
      </nav>

      <div className="kiosk-body">
        <section
          className="menu-grid"
          aria-label={searchTerm ? t("Drink search results") : `${t(category)} ${t("drinks")}`}
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
      <span className="drink-name">{t(drink.name)}</span>
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
              {t("No drinks found. Try another search or clear your search.")}
            </p>
          )}

        </section>

        <aside className="cart" aria-label={t("Your order")}>
          <h2>{t("Your Order")}</h2>
          {cart.length === 0 ? (
            <p className="muted">{t("No drinks yet.")}</p>
          ) : (
            <ul className="cart-list">
              {cart.map((item) => (
                <li key={item.cartId} className="cart-item">
                  <div>
                    <strong>
                      {item.quantity} × {t(item.name)}
                    </strong>
                    <div className="muted small">{itemSummary(item, t)}</div>
                  </div>
                  <div className="cart-item-right">
                    <span>{money(itemPrice(item))}</span>
                    <button
                      className="btn-link"
                      onClick={() => removeFromCart(item.cartId)}
                      aria-label={`${t("Remove")} ${t(item.name)}`}
                    >
                      {t("Remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="cart-lines">
            <div><span>{t("Subtotal")}</span><span>{money(subtotal)}</span></div>
            <div><span>{t("Tax")}</span><span>{money(tax)}</span></div>
          </div>
          <div className="cart-total">
            <span>{t("Total")}</span>
            <span>{money(total)}</span>
          </div>
          <button className="btn btn-primary btn-lg" disabled={cart.length === 0} onClick={() => setReviewing(true)}>
            {t("Review Order")}
          </button>
        </aside>
      </div>

      {customizing && (
  <CustomizeDialog
    drink={customizing}
    onAdd={addToCart}
    onCancel={() => setCustomizing(null)}
    t={t}
  />
)}
    </div>
  );
}
