// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CredentialRegistry
/// @notice Stores only hash + IPFS CID of credentials (no personal data on-chain).
contract CredentialRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Credential {
        bytes32 hash;      // SHA-256 of the credential document
        string ipfsCid;    // IPFS CID of the document / VC JSON
        address issuer;
        address holder;
        uint64 issuedAt;
        uint64 expiresAt;  // 0 = never expires
        bool revoked;
    }

    mapping(bytes32 => Credential) private _credentials;
    mapping(address => bytes32[]) private _holderCredentials;

    event Issued(bytes32 indexed id, address indexed issuer, address indexed holder, string ipfsCid);
    event Revoked(bytes32 indexed id, address indexed issuer);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// Admin approves an institute as issuer.
    function addIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ISSUER_ROLE, issuer);
    }

    function removeIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ISSUER_ROLE, issuer);
    }

    function issue(
        bytes32 id,
        bytes32 hash,
        string calldata ipfsCid,
        address holder,
        uint64 expiresAt
    ) external onlyRole(ISSUER_ROLE) {
        require(_credentials[id].issuedAt == 0, "Already exists");
        require(holder != address(0), "Invalid holder");
        require(expiresAt == 0 || expiresAt > block.timestamp, "Bad expiry");

        _credentials[id] = Credential(
            hash, ipfsCid, msg.sender, holder, uint64(block.timestamp), expiresAt, false
        );
        _holderCredentials[holder].push(id);
        emit Issued(id, msg.sender, holder, ipfsCid);
    }

    function revoke(bytes32 id) external {
        Credential storage c = _credentials[id];
        require(c.issuedAt != 0, "Not found");
        require(c.issuer == msg.sender, "Not issuer");
        require(!c.revoked, "Already revoked");
        c.revoked = true;
        emit Revoked(id, msg.sender);
    }

    /// @return valid   exists + hash matches + not revoked + not expired
    /// @return revoked whether it was revoked
    /// @return expired whether it is past expiry
    function verify(bytes32 id, bytes32 hash)
        external
        view
        returns (bool valid, bool revoked, bool expired)
    {
        Credential storage c = _credentials[id];
        bool exists = c.issuedAt != 0;
        revoked = c.revoked;
        expired = c.expiresAt != 0 && block.timestamp > c.expiresAt;
        valid = exists && c.hash == hash && !revoked && !expired;
    }

    function getCredential(bytes32 id) external view returns (Credential memory) {
        require(_credentials[id].issuedAt != 0, "Not found");
        return _credentials[id];
    }

    function getHolderCredentialIds(address holder) external view returns (bytes32[] memory) {
        return _holderCredentials[holder];
    }
}
