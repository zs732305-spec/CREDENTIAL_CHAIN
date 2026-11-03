import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Tamper-proof credentials,<br />verified with one scan</h1>
        <p>Institute Excel upload karta hai, har student ko ID + QR milta hai. Employer ya student QR scan karke turant verify karta hai.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/verify" className="btn">Scan / Verify</Link>
          <Link href="/login" className="btn ghost">Issuer login</Link>
        </div>
      </section>
      <div className="grid">
        <div className="card"><h2>🏛 Issuer</h2><p className="muted">Login, Excel/CSV upload, bulk credentials + QR codes. Wallet banane ki zarurat nahi.</p></div>
        <div className="card"><h2>🎓 Holder</h2><p className="muted">Email se apni credentials aur QR dekhe, download kare, share kare.</p></div>
        <div className="card"><h2>🔍 Verifier</h2><p className="muted">Camera se QR scan ya ID. Login nahi chahiye. Result blockchain se match hota hai.</p></div>
      </div>
    </>
  );
}
