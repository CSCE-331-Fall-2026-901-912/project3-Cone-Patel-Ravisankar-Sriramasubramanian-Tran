// Tiny shared store so every view sees the same data before the backend exists.
// Data lives in the browser's localStorage, so open views as tabs in the same
// browser. When the Express API is ready, the functions in menu.js,
// orders.js, inventory.js, and employees.js become fetch calls instead.
import { useEffect, useState } from "react";

export function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  // Tell views in this tab; other tabs get the browser's "storage" event.
  window.dispatchEvent(new CustomEvent("store-changed", { detail: key }));
}

// Re-run `getter` whenever any of the given storage keys change.
export function useLive(getter, keys) {
  const [value, setValue] = useState(getter);
  useEffect(() => {
    const refresh = () => setValue(getter());
    const onLocal = (e) => keys.includes(e.detail) && refresh();
    const onOtherTab = (e) => keys.includes(e.key) && refresh();
    window.addEventListener("store-changed", onLocal);
    window.addEventListener("storage", onOtherTab);
    return () => {
      window.removeEventListener("store-changed", onLocal);
      window.removeEventListener("storage", onOtherTab);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export const money = (n) => `$${n.toFixed(2)}`;
