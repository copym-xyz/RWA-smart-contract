const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("Starting deployment to Polygon Amoy network...");

  // Initialize provider and deployer
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const deployer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log(`Deploying contracts with account: ${deployer.address}`);

  // Wormhole and Token Bridge addresses for Polygon Amoy
  const WORMHOLE_ADDRESS = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78";
  const TOKEN_BRIDGE_ADDRESS = "0x377D55a7928c046E18eEbb61977e760d2af53966";

  // Gas options
  const gasOptions = {
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
    maxFeePerGas: ethers.parseUnits("50", "gwei"),
  };

  // Deploy SoulboundNFT
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT", deployer);
  const soulboundNFT = await SoulboundNFT.deploy(gasOptions);
  await soulboundNFT.deployed();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);

  // Deploy CrossChainBridge
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge", deployer);
  const crossChainBridge = await CrossChainBridge.deploy(WORMHOLE_ADDRESS, TOKEN_BRIDGE_ADDRESS, gasOptions);
  await crossChainBridge.deployed();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.address}`);

  // Define commodities to deploy
  const commodities = [
    { name: "Gold Token", symbol: "GOLD", type: "Gold" },
    { name: "Oil Token", symbol: "OIL", type: "Oil" },
  ];

  // Object to store deployed commodity tokens
  const commodityTokens = {};

  // Deploy CommodityToken instances
  for (const commodity of commodities) {
    const CommodityToken = await ethers.getContractFactory("CommodityToken", deployer);
    const commodityToken = await CommodityToken.deploy(commodity.name, commodity.symbol, commodity.type, gasOptions);
    await commodityToken.deployed();
    console.log(`${commodity.type} Token deployed to: ${commodityToken.address}`);
    commodityTokens[commodity.type] = commodityToken;
  }

  // Set up roles
  const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
  const BRIDGE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const BRIDGE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ROLE"));

  // Grant roles for SoulboundNFT
  await soulboundNFT.grantRole(VERIFIER_ROLE, deployer.address, gasOptions);
  console.log(`Granted VERIFIER_ROLE to ${deployer.address} in SoulboundNFT`);

  // Grant roles for CrossChainBridge
  await crossChainBridge.grantRole(BRIDGE_ADMIN_ROLE, deployer.address, gasOptions);
  await crossChainBridge.grantRole(ORACLE_ROLE, deployer.address, gasOptions);
  console.log(`Granted BRIDGE_ADMIN_ROLE and ORACLE_ROLE to ${deployer.address} in CrossChainBridge`);

  // Grant roles for CommodityTokens
  for (const commodity of Object.values(commodityTokens)) {
    await commodity.grantRole(MINTER_ROLE, deployer.address, gasOptions);
    await commodity.grantRole(BRIDGE_ROLE, crossChainBridge.address, gasOptions);
    console.log(`Granted MINTER_ROLE to ${deployer.address} and BRIDGE_ROLE to ${crossChainBridge.address} in ${commodity.address}`);
  }

  // Set bridge endpoint
  await crossChainBridge.setBridgeEndpoint(
    "solana_devnet",
    process.env.SOLANA_IDENTITY_PROGRAM_ID || "https://api.devnet.solana.com",
    gasOptions
  );
  console.log("Set bridge endpoint for Solana Devnet");

  // Save deployment data
  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const deploymentData = {
    network: "amoy",
    chainId: parseInt(process.env.POLYGON_CHAIN_ID) || 80002,
    deployer: deployer.address,
    contracts: {
      SoulboundNFT: { address: soulboundNFT.address },
      CrossChainBridge: { address: crossChainBridge.address },
      ...Object.fromEntries(
        Object.entries(commodityTokens).map(([type, token]) => [`CommodityToken_${type}`, { address: token.address }])
      ),
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