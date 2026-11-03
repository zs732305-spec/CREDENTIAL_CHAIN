"use client";
import { useEffect, useState } from "react";

export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER || "https://amoy.polygonscan.com";

export const store = {
  token: () => (typeof window === "undefined" ? null : localStorage.getItem("cc_token")),
  user: () => { try { return JSON.parse(localStorage.getItem("cc_user") || "null"); } catch { return null; } },
  set(t, u) { localStorage.setItem("cc_token", t); localStorage.setItem("cc_user", JSON.stringify(u)); window.dispatchEvent(new Event("cc_auth")); },
  clear() { localStorage.removeItem("cc_token"); localStorage.removeItem("cc_user"); window.dispatchEvent(new Event("cc_auth")); },
};

/** undefined = loading, null = logged out, object = logged in */
export function useSession() {
  const [s, setS] = useState(undefined);
  useEffect(() => {
    const read = () => setS(store.user());
    read();
    window.addEventListener("cc_auth", read);
    return () => window.removeEventListener("cc_auth", read);
  }, []);
  return s;
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const t = store.token();
  if (t) headers.Authorization = "Bearer " + t;
  let r;
  try {
    r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Server se connect nahi ho paya. Backend chal raha hai? (Render free sleep se uthne me ~50s lagte hain)");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 403 && !data.error && t) { store.clear(); throw new Error("Session expire ho gaya, dobara login karo."); }
    throw new Error(data.error || "Error " + r.status);
  }
  return data;
}
