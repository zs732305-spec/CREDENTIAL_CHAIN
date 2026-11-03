package com.credchain.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

/** Pins JSON to IPFS through Pinata. If PINATA_JWT is blank, pinning is skipped. */
@Service
public class IpfsService {
    private final String jwt;
    private final ObjectMapper om = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    public IpfsService(@Value("${app.pinata-jwt:}") String jwt) { this.jwt = jwt; }

    public String pin(String name, Map<String, Object> content) throws Exception {
        if (jwt == null || jwt.isBlank()) return "not-pinned";
        String body = om.writeValueAsString(Map.of("pinataContent", content, "pinataMetadata", Map.of("name", name)));
        HttpRequest rq = HttpRequest.newBuilder(URI.create("https://api.pinata.cloud/pinning/pinJSONToIPFS"))
                .header("Authorization", "Bearer " + jwt)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        HttpResponse<String> rs = http.send(rq, HttpResponse.BodyHandlers.ofString());
        if (rs.statusCode() / 100 != 2) throw new RuntimeException("Pinata error " + rs.statusCode());
        return om.readTree(rs.body()).get("IpfsHash").asText();
    }
}
