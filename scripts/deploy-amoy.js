const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("Starting deployment to Polygon Amoy network...");

  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const deployer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log(`Deploying contracts with account: ${deployer.address}`);

  const balance = await provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} MATIC`);
  if (ethers.formatEther(balance) < 1) {
    throw new Error("Insufficient MATIC balance. Please fund your account.");
  }

  // Updated Wormhole Core Bridge address from docs
  const WORMHOLE_ADDRESS = "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35";
  // Token Bridge address (may need updating—check docs)
  const TOKEN_BRIDGE_ADDRESS = "0x1A86ba38a1BceB81D04316F9c655C05a84083C2f";
  console.log(`Wormhole Core Bridge Address: ${WORMHOLE_ADDRESS}`);
  console.log(`Token Bridge Address: ${TOKEN_BRIDGE_ADDRESS}`);

  const gasOptions = {
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
    maxFeePerGas: ethers.parseUnits("50", "gwei"),
  };

  console.log("Deploying SoulboundNFT...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT", deployer);
  const soulboundNFT = await SoulboundNFT.deploy(gasOptions);
  await soulboundNFT.waitForDeployment();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.target}`);

  console.log("Deploying CrossChainBridge...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge", deployer);
  console.log("Calling deploy with args:", WORMHOLE_ADDRESS, TOKEN_BRIDGE_ADDRESS);
  const crossChainBridge = await CrossChainBridge.deploy(WORMHOLE_ADDRESS, TOKEN_BRIDGE_ADDRESS, gasOptions);
  await crossChainBridge.waitForDeployment();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.target}`);

  console.log("Deploying Gold Token...");
  const CommodityToken = await ethers.getContractFactory("CommodityToken", deployer);
  const goldToken = await CommodityToken.deploy("Gold Token", "GOLD", "Gold", gasOptions);
  await goldToken.waitForDeployment();
  console.log(`Gold Token deployed to: ${goldToken.target}`);

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const BRIDGE_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BRIDGE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ROLE"));

  await soulboundNFT.grantRole(VERIFIER_ROLE, deployer.address, gasOptions);
  console.log(`Granted VERIFIER_ROLE to ${deployer.address} in SoulboundNFT`);

  await crossChainBridge.grantRole(BRIDGE_ADMIN_ROLE, deployer.address, gasOptions);
  await crossChainBridge.grantRole(ORACLE_ROLE, deployer.address, gasOptions);
  console.log(`Granted BRIDGE_ADMIN_ROLE and ORACLE_ROLE to ${deployer.address} in CrossChainBridge`);

  await goldToken.grantRole(MINTER_ROLE, deployer.address, gasOptions);
  await goldToken.grantRole(BRIDGE_ROLE, crossChainBridge.target, gasOptions);
  console.log(`Granted MINTER_ROLE to ${deployer.address} and BRIDGE_ROLE to ${crossChainBridge.target} in Gold Token`);

  const solanaProgramId = process.env.SOLANA_IDENTITY_PROGRAM_ID || "mock_solana_program_id";
  await crossChainBridge.setBridgeEndpoint("solana_devnet", solanaProgramId, gasOptions);
  console.log(`Set bridge endpoint for Solana Devnet: ${solanaProgramId}`);

  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const deploymentData = {
    network: "amoy",
    chainId: 80002,
    deployer: deployer.address,
    contracts: {
      SoulboundNFT: { address: soulboundNFT.target },
      CrossChainBridge: { address: crossChainBridge.target },
      CommodityToken_Gold: { address: goldToken.target },
    },
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(artifactsDir, "amoy.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment data saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });