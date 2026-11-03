package com.credchain.repo;

import com.credchain.model.CredentialRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CredRepo extends JpaRepository<CredentialRecord, String> {
    List<CredentialRecord> findByIssuerIdOrderByIssuedAtDesc(Long issuerId);
    List<CredentialRecord> findByEmailIgnoreCaseOrderByIssuedAtDesc(String email);
}
