const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("Starting deployment to Polygon Amoy network...");

  const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const deployer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} MATIC`);

  const WORMHOLE_ADDRESS = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78";
  const TOKEN_BRIDGE_ADDRESS = "0x377D55a7928c046E18eEbb61977e760d2af53966";
  console.log(`Wormhole Address (checksummed): ${WORMHOLE_ADDRESS}`);
  console.log(`Token Bridge Address (checksummed): ${TOKEN_BRIDGE_ADDRESS}`);

  // Gas settings
  const gasOptions = {
    maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"), // 30 Gwei
    maxFeePerGas: ethers.utils.parseUnits("50", "gwei"),        // 50 Gwei
  };

  // Deploy SoulboundNFT contract
  console.log("Deploying SoulboundNFT contract...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT", deployer);
  const soulboundNFT = await SoulboundNFT.deploy(gasOptions);
  await soulboundNFT.deployed();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);

  // Deploy CrossChainBridge contract
  console.log("Deploying CrossChainBridge contract...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge", deployer);
  const crossChainBridge = await CrossChainBridge.deploy(WORMHOLE_ADDRESS, TOKEN_BRIDGE_ADDRESS, gasOptions);
  await crossChainBridge.deployed();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.address}`);

  // Set up roles
  console.log("Setting up roles...");
  const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
  const BRIDGE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));

  console.log("Granting roles to deployer...");
  let tx = await soulboundNFT.grantRole(VERIFIER_ROLE, deployer.address, gasOptions);
  await tx.wait();
  console.log(`Granted VERIFIER_ROLE to ${deployer.address} in SoulboundNFT`);

  tx = await crossChainBridge.grantRole(BRIDGE_ADMIN_ROLE, deployer.address, gasOptions);
  await tx.wait();
  console.log(`Granted BRIDGE_ADMIN_ROLE to ${deployer.address} in CrossChainBridge`);

  tx = await crossChainBridge.grantRole(ORACLE_ROLE, deployer.address, gasOptions);
  await tx.wait();
  console.log(`Granted ORACLE_ROLE to ${deployer.address} in CrossChainBridge`);

  // Set bridge endpoint
  console.log("Setting up bridge endpoints...");
  tx = await crossChainBridge.setBridgeEndpoint(
    "solana_devnet",
    process.env.SOLANA_IDENTITY_PROGRAM_ID || "https://api.devnet.solana.com",
    gasOptions
  );
  await tx.wait();
  console.log("Set bridge endpoint for Solana Devnet");

  // Register DID
  console.log("Registering DID for deployer...");
  const did = `did:eth:${deployer.address}`;
  const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("sample-credential"));
  const credentialCID = process.env.PINATA_API_KEY ? "QmTestCID123" : "QmTestCID123";
  tx = await soulboundNFT.verifyIdentity(deployer.address, did, credentialHash, credentialCID, gasOptions);
  await tx.wait();
  console.log(`Registered DID: ${did}`);

  const tokenId = await soulboundNFT.didToTokenId(did);
  console.log(`Token ID for ${did}: ${tokenId.toString()}`);

  // Save deployment data
  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

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