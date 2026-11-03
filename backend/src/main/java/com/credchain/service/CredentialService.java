package com.credchain.service;

import com.credchain.config.ApiException;
import com.credchain.model.AppUser;
import com.credchain.model.CredentialRecord;
import com.credchain.repo.CredRepo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Credentials;
import org.web3j.utils.Numeric;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class CredentialService {
    private static final Logger log = LoggerFactory.getLogger(CredentialService.class);
    private static final ObjectMapper OM = new ObjectMapper();
    private static final String ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom rnd = new SecureRandom();

    public record Row(String name, String email, String title, String expiry, Map<String, String> extra) {}
    public record Result(String id, String name, String email, String title, boolean ok, String error) {}

    private final CredRepo repo;
    private final CryptoService crypto;
    private final BlockchainService chain;
    private final IpfsService ipfs;

    public CredentialService(CredRepo repo, CryptoService crypto, BlockchainService chain, IpfsService ipfs) {
        this.repo = repo; this.crypto = crypto; this.chain = chain; this.ipfs = ipfs;
    }

    private static String clean(String s) { return s == null ? "" : s.trim(); }

    private String newId() {
        String id;
        do {
            StringBuilder sb = new StringBuilder("CERT-");
            for (int i = 0; i < 6; i++) sb.append(ALPHA.charAt(rnd.nextInt(ALPHA.length())));
            id = sb.toString();
        } while (repo.existsById(id));
        return id;
    }

    private long parseExpiry(String s) {
        if (s == null || s.isBlank()) return 0;
        try {
            long ms = LocalDate.parse(s.trim()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
            if (ms <= System.currentTimeMillis() + 60_000) throw new IllegalArgumentException("expiry future ki date honi chahiye");
            return ms;
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("expiry format YYYY-MM-DD hona chahiye");
        }
    }

    /** Canonical SHA-256 of the record. Same formula is used at issue time and at verify time. */
    public String hash(CredentialRecord c) {
        try {
            Map<String, String> ex = OM.readValue(c.extraJson, new TypeReference<TreeMap<String, String>>() {});
            String json = OM.writeValueAsString(Arrays.asList(c.id, c.name, c.email, c.title, ex,
                    c.issuerEmail, c.issuedAt, c.expiresAt));
            return Numeric.toHexStringNoPrefix(MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    /** W3C-VC-style document pinned to IPFS. IPFS is public, so no name/email is included. */
    private Map<String, Object> vc(CredentialRecord c, AppUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("@context", List.of("https://www.w3.org/2018/credentials/v1"));
        m.put("type", List.of("VerifiableCredential", "AcademicCredential"));
        m.put("id", "urn:credchain:" + c.id);
        m.put("issuer", Map.of("id", "did:ethr:" + u.walletAddress, "name", u.institute));
        m.put("issuanceDate", Instant.ofEpochMilli(c.issuedAt).toString());
        if (c.expiresAt > 0) m.put("expirationDate", Instant.ofEpochMilli(c.expiresAt).toString());
        m.put("credentialSubject", Map.of("id", "did:ethr:" + BlockchainService.holderAddress(c.email), "title", c.title));
        m.put("integrity", Map.of("algorithm", "sha256", "hash", c.hash));
        return m;
    }

    public synchronized List<Result> issueBatch(AppUser u, List<Row> rows) {
        if (!"APPROVED".equals(u.status)) throw new ApiException(403, "Aapka account abhi approve nahi hua");
        if (rows == null || rows.isEmpty()) throw new ApiException(400, "Koi row nahi mili");
        if (rows.size() > 50) throw new ApiException(400, "Ek request me max 50 rows");
        Credentials creds = null;
        BigInteger nonce = null;
        try {
            if (chain.enabled) {
                creds = Credentials.create(crypto.decrypt(u.encryptedKey));
                nonce = chain.pendingNonce(creds.getAddress());
            }
        } catch (Exception e) { throw new ApiException(502, "Wallet/chain error: " + e.getMessage()); }

        List<Result> out = new ArrayList<>();
        for (Row r : rows) {
            String name = clean(r.name()), email = clean(r.email()).toLowerCase(), title = clean(r.title());
            String id = null;
            try {
                if (name.isEmpty() || email.isEmpty() || title.isEmpty()) throw new IllegalArgumentException("name, email, title zaruri hain");
                if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new IllegalArgumentException("email galat hai");
                long exp = parseExpiry(r.expiry());
                Map<String, String> ex = r.extra() == null ? new HashMap<>() : r.extra();

                CredentialRecord c = new CredentialRecord();
                c.id = id = newId(); c.name = name; c.email = email; c.title = title;
                c.extraJson = OM.writeValueAsString(new TreeMap<>(ex));
                c.issuerId = u.id; c.issuerEmail = u.email; c.institute = u.institute;
                c.issuedAt = System.currentTimeMillis(); c.expiresAt = exp; c.revoked = false;
                c.hash = hash(c);
                c.cid = ipfs.pin(c.id, vc(c, u));
                if (chain.enabled) {
                    c.txHash = chain.issue(creds, nonce, c.id, c.hash, c.cid,
                            BlockchainService.holderAddress(email), exp / 1000);
                    nonce = nonce.add(BigInteger.ONE);
                    c.chainStatus = "SENT";
                } else {
                    c.txHash = "0xMOCK" + c.hash.substring(0, 58);
                    c.chainStatus = "MOCK";
                }
                repo.save(c);
                out.add(new Result(c.id, name, email, title, true, null));
            } catch (Exception e) {
                log.warn("Issue failed for {}: {}", email, e.getMessage());
                out.add(new Result(null, name, email, title, false, e.getMessage()));
                try { if (chain.enabled && creds != null) nonce = chain.pendingNonce(creds.getAddress()); } catch (Exception ignored) {}
            }
        }
        return out;
    }

    public void revoke(AppUser u, String idIn) {
        CredentialRecord c = repo.findById(idIn.trim().toUpperCase()).orElseThrow(() -> new ApiException(404, "Credential nahi mila"));
        if (!Objects.equals(c.issuerId, u.id)) throw new ApiException(403, "Ye credential aapne issue nahi kiya");
        if (c.revoked) throw new ApiException(400, "Already revoked");
        try {
            if (chain.enabled && "SENT".equals(c.chainStatus))
                chain.revoke(Credentials.create(crypto.decrypt(u.encryptedKey)), c.id);
        } catch (Exception e) { throw new ApiException(502, "Blockchain revoke fail: " + e.getMessage()); }
        c.revoked = true;
        repo.save(c);
    }

    public List<CredentialRecord> mine(AppUser u) { return repo.findByIssuerIdOrderByIssuedAtDesc(u.id); }

    @SuppressWarnings("unchecked")
    public Map<String, Object> verify(String idIn) {
        String id = idIn == null ? "" : idIn.trim().toUpperCase();
        Map<String, Object> m = new LinkedHashMap<>();
        CredentialRecord c = repo.findById(id).orElse(null);
        if (c == null) { m.put("status", "notfound"); return m; }

        String calc = hash(c);
        boolean integrity = calc.equals(c.hash);
        boolean expired = c.expiresAt > 0 && System.currentTimeMillis() > c.expiresAt;
        String status = !integrity ? "tampered" : c.revoked ? "revoked" : expired ? "expired" : "valid";

        Map<String, Object> onChain = null;
        if (chain.enabled && "SENT".equals(c.chainStatus)) {
            try {
                var r = chain.verify(c.id, calc, c.txHash);
                onChain = Map.of("valid", r.valid(), "revoked", r.revoked(), "expired", r.expired(), "mined", r.mined());
                if (r.revoked() && !status.equals("tampered")) status = "revoked";
                else if (r.expired() && status.equals("valid")) status = "expired";
                else if (!r.valid() && status.equals("valid")) status = r.mined() ? "tampered" : "pending";
            } catch (Exception e) { log.warn("On-chain verify failed for {}: {}", id, e.getMessage()); }
        }
        m.put("status", status);
        m.put("id", c.id); m.put("name", c.name); m.put("title", c.title); m.put("institute", c.institute);
        try { m.put("extra", OM.readValue(c.extraJson, Map.class)); } catch (Exception e) { m.put("extra", Map.of()); }
        m.put("issuedAt", c.issuedAt); m.put("expiresAt", c.expiresAt);
        m.put("hash", c.hash); m.put("cid", c.cid); m.put("txHash", c.txHash);
        m.put("chainStatus", c.chainStatus); m.put("onChain", onChain);
        return m;
    }

    public List<Map<String, Object>> holder(String email) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CredentialRecord c : repo.findByEmailIgnoreCaseOrderByIssuedAtDesc(email.trim())) {
            boolean expired = c.expiresAt > 0 && System.currentTimeMillis() > c.expiresAt;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.id); m.put("title", c.title); m.put("name", c.name); m.put("institute", c.institute);
            m.put("issuedAt", c.issuedAt); m.put("status", c.revoked ? "revoked" : expired ? "expired" : "valid");
            out.add(m);
        }
        return out;
    }
}
