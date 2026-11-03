"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, store } from "../../lib/api";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const reg = mode === "register";

  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setBusy(true); setMsg("");
    try {
      if (reg) {
        await api("/api/auth/register", { method: "POST", body: f });
        setMode("login");
        setMsg("Register ho gaya. Admin approve karega uske baad credentials issue kar paoge. Tab tak login kar sakte ho.");
      } else {
        const r = await api("/api/auth/login", { method: "POST", body: f });
        store.set(r.token, r.user);
        router.push(r.user.role === "ADMIN" ? "/admin" : "/issuer");
      }
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 440, margin: "0 auto" }}>
      <h2>{reg ? "Register institute" : "Issuer login"}</h2>
      <p className="muted">{reg ? "Wallet banane ki zarurat nahi, approve hone par system khud bana dega." : "Admin ya approved issuer login karein."}</p>
      {msg && <div className="note">{msg}</div>}
      {reg && (<><label>Institute name</label><input name="institute" required placeholder="XYZ University" /></>)}
      <label>Email</label><input name="email" type="email" required />
      <label>Password</label><input name="password" type="password" required minLength={6} />
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy}>{busy ? "Please wait…" : reg ? "Create account" : "Login"}</button>
        <button type="button" className="btn ghost" onClick={() => { setMode(reg ? "login" : "register"); setMsg(""); }}>
          {reg ? "Have account? Login" : "New institute? Register"}
        </button>
      </div>
    </form>
  );
}
