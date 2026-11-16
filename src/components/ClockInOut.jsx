import { useEffect, useState } from "react";
import { apiJson } from "../data/api.js";

//clock-in / clock-out control for the selected employee.
export default function ClockInOut({ employee }) {
  const [shift, setShift] = useState(null);
  const [error, setError] = useState("");

  //check whether the selected employee already has an open shift.
  useEffect(() => {
    if (!employee) return;
    setError("");
    apiJson(`/api/shifts/status/${employee.id}`)
      .then((data) => setShift(data.shift))
      .catch((err) => setError(err.message));
  }, [employee?.id]);

  async function toggle() {
    setError("");
    try {
      const path = shift ? "/api/shifts/clock-out" : "/api/shifts/clock-in";
      const data = await apiJson(path, {
        method: "POST",
        body: JSON.stringify({ employeeId: employee.id }),
      });
      setShift(shift ? null : data.shift);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="clock-in-out">
      <button type="button" className="btn btn-small" disabled={!employee} onClick={toggle}>
        {shift ? "Clock out" : "Clock in"}
      </button>
      {shift && (
        <span className="muted-light small">
          On shift since {new Date(shift.clock_in).toLocaleTimeString()}
        </span>
      )}
      {error && <span role="alert" className="small">{error}</span>}
    </div>
  );
}