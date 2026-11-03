package com.credchain.model;

import jakarta.persistence.*;

@Entity
@Table(name = "credentials")
public class CredentialRecord {
    @Id public String id;                 // e.g. CERT-AB12CD
    public String name;
    public String email;
    public String title;
    @Column(columnDefinition = "text") public String extraJson;
    public Long issuerId;
    public String issuerEmail;
    public String institute;
    public long issuedAt;
    public long expiresAt;                // 0 = never
    public boolean revoked;
    public String hash;                   // sha256 of canonical record (hex, no 0x)
    public String cid;                    // IPFS CID
    public String txHash;
    public String chainStatus;            // SENT | MOCK
}
