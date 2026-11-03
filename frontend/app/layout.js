import "./globals.css";
import Nav from "../components/Nav";

export const metadata = { title: "CredentialChain", description: "Decentralized credential verification" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="wrap">{children}</main>
        <footer className="foot">CredentialChain · Polygon Amoy testnet · hash on-chain, documents on IPFS</footer>
      </body>
    </html>
  );
}
