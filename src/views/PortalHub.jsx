import { Link } from "react-router-dom";
import { SHOP_NAME } from "../data/menu.js";
import GoogleAuth from "../components/GoogleAuth.jsx";
import { useEffect, useState } from "react";

// Only the Portal Hub links to the other views (one-way), per the
// project requirements. No other view links back here or to each other.
const VIEWS = [
  { path: "/manager", title: "Manager Dashboard", desc: "Sales, inventory, and menu" },
  { path: "/cashier", title: "Cashier Screen", desc: "Ring up customer orders" },
  { path: "/kiosk", title: "Customer Kiosk", desc: "Self-service ordering" },
  { path: "/kitchen", title: "Kitchen Display", desc: "Orders to prepare" },
];

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

const ACCESS = {
  "/manager": ["manager"],
  "/cashier": ["cashier", "manager"],
  "/kitchen": ["kitchen", "manager"],
  "/kiosk": ["manager", "cashier", "kitchen", "unassigned"],
};

export default function PortalHub() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error("Failed to check authentication:", error);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);
  async function handleLogout() {
    try {
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
    } catch (error) {
      console.error("Failed to log out:", error);
      alert("Could not sign out. Please try again.");
    }
  }
  return (
    <main className="hub">
      <div className="hub-heading">
      

      <p className="hub-eyebrow">WELCOME TO</p>
      <h1>{SHOP_NAME}</h1>
      <p className="hub-tagline">The best boba heaven in College Station</p>
      <p className="hub-team">by Squad 33 - The Actors</p>
      <span className="hub-sparkle">✳</span>
      
    </div>
      <p className="hub-sub">Choose a view to open.</p>
      <nav aria-label="Interface views">
        <ul className="hub-grid">
          {VIEWS.map((v) => {
            const allowed =
              v.path === "/kiosk" ||
              (user && ACCESS[v.path]?.includes(user.role));

            return (
              <li key={v.path}>
                {allowed ? (
                  <Link className="hub-card" to={v.path}>
                    <span className="hub-card-title">{v.title}</span>
                    <span className="hub-card-desc">{v.desc}</span>
                  </Link>
                ) : (
                  <div
                    className="hub-card hub-card-locked"
                    aria-disabled="true"
                  >
                    <span className="hub-card-title">
                      {v.title}
                    </span>
                    <span className="hub-card-desc">
                      {loading ? "Checking access..." : "Sign in to access"}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="hub-footer-decoration" aria-hidden="true">
        ✿ ──── ✦ ──── ✿
      </div>
      <div className="hub-auth-section">
        {loading ? (
          <p>Checking sign-in status...</p>
        ) : user ? (
          <div className="hub-user-info">
            <p>
              Signed in as <strong>{user.name}</strong>
            </p>
            <p className="hub-user-email">{user.email}</p>

            <button
              type="button"
              className="hub-signout-btn"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <p className="hub-auth-message">
              Sign in to access your assigned workspace.
            </p>
            <GoogleAuth />
          </>
        )}
      </div>
    </main>
  );
}
