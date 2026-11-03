"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "../../lib/api";

export default function Admin() {
  const s = useSession();
  const [info, setInfo] = useState(null);
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try { setInfo(await api("/api/admin/info")); setList(await api("/api/admin/issuers")); } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { if (s && s.role === "ADMIN") load(); }, [s, load]);

  if (s === undefined) return null;
  if (!s || s.role !== "ADMIN") return <div className="card"><h2>Admin</h2><p className="muted">Admin login chahiye.</p><Link className="btn" href="/login">Login</Link></div>;

  async function act(id, action, body) {
    setBusy(id + action); setMsg("");
    try {
      const r = await api(`/api/admin/issuers/${id}/${action}`, { method: "POST", body });
      setMsg(action === "approve" ? "Approved. Wallet ban gaya, role mil gaya, gas fund ho gaya." : r.message || "Done (tx: " + (r.txHash || "") + ")");
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  return (
    <>
      {msg && <div className="note">{msg}</div>}
      <div className="card">
        <h2>Platform wallet</h2>
        {info && (info.chainEnabled ? (
          <div className="kv">
            <span>Admin address</span><span className="mono">{info.adminAddress}</span>
            <span>Balance</span><span>{info.balance ?? "?"} POL</span>
            <span>Contract</span><span className="mono">{info.contract}</span>
          </div>
        ) : <p className="muted">Blockchain MOCK mode me hai (CHAIN_RPC_URL / ADMIN_PRIVATE_KEY / CONTRACT_ADDRESS set nahi).</p>)}
      </div>
      <div className="card">
        <h2>Issuers ({list.length})</h2>
        {list.length === 0 ? <p className="muted">Abhi koi issuer registered nahi.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Institute</th><th>Email</th><th>Status</th><th>Wallet</th><th></th></tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.id}>
                <td>{u.institute}</td><td>{u.email}</td>
                <td><span className={"badge " + u.status}>{u.status}</span></td>
                <td className="mono">{u.wallet ? u.wallet.slice(0, 8) + "…" + u.wallet.slice(-4) : "-"}{u.balance != null && <div className="muted">{u.balance} POL</div>}</td>
                <td className="row">
                  {u.status !== "APPROVED" && <button className="btn sm" disabled={!!busy} onClick={() => act(u.id, "approve")}>{busy === u.id + "approve" ? "Approving… (30-60s)" : "Approve"}</button>}
                  {u.status === "PENDING" && <button className="btn sm danger" disabled={!!busy} onClick={() => act(u.id, "reject")}>Reject</button>}
                  {u.status === "APPROVED" && info?.chainEnabled && <button className="btn sm ghost" disabled={!!busy} onClick={() => act(u.id, "fund", { amount: 0.05 })}>+0.05 POL gas</button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
