const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment to local Hardhat network...");

  // Get signers
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Deploy MockWormhole
  console.log("Deploying MockWormhole...");
  const MockWormhole = await ethers.getContractFactory("MockWormhole");
  const mockWormhole = await MockWormhole.deploy();
  await mockWormhole.waitForDeployment(); // Ensure deployment is confirmed
  console.log("MockWormhole instance:", mockWormhole.target ? mockWormhole.target : "undefined");
  console.log(`MockWormhole deployed to: ${mockWormhole.target}`);

  // Deploy MockTokenBridge
  console.log("Deploying MockTokenBridge...");
  const MockTokenBridge = await ethers.getContractFactory("MockTokenBridge");
  const mockTokenBridge = await MockTokenBridge.deploy();
  await mockTokenBridge.waitForDeployment();
  console.log("MockTokenBridge instance:", mockTokenBridge.target ? mockTokenBridge.target : "undefined");
  console.log(`MockTokenBridge deployed to: ${mockTokenBridge.target}`);

  // Deploy SoulboundNFT
  console.log("Deploying SoulboundNFT...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const soulboundNFT = await SoulboundNFT.deploy();
  await soulboundNFT.waitForDeployment();
  console.log("SoulboundNFT instance:", soulboundNFT.target ? soulboundNFT.target : "undefined");
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.target}`);

  // Deploy CrossChainBridge
  console.log("Deploying CrossChainBridge...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const crossChainBridge = await CrossChainBridge.deploy(mockWormhole.target, mockTokenBridge.target);
  await crossChainBridge.waitForDeployment();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.target}`);

  // Deploy CommodityTokens
  const commodities = [
    { name: "Gold Token", symbol: "GOLD", type: "Gold" },
    { name: "Oil Token", symbol: "OIL", type: "Oil" },
  ];
  const commodityTokens = {};
  for (const commodity of commodities) {
    console.log(`Deploying ${commodity.type} Token...`);
    const CommodityToken = await ethers.getContractFactory("CommodityToken");
    const commodityToken = await CommodityToken.deploy(commodity.name, commodity.symbol, commodity.type);
    await commodityToken.waitForDeployment();
    console.log(`${commodity.type} Token deployed to: ${commodityToken.target}`);
    commodityTokens[commodity.type] = commodityToken;
  }

  // Set up roles using ethers.utils
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const BRIDGE_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BRIDGE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ROLE"));

  console.log("Setting up roles...");
  await soulboundNFT.grantRole(VERIFIER_ROLE, deployer.address);
  await crossChainBridge.grantRole(BRIDGE_ADMIN_ROLE, deployer.address);
  await crossChainBridge.grantRole(ORACLE_ROLE, deployer.address);
  for (const commodity of Object.values(commodityTokens)) {
    await commodity.grantRole(MINTER_ROLE, deployer.address);
    await commodity.grantRole(BRIDGE_ROLE, crossChainBridge.target);
  }

  // Set bridge endpoint
  console.log("Setting bridge endpoint...");
  await crossChainBridge.setBridgeEndpoint("solana_devnet", "mock_solana_program_id");

  // Save deployment data
  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const deploymentData = {
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    contracts: {
      SoulboundNFT: { address: soulboundNFT.target },
      CrossChainBridge: { address: crossChainBridge.target },
      MockWormhole: { address: mockWormhole.target },
      MockTokenBridge: { address: mockTokenBridge.target },
      ...Object.fromEntries(
        Object.entries(commodityTokens).map(([type, token]) => [`CommodityToken_${type}`, { address: token.target }])
      ),
    },
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(artifactsDir, "localhost.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment data saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });