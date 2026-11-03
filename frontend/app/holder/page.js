"use client";
import { useState } from "react";
import { api } from "../../lib/api";
import { qrDataURL, qrCardBlob, saveBlob, verifyLink } from "../../lib/qr";

export default function Holder() {
  const [email, setEmail] = useState("");
  const [list, setList] = useState(null);
  const [note, setNote] = useState("");

  async function find(e) {
    e.preventDefault(); setNote("");
    try { setList(await api("/api/public/holder?email=" + encodeURIComponent(email))); } catch (err) { setNote(err.message); }
  }

  return (
    <>
      <form className="card" onSubmit={find}>
        <h2>My credentials</h2>
        <p className="muted">Wo email daalo jo institute ne credential me use ki.</p>
        <div className="row"><input type="email" required style={{ flex: 1, minWidth: 200 }} placeholder="aarav@student.edu" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn">Show</button></div>
      </form>
      {note && <div className="note">{note}</div>}
      {list && list.length === 0 && <div className="card muted">Is email ke liye koi credential nahi mila.</div>}
      <div className="grid">
        {(list || []).map((c) => (
          <div className="card" key={c.id} style={{ textAlign: "center" }}>
            <span className={"badge " + c.status}>{c.status.toUpperCase()}</span>
            <h3 style={{ margin: "10px 0 2px" }}>{c.title}</h3>
            <div className="muted">{c.institute}</div>
            <p><img alt="QR" style={{ width: 170, height: 170, background: "#fff", borderRadius: 8 }} src={qrDataURL(verifyLink(c.id), 340)} /></p>
            <div className="mono"><b>{c.id}</b></div>
            <p className="muted">Employer is QR ko scan karke verify karega.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn sm" onClick={async () => saveBlob(await qrCardBlob(c), c.id + "-QR.png")}>⬇ Download QR</button>
              <a className="btn sm ghost" href={`/verify?id=${c.id}`}>Verify</a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
