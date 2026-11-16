-- SCRUM-41: Order cancellations and refunds.
-- A new table so the existing orders/sale rows are never edited or deleted:
-- reports can subtract refunds while the original sale stays on record.
-- The server also runs this automatically on startup (CREATE ... IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS order_refund (
  refund_id    SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL UNIQUE REFERENCES orders(order_id),
  refund_type  TEXT NOT NULL CHECK (refund_type IN ('cancellation', 'refund')),
  amount       NUMERIC(8,2) NOT NULL CHECK (amount > 0),
  reason       TEXT NOT NULL,
  employee_id  INTEGER REFERENCES employee(employee_id), -- manager who approved it
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
