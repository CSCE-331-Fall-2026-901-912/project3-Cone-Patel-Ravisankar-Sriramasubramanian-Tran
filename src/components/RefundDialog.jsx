import { useEffect, useRef, useState } from "react";
import { refundOrder } from "../data/orders.js";
import { money } from "../data/store.js";
import "./RefundDialog.css";

const REASONS = ["Customer request", "Wrong order", "Quality issue", "Long wait time", "Other"];

// SCRUM-41: Manager window for cancelling or refunding one order.
// Cancel = order not made yet, full refund, removed from the kitchen.
// Refund = order already made, full or partial refund.
export default function RefundDialog({ order, onClose, onDone }) {
  const alreadyMade = order.status === "ready";
  const [type, setType] = useState(alreadyMade ? "refund" : "cancellation");
  const [amount, setAmount] = useState(order.total.toFixed(2));
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const firstFieldRef = useRef(null);

  // Focus the first option when the window opens; Escape closes it.
  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const refundAmount = type === "cancellation" ? order.total : Number(amount);
  const amountValid = Number.isFinite(refundAmount) && refundAmount > 0 && refundAmount <= order.total + 0.001;
  const finalReason = reason === "Other" ? otherReason.trim() : reason;
  const canSubmit = amountValid && finalReason && !submitting;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const refund = await refundOrder({
        orderId: order.number,
        type,
        amount: type === "refund" ? Number(refundAmount.toFixed(2)) : undefined,
        reason: finalReason,
      });
      onDone(refund);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="refund-title" onClick={() => !submitting && onClose()}>
      <form className="dialog refund-dialog" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2 id="refund-title">Cancel or refund order #{order.number}</h2>

        <dl className="refund-summary">
          <div>
            <dt>Items</dt>
            <dd>{order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>{money(order.total)}</dd>
          </div>
          <div>
            <dt>Kitchen status</dt>
            <dd>{order.status === "in-progress" ? "In progress" : alreadyMade ? "Ready" : "New"}</dd>
          </div>
        </dl>

        <fieldset className="refund-types">
          <legend className="option-label">What do you want to do?</legend>
          <label className={`refund-type ${type === "cancellation" ? "refund-type-selected" : ""} ${alreadyMade ? "refund-type-disabled" : ""}`}>
            <input
              ref={alreadyMade ? undefined : firstFieldRef}
              type="radio"
              name="refund-type"
              value="cancellation"
              checked={type === "cancellation"}
              disabled={alreadyMade}
              onChange={() => setType("cancellation")}
            />
            <span>
              <strong>Cancel order</strong>
              <span className="refund-type-help">
                {alreadyMade
                  ? "This order is already made. Use a refund instead."
                  : `Refunds the full ${money(order.total)} and removes it from the kitchen.`}
              </span>
            </span>
          </label>
          <label className={`refund-type ${type === "refund" ? "refund-type-selected" : ""}`}>
            <input
              ref={alreadyMade ? firstFieldRef : undefined}
              type="radio"
              name="refund-type"
              value="refund"
              checked={type === "refund"}
              onChange={() => setType("refund")}
            />
            <span>
              <strong>Refund</strong>
              <span className="refund-type-help">Refund all or part of the order. It stays in the kitchen queue.</span>
            </span>
          </label>
        </fieldset>

        {type === "refund" && (
          <div className="refund-amount">
            <label htmlFor="refund-amount-input" className="option-label">
              Refund amount ($)
            </label>
            <div className="refund-amount-row">
              <input
                id="refund-amount-input"
                type="number"
                min="0.01"
                max={order.total.toFixed(2)}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-describedby="refund-amount-help"
                aria-invalid={!amountValid}
              />
              <button type="button" className="btn btn-small" onClick={() => setAmount(order.total.toFixed(2))}>
                Full amount
              </button>
            </div>
            <p id="refund-amount-help" className={`small ${amountValid ? "muted" : "refund-error-text"}`}>
              Between $0.01 and {money(order.total)}.
            </p>
          </div>
        )}

        <div className="refund-reason">
          <label htmlFor="refund-reason-select" className="option-label">
            Reason
          </label>
          <select id="refund-reason-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {reason === "Other" && (
            <input
              type="text"
              maxLength={300}
              placeholder="Describe the reason"
              aria-label="Other reason"
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
            />
          )}
        </div>

        {error && (
          <p className="refund-error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting
              ? "Processing…"
              : type === "cancellation"
                ? `Cancel order · refund ${money(order.total)}`
                : `Refund ${amountValid ? money(refundAmount) : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}
