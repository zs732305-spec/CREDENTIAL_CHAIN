package com.credchain.service;

import com.credchain.config.ApiException;
import com.credchain.dto.Dto.LoginReq;
import com.credchain.dto.Dto.RegisterReq;
import com.credchain.model.AppUser;
import com.credchain.repo.UserRepo;
import com.credchain.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {
    private final UserRepo users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final CryptoService crypto;
    private final BlockchainService chain;
    private final BigDecimal fundAmount;

    public AuthService(UserRepo users, PasswordEncoder encoder, JwtService jwt, CryptoService crypto,
                       BlockchainService chain, @Value("${app.fund-amount}") BigDecimal fundAmount) {
        this.users = users; this.encoder = encoder; this.jwt = jwt; this.crypto = crypto;
        this.chain = chain; this.fundAmount = fundAmount;
    }

    public void register(RegisterReq r) {
        String email = r.email().toLowerCase().trim();
        if (users.findByEmail(email).isPresent()) throw new ApiException(409, "Ye email already registered hai");
        AppUser u = new AppUser();
        u.email = email; u.institute = r.institute().trim();
        u.passwordHash = encoder.encode(r.password());
        u.role = "ISSUER"; u.status = "PENDING";
        users.save(u);
    }

    public Map<String, Object> login(LoginReq r) {
        AppUser u = users.findByEmail(r.email().toLowerCase().trim())
                .filter(x -> encoder.matches(r.password(), x.passwordHash))
                .orElseThrow(() -> new ApiException(401, "Email ya password galat hai"));
        return Map.of("token", jwt.create(u), "user", view(u));
    }

    public Map<String, Object> view(AppUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id); m.put("email", u.email); m.put("institute", u.institute);
        m.put("role", u.role); m.put("status", u.status); m.put("wallet", u.walletAddress);
        return m;
    }

    /** Admin approves an issuer: auto-create wallet, grant on-chain role, fund gas. */
    public synchronized void approve(Long id) throws Exception {
        AppUser u = users.findById(id).orElseThrow(() -> new ApiException(404, "Issuer nahi mila"));
        if (!"ISSUER".equals(u.role)) throw new ApiException(400, "Sirf issuer approve ho sakta hai");
        if (u.walletAddress == null) {
            BlockchainService.Wallet w = chain.createWallet();
            u.walletAddress = w.address();
            u.encryptedKey = crypto.encrypt(w.privateKey());
            users.save(u);
        }
        if (chain.enabled) chain.addIssuer(u.walletAddress, fundAmount);
        u.status = "APPROVED";
        users.save(u);
    }

    public void reject(Long id) {
        AppUser u = users.findById(id).orElseThrow(() -> new ApiException(404, "Issuer nahi mila"));
        u.status = "REJECTED";
        users.save(u);
    }

    public String fund(Long id, BigDecimal amount) throws Exception {
        AppUser u = users.findById(id).orElseThrow(() -> new ApiException(404, "Issuer nahi mila"));
        if (u.walletAddress == null) throw new ApiException(400, "Is issuer ka wallet abhi nahi bana (pehle approve karo)");
        if (!chain.enabled) throw new ApiException(400, "Blockchain disabled (MOCK mode)");
        return chain.fund(u.walletAddress, amount == null ? fundAmount : amount);
    }
}
