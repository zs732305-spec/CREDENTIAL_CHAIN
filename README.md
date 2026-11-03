# CredentialChain: Decentralized Credential Verification

Institutes login karke Excel upload karte hain, har student ko **ID + QR** milta hai, aur koi bhi QR scan karke
blockchain se credential verify kar sakta hai.

```
credential-chain/
├── contracts/   Hardhat + Solidity (CredentialRegistry) -> Polygon Amoy
├── backend/     Spring Boot 3 + Web3j + JWT + PostgreSQL (Supabase) + Pinata (IPFS)  -> Render
└── frontend/    Next.js 14 (login, bulk upload, QR, scan, verify)                    -> Vercel
```

## Kaise kaam karta hai
1. Institute register karta hai (email+password). **Wallet banane ki zarurat nahi.**
2. Admin (aap) approve karta hai -> backend **khud wallet banata hai**, private key AES-256-GCM se encrypt karke DB me
   rakhta hai, contract me `addIssuer()` call karta hai aur thoda gas (POL) bhejta hai.
3. Issuer Excel/CSV upload karta hai -> har row ka SHA-256 hash banta hai, W3C-VC style JSON IPFS (Pinata) pe pin hota hai
   (**naam/email IPFS pe nahi jaate**), aur `hash + CID` Polygon pe `issue()` se likha jata hai.
4. Har credential ka QR (`/verify?id=CERT-XXXXXX`). Student apni email se QR dekhta/download karta hai.
5. Verifier QR scan karta hai -> backend DB + blockchain (`verify()`) dono check karke Valid / Revoked / Expired / Tampered / Pending dikhata hai.

## Roles
| Role | Login | Wallet |
|---|---|---|
| Admin | env se (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) | Deployer wallet (aapka MetaMask test account) |
| Issuer | email + password | Auto-created, backend ke paas (custodial) |
| Holder | email se lookup | Nahi chahiye (pseudo-address email hash se) |
| Verifier | login nahi | Nahi chahiye |

---
# PART A: Local run (pehle ye karo)

### Option 1: Docker (sabse aasan, MOCK mode, blockchain ke bina)
```bash
cp .env.example .env
docker compose up --build
```
- Frontend http://localhost:3000, Backend http://localhost:8080/health
- Login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin@example.com` / `change-me-now`)
- Flow: Register issuer -> Admin login -> Approve -> Issuer login -> Excel upload -> QR -> Verify.
- `CHAIN_*` blank hai to **MOCK mode**: sab chalega, bas transaction asli blockchain pe nahi jayegi.

### Option 2: Bina Docker
```bash
# DB: koi bhi Postgres (db=credentials user=app pass=app)
cd backend && cp .env.example .env     # (export the vars or set them in IntelliJ)
mvn spring-boot:run

cd frontend && cp .env.example .env.local
npm install && npm run dev
```

---
# PART B: GitHub pe upload

1. https://github.com/new pe empty repo banao (naam: `credential-chain`, **README/gitignore add mat karna**).
2. Is folder me terminal kholo:
```bash
git init
git add .
git status            # check: .env file list me NAHI honi chahiye
git commit -m "Initial commit: CredentialChain"
git branch -M main
git remote add origin https://github.com/<your-username>/credential-chain.git
git push -u origin main
```
3. Agar private key ya password galti se push ho gaya: us key ko **turant badal do** (git history se delete kafi nahi hota).

---
# PART C: Deploy (order me)

### 1. Accounts (sab free)
Alchemy (Polygon Amoy RPC), Pinata (JWT), Supabase, Render, Vercel, GitHub, MetaMask.

### 2. Test wallet + faucet
- MetaMask me **naya account** (sirf test ke liye). Network: Polygon Amoy (chain ID 80002).
- Faucet se free POL lo (Alchemy ya Polygon ka official faucet; faucets badalte rehte hain).
- Account Details -> Show private key -> ye `ADMIN_PRIVATE_KEY` hai. **Real paisa wale wallet ki key kabhi nahi.**

### 3. Contract deploy (Amoy)
```bash
cd contracts
npm install
cp .env.example .env     # AMOY_RPC_URL, DEPLOYER_PRIVATE_KEY bharo (ISSUER_ADDRESS khali chhod do)
npx hardhat test         # tests pass hone chahiye
npm run deploy:amoy      # output: CredentialRegistry deployed to: 0x...  <- ye CONTRACT_ADDRESS
```
Deployer wallet hi contract ka admin banta hai, isliye backend me `ADMIN_PRIVATE_KEY` = wahi `DEPLOYER_PRIVATE_KEY`.

### 4. Supabase (database)
- New project -> Project Settings -> Database -> **Connection string -> Session pooler** (port 5432).
  Render free IPv6 support nahi karta, isliye direct connection nahi, **pooler** use karo.
- Backend env me:
  - `DB_URL=jdbc:postgresql://<pooler-host>:5432/postgres`
  - `DB_USER=postgres.<project-ref>`
  - `DB_PASS=<db password>`
