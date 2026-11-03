package com.credchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.crypto.*;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.http.HttpService;
import org.web3j.utils.Convert;
import org.web3j.utils.Numeric;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Talks to the CredentialRegistry contract on Polygon (Amoy) using plain Web3j.
 * If CHAIN_RPC_URL / ADMIN_PRIVATE_KEY / CONTRACT_ADDRESS are blank, enabled=false (MOCK mode).
 */
@Service
public class BlockchainService {
    private static final Logger log = LoggerFactory.getLogger(BlockchainService.class);

    public record Wallet(String address, String privateKey) {}
    public record OnChain(boolean valid, boolean revoked, boolean expired, boolean mined) {}

    public final boolean enabled;
    private final Web3j web3j;
    private final Credentials admin;
    private final String contract;
    private final long chainId;

    public BlockchainService(@Value("${chain.rpc}") String rpc, @Value("${chain.admin-key}") String key,
                             @Value("${chain.contract}") String contract, @Value("${chain.id}") long chainId) {
        this.enabled = !rpc.isBlank() && !key.isBlank() && !contract.isBlank();
        this.contract = contract;
        this.chainId = chainId;
        this.web3j = enabled ? Web3j.build(new HttpService(rpc)) : null;
        this.admin = enabled ? Credentials.create(key) : null;
        log.info(enabled ? "Blockchain ENABLED, contract {}" : "Blockchain DISABLED (MOCK mode)", contract);
    }

    public String adminAddress() { return enabled ? admin.getAddress() : null; }
    public String contractAddress() { return contract; }

    public Wallet createWallet() throws Exception {
        ECKeyPair kp = Keys.createEcKeyPair();
        return new Wallet("0x" + Keys.getAddress(kp), Numeric.toHexStringNoPrefixZeroPadded(kp.getPrivateKey(), 64));
    }

    /** Privacy-friendly pseudo address for a holder, derived from the email hash (no wallet needed). */
    public static String holderAddress(String email) {
        byte[] h = Hash.sha3(email.toLowerCase().trim().getBytes(StandardCharsets.UTF_8));
        return "0x" + Numeric.toHexStringNoPrefix(h).substring(24);
    }

    private static byte[] idBytes(String id) { return Hash.sha3(id.getBytes(StandardCharsets.UTF_8)); }

    public BigInteger pendingNonce(String addr) throws IOException {
        return web3j.ethGetTransactionCount(addr, DefaultBlockParameterName.PENDING).send().getTransactionCount();
    }

    public BigDecimal balance(String addr) {
        if (!enabled || addr == null) return null;
        try {
            return Convert.fromWei(new BigDecimal(web3j.ethGetBalance(addr, DefaultBlockParameterName.LATEST)
                    .send().getBalance()), Convert.Unit.ETHER);
        } catch (Exception e) { return null; }
    }

    private BigInteger gasPrice() throws IOException {
        return web3j.ethGasPrice().send().getGasPrice().multiply(BigInteger.valueOf(13)).divide(BigInteger.TEN);
    }

    private String send(Credentials from, BigInteger nonce, String to, String data, long gasLimit, BigInteger value)
            throws Exception {
        RawTransaction raw = RawTransaction.createTransaction(nonce, gasPrice(), BigInteger.valueOf(gasLimit), to, value, data);
        byte[] signed = TransactionEncoder.signMessage(raw, chainId, from);
        EthSendTransaction r = web3j.ethSendRawTransaction(Numeric.toHexString(signed)).send();
        if (r.hasError()) throw new RuntimeException(r.getError().getMessage());
        return r.getTransactionHash();
    }

    private void waitReceipt(String hash) throws Exception {
        for (int i = 0; i < 60; i++) {
            var r = web3j.ethGetTransactionReceipt(hash).send().getTransactionReceipt();
            if (r.isPresent()) {
                if (!"0x1".equals(r.get().getStatus())) throw new RuntimeException("Transaction reverted: " + hash);
                return;
            }
            Thread.sleep(2000);
        }
        throw new RuntimeException("Timeout waiting for tx " + hash);
    }

    /** Admin grants ISSUER_ROLE and tops up gas. */
    public synchronized void addIssuer(String addr, BigDecimal fundPol) throws Exception {
        Function f = new Function("addIssuer", Arrays.asList(new Address(addr)), Collections.emptyList());
        String h = send(admin, pendingNonce(admin.getAddress()), contract, FunctionEncoder.encode(f), 200000, BigInteger.ZERO);
        waitReceipt(h);
        if (fundPol != null && fundPol.signum() > 0) fund(addr, fundPol);
    }

    public synchronized String fund(String addr, BigDecimal pol) throws Exception {
        BigInteger wei = Convert.toWei(pol, Convert.Unit.ETHER).toBigInteger();
        String h = send(admin, pendingNonce(admin.getAddress()), addr, "", 21000, wei);
        waitReceipt(h);
        return h;
    }

    /** Sends issue() without waiting for confirmation (fast bulk). Caller manages the nonce. */
    public String issue(Credentials from, BigInteger nonce, String id, String hashHex, String cid,
                        String holder, long expiresAtSec) throws Exception {
        Function f = new Function("issue", Arrays.asList(
                new Bytes32(idBytes(id)), new Bytes32(Numeric.hexStringToByteArray(hashHex)),
                new Utf8String(cid), new Address(holder), new Uint64(BigInteger.valueOf(expiresAtSec))),
                Collections.emptyList());
        return send(from, nonce, contract, FunctionEncoder.encode(f), 400000, BigInteger.ZERO);
    }

    public String revoke(Credentials from, String id) throws Exception {
        Function f = new Function("revoke", Arrays.asList(new Bytes32(idBytes(id))), Collections.emptyList());
        return send(from, pendingNonce(from.getAddress()), contract, FunctionEncoder.encode(f), 120000, BigInteger.ZERO);
    }

    public OnChain verify(String id, String hashHex, String txHash) throws Exception {
        Function f = new Function("verify",
                Arrays.asList(new Bytes32(idBytes(id)), new Bytes32(Numeric.hexStringToByteArray(hashHex))),
                Arrays.asList(new TypeReference<Bool>() {}, new TypeReference<Bool>() {}, new TypeReference<Bool>() {}));
        String out = web3j.ethCall(Transaction.createEthCallTransaction(admin.getAddress(), contract,
                FunctionEncoder.encode(f)), DefaultBlockParameterName.LATEST).send().getValue();
        List<Type> t = FunctionReturnDecoder.decode(out, f.getOutputParameters());
        boolean mined = txHash != null && web3j.ethGetTransactionReceipt(txHash).send().getTransactionReceipt().isPresent();
        return new OnChain((Boolean) t.get(0).getValue(), (Boolean) t.get(1).getValue(), (Boolean) t.get(2).getValue(), mined);
    }
}
