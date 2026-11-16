import { useEffect, useState } from "react";
import { apiJson } from "./api.js";

//returns the logged-in user ({ name, email }) or null for guests.
export function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    apiJson("/api/auth/me").then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);
  return user;
}