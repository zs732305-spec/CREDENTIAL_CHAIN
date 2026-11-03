package com.credchain.controller;

import com.credchain.service.CredentialService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
public class PublicController {
    private final CredentialService svc;
    public PublicController(CredentialService svc) { this.svc = svc; }

    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok"); }

    @GetMapping("/api/public/verify/{id}")
    public Map<String, Object> verify(@PathVariable String id) { return svc.verify(id); }

    @GetMapping("/api/public/holder")
    public List<Map<String, Object>> holder(@RequestParam String email) { return svc.holder(email); }
}
