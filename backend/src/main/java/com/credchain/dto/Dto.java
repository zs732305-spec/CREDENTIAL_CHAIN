package com.credchain.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public class Dto {
    public record RegisterReq(@NotBlank String institute,
                              @NotBlank @Email String email,
                              @NotBlank @Size(min = 6, message = "password kam se kam 6 characters") String password) {}
    public record LoginReq(@NotBlank String email, @NotBlank String password) {}
    public record FundReq(BigDecimal amount) {}
}
