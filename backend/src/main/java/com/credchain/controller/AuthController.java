package com.credchain.controller;

import com.credchain.dto.Dto.LoginReq;
import com.credchain.dto.Dto.RegisterReq;
import com.credchain.model.AppUser;
import com.credchain.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth) { this.auth = auth; }

    @PostMapping("/register")
    public Map<String, String> register(@Valid @RequestBody RegisterReq r) {
        auth.register(r);
        return Map.of("message", "Registered. Admin approval ke baad login se credentials issue kar sakte ho.");
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginReq r) { return auth.login(r); }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal AppUser u) { return auth.view(u); }
}
