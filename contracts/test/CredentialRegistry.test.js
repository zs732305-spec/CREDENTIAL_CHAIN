const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry", () => {
  let registry, admin, issuer, holder, other;
  const id = ethers.id("CERT-001");
  const hash = ethers.sha256(ethers.toUtf8Bytes("degree.pdf contents"));
  const cid = "bafybeigdyrzt5examplecid";

  beforeEach(async () => {
    [admin, issuer, holder, other] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory("CredentialRegistry")).deploy();
    await registry.addIssuer(issuer.address);
  });

  it("only admin can add issuers", async () => {
    await expect(registry.connect(other).addIssuer(other.address)).to.be.reverted;
  });

  it("issuer can issue and verify succeeds", async () => {
    await registry.connect(issuer).issue(id, hash, cid, holder.address, 0);
    const [valid, revoked, expired] = await registry.verify(id, hash);
    expect(valid).to.equal(true);
    expect(revoked).to.equal(false);
    expect(expired).to.equal(false);
  });

  it("non-issuer cannot issue", async () => {
    await expect(registry.connect(other).issue(id, hash, cid, holder.address, 0)).to.be.reverted;
  });

  it("rejects duplicate id", async () => {
    await registry.connect(issuer).issue(id, hash, cid, holder.address, 0);
    await expect(registry.connect(issuer).issue(id, hash, cid, holder.address, 0))
      .to.be.revertedWith("Already exists");
  });

  it("wrong hash fails verification (tamper detection)", async () => {
    await registry.connect(issuer).issue(id, hash, cid, holder.address, 0);
    const fake = ethers.sha256(ethers.toUtf8Bytes("forged.pdf"));
    const [valid] = await registry.verify(id, fake);
    expect(valid).to.equal(false);
  });

  it("only original issuer can revoke; revoked is invalid", async () => {
    await registry.connect(issuer).issue(id, hash, cid, holder.address, 0);
    await expect(registry.connect(other).revoke(id)).to.be.revertedWith("Not issuer");
    await registry.connect(issuer).revoke(id);
    const [valid, revoked] = await registry.verify(id, hash);
    expect(valid).to.equal(false);
    expect(revoked).to.equal(true);
  });

  it("expired credential is invalid", async () => {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await registry.connect(issuer).issue(id, hash, cid, holder.address, now + 100);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine");
    const [valid, , expired] = await registry.verify(id, hash);
    expect(valid).to.equal(false);
    expect(expired).to.equal(true);
  });

  it("holder can list their credential ids", async () => {
    await registry.connect(issuer).issue(id, hash, cid, holder.address, 0);
    const ids = await registry.getHolderCredentialIds(holder.address);
    expect(ids).to.deep.equal([id]);
  });
});