- Tables backend khud bana lega (`ddl-auto=update`).

### 5. Backend -> Render
- Render -> New -> **Blueprint** -> GitHub repo select (render.yaml mil jayega), ya New -> Web Service -> Docker, Root Directory `backend`.
- Env vars daalo (README ke neeche table). `FRONTEND_URL` abhi placeholder rakho, Vercel ke baad update karna.
- Deploy hone ke baad `https://<name>.onrender.com/health` -> `{"status":"ok"}`.

### 6. Frontend -> Vercel
- Vercel -> Add New Project -> repo import -> **Root Directory: `frontend`**.
- Env vars: `NEXT_PUBLIC_API_URL=https://<name>.onrender.com`, `NEXT_PUBLIC_EXPLORER=https://amoy.polygonscan.com`.
- Deploy. Aapko `https://<project>.vercel.app` milega.

### 7. CORS jodo
Render me `FRONTEND_URL=https://<project>.vercel.app` (multiple ho to comma se) -> Redeploy.

### 8. Test
1. Vercel URL -> Issuer login -> **Register** (naya institute).
2. Admin email se login -> Admin page -> **Approve** (30-60 sec lagte hain: wallet + on-chain role + gas).
3. Issuer login -> sample Excel upload -> QR download.
4. Verify page pe QR scan. Result me **"View transaction"** link aana chahiye (polygonscan).
5. Revoke karke dobara verify -> Revoked.

### Free domain (optional)
`*.vercel.app` free hai. Custom ke liye `<name>.is-a.dev` (GitHub PR) ya GitHub Student Pack ka free domain. Vercel -> Settings -> Domains.

---
# Environment variables (backend)
| Var | Kya hai |
|---|---|
| `DB_URL`, `DB_USER`, `DB_PASS` | Supabase Postgres (pooler) |
| `JWT_SECRET` | 32+ char random |
| `MASTER_KEY` | Issuer wallet keys encrypt karne ki key. **Approve ke baad kabhi mat badlo**, warna purani keys decrypt nahi hongi |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Pehla admin (startup pe bana diya jata hai) |
| `FRONTEND_URL` | CORS allowed origin(s) |
| `CHAIN_RPC_URL` | Alchemy Amoy URL |
| `ADMIN_PRIVATE_KEY` | Deployer/admin wallet key |
| `CONTRACT_ADDRESS` | Deploy se mila address |
| `CHAIN_ID` | 80002 (Amoy) |
| `FUND_AMOUNT` | Approve par naye issuer ko kitna POL gas (default 0.1) |
| `PINATA_JWT` | Blank = IPFS pinning skip |

# API (short)
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/public/verify/{id}`, `/api/public/holder?email=` | public |
| GET/POST | `/api/issuer/me`, `/api/issuer/credentials`, `/credentials/bulk`, `/credentials/{id}/revoke` | ISSUER |
| GET/POST | `/api/admin/info`, `/issuers`, `/issuers/{id}/approve|reject|fund` | ADMIN |

# Dhyan rakho (limits / production TODO)
- **Gas:** ek issue ~0.005-0.01 POL lagta hai (testnet). Faucet limited hota hai, demo me 10-20 credentials theek hain; zyada ke liye admin page se "+gas" ya mainnet.
  Bade scale ke liye Merkle-root batching (ek tx = poora batch) next improvement hai.
- **Render free** 15 min idle ke baad sleep: pehli request ~50s. **Supabase free** 1 hafte inactive pe pause.
- **Holder lookup** abhi sirf email se hai (koi bhi email daal ke list dekh sakta hai). Production me email OTP lagao.
- **Rate limiting** public endpoints pe lagao (Bucket4j / Cloudflare).
- **Keys:** production me `MASTER_KEY` aur admin key AWS KMS / Vault me rakho.
- IPFS public hai: isliye naam/email wahan nahi jaate, sirf title + hash + pseudo DID.
- Ye code is environment me compile/run test nahi hua (network nahi tha). Pehli baar chalane par koi dependency/version error aaye to error paste karo.
# CREDENTIAL_CHAIN
