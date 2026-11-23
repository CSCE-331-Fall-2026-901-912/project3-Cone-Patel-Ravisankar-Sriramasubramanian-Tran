import { useEffect, useState } from "react";
import { SHOP_NAME } from "../data/menu.js";
import { placeOrder, itemPrice, orderTotals } from "../data/orders.js";
import { money } from "../data/store.js";
import CustomizeDialog, { itemSummary } from "../components/CustomizeDialog.jsx";
import OrderReview from "../components/OrderReview.jsx";
import { WeatherBanner } from "../components/Weather.jsx";

const DRINK_IMAGES = {
  "Classic Black Tea": "/images/classic-black-tea.png",
  "Classic Green Tea": "/images/classic-green-tea.png",
  "Classic Milk Tea": "/images/classic-milk-tea.png",
  "Classic Pearl Milk Tea": "/images/classic-pearl-milk-tea.png",
  "Coffee Milk Tea": "/images/coffee-milk-tea.png",
  "Cupid's Kiss": "/images/cupids-kiss.png",
  "Honey Milk Tea": "/images/honey-milk-tea.png",
  "Lemon Green Tea": "/images/lemon-green-tea.png",
  "Lotus Pond": "/images/lotus-pond.png",
  "Mango Green Tea": "/images/mango-green-tea.png",
  "Mango Ice Blended": "/images/mango-ice-blended.png",
  "Matcha Milk Tea": "/images/matcha-milk-tea.png",
  "Matcha Red Bean Ice Blended": "/images/matcha-red-bean-ice-blended.png",
  "Oolong Tea": "/images/oolong-tea.png",
  "Oreo Ice Blended": "/images/oreo-ice-blended.png",
  "Passion Fruit Green Tea": "/images/passion-fruit-green-tea.png",
  "Peach Green Tea": "/images/peach-green-tea.png",
  "Pumpkin Coffee": "/images/pumpkin-coffee.png",
  "Pumpkin Spice Milk Tea": "/images/pumpkin-spice-milk-tea.png",
  "Strawberry Green Tea": "/images/strawberry-green-tea.png",
  "Taro Ice Blended": "/images/taro-ice-blended.png",
  "Taro Pearl Milk Tea": "/images/taro-pearl-milk-tea.png",
  "Thai Pearl Milk Tea": "/images/thai-pearl-milk-tea.png",
  "Tropical Paradise": "/images/tropical-paradise.png",
  "Wintermelon Tea": "/images/wintermelon-tea.png",
};

function normalizeDrinkName(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const DRINK_IMAGES_BY_NAME = Object.fromEntries(
  Object.entries(DRINK_IMAGES).map(([name, image]) => [
    normalizeDrinkName(name),
    image,
  ])
);

export default function CustomerKiosk() {
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("EN");
  const [translations, setTranslations] = useState({});
  const [translationLoading, setTranslationLoading] = useState(false);

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
    "Unknown",
    "Rainy day? Warm up with a cozy milk tea.",
    "It's hot out! Cool off with an iced fruit tea.",
    "Chilly today. A warm milk tea hits the spot.",
    "Perfect weather for a classic milk tea.",
    "Translating...",

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

    const existing = translations[language] || {};
    const missingTexts = uniqueTexts.filter((text) => !existing[text]);
    const batchSize = 50;
    let failedCount = 0;

    try {
      for (let i = 0; i < missingTexts.length; i += batchSize) {
        if (cancelled) return;

        const batch = missingTexts.slice(i, i + batchSize);

        try {
          const response = await fetch(`${API_URL}/api/translate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: batch,
              targetLang: language,
            }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(
              data.error || `Translation failed (HTTP ${response.status})`
            );
          }

          const data = await response.json();
          if (
            !Array.isArray(data.translations) ||
            data.translations.length !== batch.length
          ) {
            throw new Error(
              "Translation response did not match the requested batch."
            );
          }

          const translatedEntries = data.translations.map((item, index) => {
            if (
              item.text !== batch[index] ||
              typeof item.translatedText !== "string" ||
              !item.translatedText.trim()
            ) {
              throw new Error(`No translation returned for "${batch[index]}".`);
            }

            return [batch[index], item.translatedText];
          });

          if (!cancelled) {
            setTranslations((current) => ({
              ...current,
              [language]: {
                ...current[language],
                ...Object.fromEntries(translatedEntries),
              },
            }));
          }
        } catch (error) {
          if (cancelled) return;
          failedCount += batch.length;
          console.error(`Translation batch failed for ${language}:`, error);
        }
      }

      if (failedCount > 0) {
        console.warn(`${failedCount} translations failed for ${language}`);
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



  const [customizing, setCustomizing] = useState(null); // drink being customized
  const [cart, setCart] = useState([]);
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
        #{confirmation}
      </p>

      <p>{t("We'll call your number when your drinks are ready.")}</p>

      <button
        className="btn btn-primary btn-lg"
        onClick={() => setConfirmation(null)}
      >
        {t("Start a new order")}
      </button>
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

      {translationLoading && (
        <p className="muted small" role="status" aria-live="polite">
          {t("Translating...")}
        </p>
      )}

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
          {filteredMenu.map((drink) => {
            const imagePath = DRINK_IMAGES_BY_NAME[normalizeDrinkName(drink.name)];

            return (
<div key={drink.id} className="drink-card-wrapper">
  <button
    type="button"
    className="drink-card"
    onClick={() => setCustomizing(drink)}
  >
    <div className="drink-image-container">
      {imagePath ? (
        <img
          src={imagePath}
          alt={t(drink.name)}
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
</div>
            );
          })}

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
