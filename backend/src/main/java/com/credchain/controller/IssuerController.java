package com.credchain.controller;

import com.credchain.model.AppUser;
import com.credchain.model.CredentialRecord;
import com.credchain.service.BlockchainService;
import com.credchain.service.CredentialService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/issuer")
public class IssuerController {
    public record BulkReq(List<CredentialService.Row> rows) {}

    private final CredentialService svc;
    private final BlockchainService chain;

    public IssuerController(CredentialService svc, BlockchainService chain) { this.svc = svc; this.chain = chain; }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal AppUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("email", u.email); m.put("institute", u.institute); m.put("status", u.status);
        m.put("wallet", u.walletAddress); m.put("balance", chain.balance(u.walletAddress));
        m.put("chainEnabled", chain.enabled);
        return m;
    }

    @PostMapping("/credentials/bulk")
    public Map<String, Object> bulk(@AuthenticationPrincipal AppUser u, @RequestBody BulkReq req) {
        return Map.of("results", svc.issueBatch(u, req.rows()));
    }

    @GetMapping("/credentials")
    public List<CredentialRecord> list(@AuthenticationPrincipal AppUser u) { return svc.mine(u); }

    @PostMapping("/credentials/{id}/revoke")
    public Map<String, String> revoke(@AuthenticationPrincipal AppUser u, @PathVariable String id) {
        svc.revoke(u, id);
        return Map.of("message", "Revoked");
    }
}
