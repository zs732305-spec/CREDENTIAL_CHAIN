"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api, EXPLORER } from "../../lib/api";
import { extractId } from "../../lib/qr";

const MSG = {
  valid: ["✅ Valid credential", "Record blockchain hash se match karta hai."],
  revoked: ["🚫 Revoked", "Issuer ne ye credential cancel kar diya hai."],
  expired: ["⌛ Expired", "Credential ki validity khatam ho chuki hai."],
  tampered: ["⚠️ Tampered", "Data ka hash on-chain hash se match nahi karta."],
  pending: ["⏳ Confirmation pending", "Transaction abhi blockchain pe confirm ho rahi hai. Thodi der baad dobara check karo."],
  notfound: ["❌ Not found", "Is ID ka koi credential registry me nahi hai."],
};

export default function Verify() {
  const [id, setId] = useState("");
  const [res, setRes] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cam = useRef(null);
  const stream = useRef(null);
  const scanning = useRef(false);

  const stop = () => { scanning.current = false; stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; if (cam.current) cam.current.innerHTML = ""; };
  useEffect(() => { const q = new URLSearchParams(location.search).get("id"); if (q) run(q); return stop; }, []); // eslint-disable-line

  async function run(raw) {
    const v = extractId(raw) || String(raw).trim().toUpperCase();
    stop(); setId(v); setBusy(true); setNote("");
    try { setRes(await api("/api/public/verify/" + encodeURIComponent(v))); } catch (e) { setNote(e.message); setRes(null); }
    setBusy(false);
  }

  async function startScan() {
    stop(); setNote("");
    try { stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); }
    catch { setNote("Camera allow nahi hua. QR image upload karo ya ID type karo."); return; }
    const v = document.createElement("video");
    v.setAttribute("playsinline", ""); v.srcObject = stream.current;
    v.style.cssText = "width:100%;max-width:360px;border-radius:12px";
    cam.current.appendChild(v); await v.play(); scanning.current = true;
    const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (!scanning.current) return;
      if (v.videoWidth) {
        cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height), r = jsQR(d.data, d.width, d.height);
        if (r && extractId(r.data)) { run(r.data); return; }
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  function scanImage(e) {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height), r = jsQR(d.data, d.width, d.height);
        if (r && extractId(r.data)) run(r.data); else setNote("Is image me valid credential QR nahi mila.");
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  }

  const m = res && MSG[res.status];
  const real = res?.txHash && res.txHash.startsWith("0x") && !res.txHash.startsWith("0xMOCK");
  return (
    <>
      <div className="card">
        <h2>Verify credential</h2>
        <p className="muted">Login ki zarurat nahi. QR scan karo ya ID type karo.</p>
        <div className="row">
          <button className="btn" onClick={startScan}>📷 Scan QR with camera</button>
          <label className="btn ghost" style={{ margin: 0 }}>🖼 Upload QR image<input type="file" accept="image/*" style={{ display: "none" }} onChange={scanImage} /></label>
        </div>
        <div ref={cam} style={{ marginTop: 12 }} />
        <form onSubmit={(e) => { e.preventDefault(); run(id); }}>
          <label>Ya Credential ID</label>
          <div className="row"><input style={{ flex: 1, minWidth: 180 }} required placeholder="CERT-XXXXXX" value={id} onChange={(e) => setId(e.target.value)} /><button className="btn" disabled={busy}>{busy ? "Checking…" : "Verify"}</button></div>
        </form>
      </div>
      {note && <div className="note">{note}</div>}
      {res && (
        <div className={"card result " + res.status}>
          <span className={"badge " + res.status}>{m[0]}</span>
          <p className="muted">{m[1]}</p>
          {res.status !== "notfound" && (
            <div className="kv">
              <span>Student</span><span>{res.name}</span>
              <span>Credential</span><span>{res.title}</span>
              <span>Institute</span><span>{res.institute}</span>
              {Object.entries(res.extra || {}).map(([k, v]) => [<span key={k}>{k}</span>, <span key={k + "v"}>{v}</span>])}
              <span>Issued</span><span>{new Date(res.issuedAt).toLocaleString()}</span>
              {res.expiresAt > 0 && [<span key="e">Expires</span>, <span key="ev">{new Date(res.expiresAt).toLocaleDateString()}</span>]}
              <span>Cert ID</span><span className="mono">{res.id}</span>
              <span>Hash</span><span className="mono">{res.hash}</span>
              <span>Blockchain</span><span>{res.chainStatus === "MOCK" ? "MOCK mode (chain off)" : real ? <a href={`${EXPLORER}/tx/${res.txHash}`} target="_blank" rel="noreferrer"><u>View transaction ↗</u></a> : "-"}</span>
              {res.cid && res.cid !== "not-pinned" && [<span key="c">IPFS</span>, <a key="cv" className="mono" href={`https://gateway.pinata.cloud/ipfs/${res.cid}`} target="_blank" rel="noreferrer"><u>{res.cid}</u></a>]}
            </div>
          )}
        </div>
      )}
    </>
  );
}
