"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, store } from "../lib/api";

export default function Nav() {
  const s = useSession();
  const router = useRouter();
  return (
    <header className="nav">
      <Link href="/" className="brand">⛓ CredentialChain</Link>
      <nav>
        <Link href="/verify">Verify</Link>
        {s?.role === "ISSUER" && <Link href="/issuer">Dashboard</Link>}
        {s?.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        <Link href="/holder">My Credentials</Link>
      </nav>
      {s ? (
        <span className="row">
          <span className="muted">{s.institute}</span>
          <button className="btn sm ghost" onClick={() => { store.clear(); router.push("/"); }}>Logout</button>
        </span>
      ) : (
        <Link href="/login" className="btn">Issuer login</Link>
      )}
    </header>
  );
}
