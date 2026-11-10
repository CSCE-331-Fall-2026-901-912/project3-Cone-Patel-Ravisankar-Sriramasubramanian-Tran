
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function GoogleAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkLogin() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (response.status === 401) {
          setUser(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to check login status");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    checkLogin();
  }, []);

  function handleLogin() {
    window.location.href = `${API_URL}/api/auth/google`;
  }

  async function handleLogout() {
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p className="auth-status">Checking login...</p>;
  }

  return (
    <section className="google-auth">
      {user ? (
        <div className="auth-user">
          <div>
            <strong>{user.name}</strong>
            <p>{user.email}</p>
          </div>

          <button
            type="button"
            className="auth-button google-signin"
            onClick={handleLogin}
            >
            <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.25c0-.7-.06-1.4-.18-2.06H12v3.9h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.23Z"/>
                <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.59-1.98.94-3.31.94-2.54 0-4.69-1.72-5.46-4.03H3.3v2.52A9.75 9.75 0 0 0 12 21.75Z"/>
                <path fill="#FBBC05" d="M6.54 13.84a5.85 5.85 0 0 1 0-3.68V7.64H3.3a9.75 9.75 0 0 0 0 8.72l3.24-2.52Z"/>
                <path fill="#EA4335" d="M12 6.13c1.43 0 2.71.49 3.72 1.46l2.79-2.79A9.33 9.33 0 0 0 12 2.25 9.75 9.75 0 0 0 3.3 7.64l3.24 2.52C7.31 7.85 9.46 6.13 12 6.13Z"/>
            </svg>

            <span>Continue with Google</span>
            </button>

        </div>
      ) : (
        <button
          type="button"
          className="auth-button"
          onClick={handleLogin}
        >
          Sign in with Google
        </button>
      )}

      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}
