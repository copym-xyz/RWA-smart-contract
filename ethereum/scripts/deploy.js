// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Deploy SoulboundNFT contract
  console.log("Deploying SoulboundNFT contract...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const soulboundNFT = await SoulboundNFT.deploy();
  await soulboundNFT.deployed();
  console.log("SoulboundNFT deployed to:", soulboundNFT.address);

  // Deploy CrossChainBridge contract
  console.log("Deploying CrossChainBridge contract...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const crossChainBridge = await CrossChainBridge.deploy(soulboundNFT.address);
  await crossChainBridge.deployed();
  console.log("CrossChainBridge deployed to:", crossChainBridge.address);

  // Deploy AssetFactory contract
  console.log("Deploying AssetFactory contract...");
  const AssetFactory = await ethers.getContractFactory("AssetFactory");
  const assetFactory = await AssetFactory.deploy(crossChainBridge.address, soulboundNFT.address);
  await assetFactory.deployed();
  console.log("AssetFactory deployed to:", assetFactory.address);

  // Set up roles
  console.log("Setting up roles and permissions...");
  
  // Grant BRIDGE_ROLE to CrossChainBridge in SoulboundNFT
  const BRIDGE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ROLE"));
  await soulboundNFT.grantRole(BRIDGE_ROLE, crossChainBridge.address);
  console.log("Granted BRIDGE_ROLE to CrossChainBridge in SoulboundNFT");
  
  // Grant SERVICE_ROLE to AssetFactory in CrossChainBridge
  const SERVICE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SERVICE_ROLE"));
  await crossChainBridge.grantRole(SERVICE_ROLE, assetFactory.address);
  console.log("Granted SERVICE_ROLE to AssetFactory in CrossChainBridge");

  console.log("Deployment completed successfully!");
  
  // Return all deployed contract addresses
  return {
    SoulboundNFT: soulboundNFT.address,
    CrossChainBridge: crossChainBridge.address,
    AssetFactory: assetFactory.address
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });