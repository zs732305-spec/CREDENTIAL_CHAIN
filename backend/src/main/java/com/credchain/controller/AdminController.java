package com.credchain.controller;

import com.credchain.config.ApiException;
import com.credchain.dto.Dto.FundReq;
import com.credchain.repo.UserRepo;
import com.credchain.service.AuthService;
import com.credchain.service.BlockchainService;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final UserRepo users;
    private final AuthService auth;
    private final BlockchainService chain;

    public AdminController(UserRepo users, AuthService auth, BlockchainService chain) {
        this.users = users; this.auth = auth; this.chain = chain;
    }

    @GetMapping("/info")
    public Map<String, Object> info() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("chainEnabled", chain.enabled);
        m.put("adminAddress", chain.adminAddress());
        m.put("balance", chain.balance(chain.adminAddress()));
        m.put("contract", chain.contractAddress());
        return m;
    }

    @GetMapping("/issuers")
    public List<Map<String, Object>> issuers() {
        return users.findByRoleOrderByCreatedAtDesc("ISSUER").stream().map(u -> {
            Map<String, Object> m = auth.view(u);
            m.put("balance", chain.balance(u.walletAddress));
            return m;
        }).toList();
    }

    @PostMapping("/issuers/{id}/approve")
    public Map<String, String> approve(@PathVariable Long id) {
        try { auth.approve(id); } catch (ApiException e) { throw e; }
        catch (Exception e) { throw new ApiException(502, "Approve fail: " + e.getMessage()); }
        return Map.of("message", "Approved");
    }

    @PostMapping("/issuers/{id}/reject")
    public Map<String, String> reject(@PathVariable Long id) { auth.reject(id); return Map.of("message", "Rejected"); }

    @PostMapping("/issuers/{id}/fund")
    public Map<String, String> fund(@PathVariable Long id, @RequestBody(required = false) FundReq req) {
        try { return Map.of("txHash", auth.fund(id, req == null ? null : req.amount())); }
        catch (ApiException e) { throw e; }
        catch (Exception e) { throw new ApiException(502, "Fund fail: " + e.getMessage()); }
    }
}
