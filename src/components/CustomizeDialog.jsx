import { useState } from "react";
import { SIZES, SUGAR_LEVELS, ICE_LEVELS, TOPPINGS } from "../data/menu.js";
import { itemPrice } from "../data/orders.js";
import { money } from "../data/store.js";

// Size / sugar / ice / toppings / quantity picker, shared by the Kiosk and Cashier.
export default function CustomizeDialog({
  drink,
  onAdd,
  onCancel,
  compact = false,
  t = (text) => text,
}) {
  const [size, setSize] = useState(SIZES[0]);
  const [sugar, setSugar] = useState("100%");
  const [ice, setIce] = useState("Regular Ice");
  const [toppings, setToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);

  const item = { drinkId: drink.id, name: drink.name, basePrice: drink.price, size, sugar, ice, toppings, quantity };

  function toggleTopping(t) {
    setToppings(toppings.some((x) => x.name === t.name) ? toppings.filter((x) => x.name !== t.name) : [...toppings, t]);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="customize-title">
      <div className={`dialog ${compact ? "dialog-compact" : ""}`}>
        <h2 id="customize-title">{t(drink.name)}</h2>

        <OptionGroup label={t("Size")}>
          {SIZES.map((s) => (
            <Choice key={s.label} selected={size.label === s.label} onClick={() => setSize(s)}>
              {t(s.label)}
              {s.extra > 0 && ` (+${money(s.extra)})`}
            </Choice>
          ))}
        </OptionGroup>

        <OptionGroup label={t("Sugar")}>
          {SUGAR_LEVELS.map((s) => (
            <Choice key={s} selected={sugar === s} onClick={() => setSugar(s)}>
              {t(s)}
            </Choice>
          ))}
        </OptionGroup>

        <OptionGroup label={t("Ice")}>
          {ICE_LEVELS.map((i) => (
            <Choice key={i} selected={ice === i} onClick={() => setIce(i)}>
              {t(i)}
            </Choice>
          ))}
        </OptionGroup>

        <OptionGroup label={t("Toppings (choose any)")}>
          {TOPPINGS.map((topping) => (
            <Choice
              key={topping.name}
              selected={toppings.some((x) => x.name === topping.name)}
              onClick={() => toggleTopping(topping)}
            >
              {t(topping.name)} (+{money(topping.price)})
            </Choice>
          ))}
        </OptionGroup>

        <div className="qty-row">
          <span className="option-label">{t("Quantity")}</span>
          <button className="btn qty-btn" aria-label={t("Decrease quantity")} onClick={() => setQuantity(Math.max(1, quantity - 1))}>
            −
          </button>
          <span className="qty" aria-live="polite">
            {quantity}
          </span>
          <button className="btn qty-btn" aria-label={t("Increase quantity")} onClick={() => setQuantity(quantity + 1)}>
            +
          </button>
        </div>

        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button className="btn btn-primary" onClick={() => onAdd(item)}>
            {t("Add to Order")} · {money(itemPrice(item))}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionGroup({ label, children }) {
  return (
    <fieldset className="option-group">
      <legend className="option-label">{label}</legend>
      <div className="choices">{children}</div>
    </fieldset>
  );
}

function Choice({ selected, onClick, children }) {
  return (
    <button type="button" className={`choice ${selected ? "choice-selected" : ""}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

// One line per cart item, shared by the Kiosk and Cashier order panels.
export function itemSummary(item, t = (text) => text) {
  const parts = [
    t(item.size.label),
    `${item.sugar} ${t("sugar")}`,
    t(item.ice),
    ...item.toppings.map((topping) => t(topping.name)),
  ];

  return parts.join(" · ");
}
