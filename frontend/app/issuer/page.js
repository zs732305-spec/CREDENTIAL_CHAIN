"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { api, useSession } from "../../lib/api";
import { qrDataURL, qrCardBlob, saveBlob, verifyLink } from "../../lib/qr";

const RESERVED = ["name", "student name", "email", "title", "degree", "course", "expiry"];
const pick = (m, keys) => { for (const k of keys) if (m[k] !== undefined && String(m[k]).trim() !== "") return m[k]; return ""; };
const dstr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim());

function normalize(rows) {
  return rows.map((o) => {
    const m = {};
    Object.keys(o).forEach((k) => (m[k.toLowerCase().trim()] = o[k]));
    const extra = {};
    Object.keys(m).forEach((k) => { if (!RESERVED.includes(k) && String(m[k]).trim() !== "") extra[k] = dstr(m[k]); });
    return { name: String(pick(m, ["name", "student name"])), email: String(pick(m, ["email"])), title: String(pick(m, ["title", "degree", "course"])), expiry: dstr(m.expiry), extra };
  });
}

export default function Issuer() {
  const s = useSession();
  const [me, setMe] = useState(null);
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [fails, setFails] = useState([]);
  const [busy, setBusy] = useState(false);
  const [qrm, setQrm] = useState(null);

  const load = useCallback(async () => {
    try { const m = await api("/api/issuer/me"); setMe(m); if (m.status === "APPROVED") setList(await api("/api/issuer/credentials")); }
    catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { if (s && s.role === "ISSUER") load(); }, [s, load]);

  if (s === undefined) return null;
  if (!s || s.role !== "ISSUER") return <div className="card"><h2>Issuer dashboard</h2><p className="muted">Pehle issuer login karo.</p><Link className="btn" href="/login">Login</Link></div>;
  if (me && me.status !== "APPROVED") return <div className="card"><h2>Approval pending ⏳</h2><p className="muted">Status: <b>{me.status}</b>. Admin approve karega to wallet auto ban jayega aur aap credentials issue kar paoge.</p><button className="btn ghost" onClick={load}>Refresh status</button></div>;

  async function issueRows(rows) {
    setBusy(true); setFails([]);
    let ok = 0; const bad = [];
    try {
      for (let i = 0; i < rows.length; i += 20) {
        setMsg(`Issuing ${Math.min(i + 20, rows.length)}/${rows.length}…`);
        const res = await api("/api/issuer/credentials/bulk", { method: "POST", body: { rows: rows.slice(i, i + 20) } });
        res.results.forEach((r) => (r.ok ? ok++ : bad.push(r)));
      }
      setMsg(`${ok} credentials issue hue.` + (bad.length ? ` ${bad.length} fail hue.` : ""));
    } catch (e) { setMsg("Error: " + e.message); }
    setFails(bad); setBusy(false); await load();
  }

  async function onFile(e) {
    const f = e.target.files[0]; if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const rows = normalize(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }));
      if (!rows.length) { setMsg("File khali hai."); return; }
      await issueRows(rows);
    } catch { setMsg("File padh nahi paye. .xlsx ya .csv use karo."); }
    e.target.value = "";
  }

  function sample() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "email", "title", "grade", "year", "expiry"],
      ["Aarav Sharma", "aarav@student.edu", "B.Tech Computer Science", "8.9 CGPA", "2026", ""],
      ["Diya Patel", "diya@student.edu", "B.Tech Electronics", "9.2 CGPA", "2026", ""],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "students");
    XLSX.writeFile(wb, "sample-students.xlsx");
  }

  async function single(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await issueRows([{ name: f.name, email: f.email, title: f.title, expiry: f.expiry || "", extra: {} }]);
    e.target.reset();
  }

  async function revoke(id) {
    if (!confirm(id + " ko revoke karna hai?")) return;
    try { await api(`/api/issuer/credentials/${id}/revoke`, { method: "POST" }); setMsg(id + " revoked."); await load(); } catch (e) { setMsg(e.message); }
  }

  async function zipAll() {
    setMsg("ZIP ban raha hai…");
    const z = new JSZip();
    for (const c of list) z.file(`${c.id}-${c.name.replace(/\W+/g, "_")}.png`, await qrCardBlob(c));
    saveBlob(await z.generateAsync({ type: "blob" }), "QR-codes.zip");
    setMsg("ZIP download ho gaya.");
  }

  function csv() {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const t = "ID,Name,Email,Title,Link\n" + list.map((c) => [c.id, c.name, c.email, c.title, verifyLink(c.id)].map(q).join(",")).join("\n");
    saveBlob(new Blob([t], { type: "text/csv" }), "credentials.csv");
  }

  const low = me && me.chainEnabled && me.balance != null && Number(me.balance) < 0.02;

  return (
    <>
      {msg && <div className="note">{msg}</div>}
      {me && me.chainEnabled && (
        <div className={"card" + (low ? " warn" : "")}>
          <b>Issuer wallet (auto-created):</b> <span className="mono">{me.wallet}</span><br />
          <span className="muted">Gas balance: {me.balance ?? "?"} POL</span> {low && <b style={{ color: "var(--warn)" }}> · Balance kam hai, admin se top-up mango.</b>}
        </div>
      )}
      <div className="card">
        <h2>Bulk issue (Excel / CSV)</h2>
        <p className="muted">Columns: <b>name, email, title</b> (zaruri) + koi bhi extra (grade, year…) + optional <b>expiry</b> (YYYY-MM-DD).</p>
        <div className="row">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={busy} style={{ maxWidth: 320 }} />
          <button className="btn ghost" onClick={sample}>Download sample Excel</button>
        </div>
      </div>
      {fails.length > 0 && <div className="card warn"><b>Fail hui rows:</b><ul>{fails.map((f, i) => <li key={i}>{f.name || f.email}: {f.error}</li>)}</ul></div>}
      <form className="card" onSubmit={single}>
        <h2>Issue single credential</h2>
        <div className="grid">
          <div><label>Student name</label><input name="name" required /></div>
          <div><label>Email</label><input name="email" type="email" required /></div>
          <div><label>Degree / Title</label><input name="title" required /></div>
          <div><label>Expiry (optional)</label><input name="expiry" type="date" /></div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn" disabled={busy}>{busy ? "Issuing…" : "Issue"}</button></div>
      </form>
      <div className="card">
        <h2>Issued credentials ({list.length})</h2>
        {list.length === 0 ? <p className="muted">Abhi koi credential nahi.</p> : (
          <>
            <div className="scroll"><table>
              <thead><tr><th>QR</th><th>ID</th><th>Student</th><th>Title</th><th>Status</th><th></th></tr></thead>
              <tbody>{list.slice(0, 100).map((c) => (
                <tr key={c.id}>
                  <td><img className="qr" alt="QR" src={qrDataURL(verifyLink(c.id), 120)} onClick={() => setQrm(c)} /></td>
                  <td><b>{c.id}</b></td>
                  <td>{c.name}<div className="muted">{c.email}</div></td>
                  <td>{c.title}</td>
                  <td><span className={"badge " + (c.revoked ? "revoked" : "valid")}>{c.revoked ? "REVOKED" : "ACTIVE"}</span></td>
                  <td className="row">
                    <button className="btn sm ghost" onClick={async () => saveBlob(await qrCardBlob(c), c.id + "-QR.png")}>⬇ QR</button>
                    {!c.revoked && <button className="btn sm danger" onClick={() => revoke(c.id)}>Revoke</button>}
                  </td>
                </tr>))}</tbody>
            </table></div>
            {list.length > 100 && <p className="muted">Latest 100 dikh rahe hain. ZIP/CSV me sab aayenge.</p>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={zipAll}>⬇ Download all QR (ZIP)</button>
              <button className="btn sm ghost" onClick={csv}>⬇ CSV (ID + link)</button>
            </div>
          </>
        )}
      </div>
      {qrm && (
        <div className="modal" onClick={() => setQrm(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h2>{qrm.name}</h2><div className="muted">{qrm.title}</div>
            <p><img alt="QR" src={qrDataURL(verifyLink(qrm.id), 520)} /></p>
            <div className="mono"><b>{qrm.id}</b></div>
            <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
              <button className="btn sm" onClick={async () => saveBlob(await qrCardBlob(qrm), qrm.id + "-QR.png")}>⬇ Download QR</button>
              <button className="btn sm ghost" onClick={() => setQrm(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
