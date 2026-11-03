package com.credchain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(unique = true, nullable = false)
    public String email;
    public String institute;
    @JsonIgnore public String passwordHash;
    public String role;    // ADMIN | ISSUER
    public String status;  // PENDING | APPROVED | REJECTED
    public String walletAddress;
    @JsonIgnore @Column(length = 1000) public String encryptedKey;
    public long createdAt = System.currentTimeMillis();
}
