import { useEffect, useState } from "react";
import { apiJson } from "../data/api.js";

//manager view of recent clock-ins and clock-outs.
export default function ShiftReport() {
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/shifts")
      .then((data) => setShifts(data.shifts))
      .catch((err) => setError(err.message));
  }, []);

    return (
        <section className="panel" aria-label="Employee shifts">
        <h2>Recent shifts</h2>
        {error && <p role="alert">{error}</p>}
        {!error && shifts.length === 0 && <p className="muted">No shifts recorded yet.</p>}
        {shifts.length > 0 && (
            <div className="table-wrap">
            <table className="data-table">
                <thead>
                <tr><th>Employee</th><th>Clock in</th><th>Clock out</th><th>Hours</th></tr>
                </thead>
                <tbody>
                {shifts.map((s) => (
                    <tr key={s.shift_id}>
                    <td>{s.employee_name}</td>
                    <td>{new Date(s.clock_in).toLocaleString()}</td>
                    <td>{s.clock_out ? new Date(s.clock_out).toLocaleString() : "On shift"}</td>
                    <td>{Number(s.hours).toFixed(2)}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        )}
        </section>
    );
}