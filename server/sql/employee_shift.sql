-- Clock-in / clock-out records for SCRUM-101.
CREATE TABLE IF NOT EXISTS employee_shift (
  shift_id    SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employee (employee_id),
  clock_in    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out   TIMESTAMPTZ
);
