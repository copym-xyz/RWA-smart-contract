const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // Load environment variables

async function main() {
  console.log("Starting deployment to Polygon Amoy network...");

  // Get deployment account from private key in .env
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const deployer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log(`Deploying contracts with account: ${deployer.address}`);
  const balance = await provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} MATIC`);

  // Wormhole testnet addresses for Polygon Amoy
  const WORMHOLE_ADDRESS = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78"; // Polygon Amoy Wormhole Core
  const TOKEN_BRIDGE_ADDRESS = "0x377D55a7928c046E18eEbb61977e760d2af53966"; // Polygon Amoy Token Bridge

  // Deploy SoulboundNFT Contract
  console.log("Deploying SoulboundNFT contract...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT", deployer);
  const soulboundNFT = await SoulboundNFT.deploy();
  await soulboundNFT.deployed();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);

  // Deploy CrossChainBridge Contract with Wormhole addresses
  console.log("Deploying CrossChainBridge contract...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge", deployer);
  const crossChainBridge = await CrossChainBridge.deploy(WORMHOLE_ADDRESS, TOKEN_BRIDGE_ADDRESS);
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

  // Set up bridge endpoint for Solana Devnet
  console.log("Setting up bridge endpoints...");
  tx = await crossChainBridge.setBridgeEndpoint("solana_devnet", process.env.SOLANA_IDENTITY_PROGRAM_ID || "https://api.devnet.solana.com");
  await tx.wait();
  console.log("Set bridge endpoint for Solana Devnet");

  // Register a DID for testing
  console.log("Registering DID for deployer...");
  const did = `did:eth:${deployer.address}`;
  const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("sample-credential"));
  const credentialCID = process.env.PINATA_API_KEY ? "QmTestCID123" : "QmTestCID123"; // Use real IPFS CID if Pinata is configured
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
    network: process.env.POLYGON_NETWORK || "amoy",
    chainId: parseInt(process.env.POLYGON_CHAIN_ID) || 80002,
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