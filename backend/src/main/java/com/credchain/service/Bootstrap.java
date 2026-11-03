package com.credchain.service;

import com.credchain.model.AppUser;
import com.credchain.repo.UserRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the first ADMIN user from env vars on startup. */
@Component
public class Bootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(Bootstrap.class);
    private final UserRepo users;
    private final PasswordEncoder encoder;
    private final BlockchainService chain;
    private final String email, password;

    public Bootstrap(UserRepo users, PasswordEncoder encoder, BlockchainService chain,
                     @Value("${app.admin-email}") String email, @Value("${app.admin-password}") String password) {
        this.users = users; this.encoder = encoder; this.chain = chain; this.email = email; this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        String em = email.toLowerCase().trim();
        if (users.findByEmail(em).isPresent()) return;
        AppUser u = new AppUser();
        u.email = em; u.institute = "Platform Admin";
        u.passwordHash = encoder.encode(password);
        u.role = "ADMIN"; u.status = "APPROVED"; u.walletAddress = chain.adminAddress();
        users.save(u);
        log.info("Admin user created: {}", em);
    }
}
