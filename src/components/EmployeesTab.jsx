import { useEffect, useState } from "react";
import { ROLE_OPTIONS, fetchEmployees, createEmployee, saveEmployee, fetchCurrentUser } from "../data/employeesApi.js";
import "./EmployeesTab.css";

// SCRUM-40: Manager Employees tab backed by the employee table.
// A manager adds someone's Google email and role; the next time that person
// signs in with Google, they automatically get that role.
export default function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "cashier" });
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }

  async function load() {
    try {
      const [list, user] = await Promise.all([fetchEmployees(), fetchCurrentUser()]);
      setEmployees(list);
      setMe(user);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function show(type, text) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage((current) => (current?.text === text ? null : current)), 6000);
  }

  function replace(updated) {
    setEmployees((list) => list.map((e) => (e.id === updated.id ? updated : e)));
  }

  async function add(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const employee = await createEmployee({
        name: form.name,
        role: form.role,
        email: form.email.trim() || null,
      });
      setEmployees((list) => [...list, employee]);
      setForm({ name: "", email: "", role: form.role });
      show(
        "success",
        employee.linked
          ? `Added ${employee.name}. They already have a login, so their access works now.`
          : `Added ${employee.name}. They'll get access the next time they sign in with Google.`
      );
    } catch (error) {
      show("error", error.message);
    } finally {
      setAdding(false);
    }
  }

  async function update(employee, changes, successText) {
    try {
      const updated = await saveEmployee(employee.id, changes);
      replace(updated);
      show("success", successText(updated));
    } catch (error) {
      show("error", error.message);
      // Reload so the table shows what is actually saved.
      load();
    }
  }

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading employees…
      </p>
    );
  }

  if (loadError) {
    return <p role="alert">Couldn't load employees: {loadError}</p>;
  }

  return (
    <>
      <form className="inline-form" onSubmit={add} aria-label="Add employee">
        <h2>Add an employee</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required />
        </label>
        <label>
          Google email
          <input
            type="email"
            value={form.email}
            placeholder="name@gmail.com"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-describedby="employee-email-help"
          />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" disabled={adding}>
          {adding ? "Adding…" : "Add"}
        </button>
        <p id="employee-email-help" className="muted small employees-help">
          Use the email they sign in to Google with. Their role applies as soon as they sign in.
        </p>
      </form>

      {message && (
        <p className={message.type === "error" ? "employees-error" : "employees-success"} role={message.type === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Google email</th>
              <th>Role</th>
              <th>Sign-in</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const isMe = me?.employeeId === e.id;
              return (
                <tr key={e.id} className={e.role === "inactive" ? "row-off" : ""}>
                  <td>
                    {e.name}
                    {isMe && <span className="employees-you"> (you)</span>}
                  </td>
                  <td>
                    <EmailCell
                      employee={e}
                      onSave={(email) =>
                        update(e, { email }, (u) =>
                          u.email
                            ? `Saved ${u.name}'s email. They'll get access when they sign in with it.`
                            : `Removed ${u.name}'s email.`
                        )
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="cell-select"
                      value={e.role}
                      aria-label={`Role for ${e.name}`}
                      disabled={isMe}
                      title={isMe ? "Another manager has to change your role" : undefined}
                      onChange={(ev) =>
                        update(e, { role: ev.target.value }, (u) => `${u.name} is now: ${roleLabel(u.role)}.`)
                      }
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="employees-signin">
                    {e.linked ? (
                      <span className="status status-ok">
                        Signed in{e.lastLogin ? ` · ${new Date(e.lastLogin).toLocaleDateString()}` : ""}
                      </span>
                    ) : e.email ? (
                      <span className="status status-new">Waiting for first sign-in</span>
                    ) : (
                      <span className="muted small">Add an email to give access</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Email input that saves when the manager presses Enter or leaves the field.
function EmailCell({ employee, onSave }) {
  const [value, setValue] = useState(employee.email ?? "");

  // Keep in sync if the saved value changes (e.g. after a failed save reloads).
  useEffect(() => setValue(employee.email ?? ""), [employee.email]);

  function commit() {
    const next = value.trim().toLowerCase();
    if (next === (employee.email ?? "")) return;
    onSave(next || null);
  }

  return (
    <input
      className="cell-input employees-email"
      type="email"
      value={value}
      placeholder="Add email"
      aria-label={`Google email for ${employee.name}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
