import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ProtectedRoute({ allowedRoles, children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setUser(null);
          return;
        }

        const data = await response.json();

        if (active) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (loading) {
    return <p className="auth-loading">Checking access...</p>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}