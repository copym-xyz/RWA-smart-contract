const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment to Polygon Amoy network...");

  // Get deployment account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} MATIC`);

  // Deploy SoulboundNFT Contract
  console.log("Deploying SoulboundNFT contract...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const soulboundNFT = await SoulboundNFT.deploy();
  await soulboundNFT.deployed(); // ethers v5 uses .deployed()
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);

  // Deploy CrossChainBridge Contract
  console.log("Deploying CrossChainBridge contract...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const crossChainBridge = await CrossChainBridge.deploy();
  await crossChainBridge.deployed();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.address}`);

  // Set up roles
  console.log("Setting up roles...");
  const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
  const BRIDGE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));

  console.log("Granting roles to deployer...");
  let tx = await soulboundNFT.grantRole(VERIFIER_ROLE, deployer.address);
  await tx.wait();
  console.log(`Granted VERIFIER_ROLE to ${deployer.address} in SoulboundNFT`);

  tx = await crossChainBridge.grantRole(BRIDGE_ADMIN_ROLE, deployer.address);
  await tx.wait();
  console.log(`Granted BRIDGE_ADMIN_ROLE to ${deployer.address} in CrossChainBridge`);

  tx = await crossChainBridge.grantRole(ORACLE_ROLE, deployer.address);
  await tx.wait();
  console.log(`Granted ORACLE_ROLE to ${deployer.address} in CrossChainBridge`);

  // Set up bridge endpoints for Solana
  console.log("Setting up bridge endpoints...");
  tx = await crossChainBridge.setBridgeEndpoint("solana-devnet", "https://api.devnet.solana.com");
  await tx.wait();
  console.log("Set bridge endpoint for Solana devnet");

  // Register a DID for testing
  console.log("Registering DID for deployer...");
  const did = `did:eth:${deployer.address}`;
  const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("sample-credential"));
  const credentialCID = "QmTestCID123"; // Replace with real IPFS CID if needed
  tx = await soulboundNFT.verifyIdentity(deployer.address, did, credentialHash, credentialCID);
  await tx.wait();
  console.log(`Registered DID: ${did}`);

  // Verify the DID mapping
  const tokenId = await soulboundNFT.didToTokenId(did);
  console.log(`Token ID for ${did}: ${tokenId.toString()}`);

  // Create deployment artifacts directory if it doesn’t exist
  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save deployment information
  const deploymentData = {
    network: "amoy",
    chainId: 80002,
    deployer: deployer.address,
    contracts: {
      SoulboundNFT: { address: soulboundNFT.address },
      CrossChainBridge: { address: crossChainBridge.address },
    },
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(artifactsDir, "amoy.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment data saved to ${deploymentPath}`);

  console.log("Polygon Amoy deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });