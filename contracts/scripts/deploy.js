const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Registry = await hre.ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log("CredentialRegistry deployed to:", address);

  if (process.env.ISSUER_ADDRESS) {
    const tx = await registry.addIssuer(process.env.ISSUER_ADDRESS);
    await tx.wait();
    console.log("Issuer role granted to:", process.env.ISSUER_ADDRESS);
  }

  console.log("\nBackend .env me daalo:  CONTRACT_ADDRESS=" + address);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
