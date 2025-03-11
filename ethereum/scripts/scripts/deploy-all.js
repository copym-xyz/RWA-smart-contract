const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Get the contract factories
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const AssetFactory = await ethers.getContractFactory("AssetFactory");

  // Deploy SoulboundNFT
  console.log("Deploying SoulboundNFT...");
  const soulboundNFT = await SoulboundNFT.deploy("Identity Soulbound Token", "IST");
  await soulboundNFT.deployed();
  console.log("SoulboundNFT deployed to:", soulboundNFT.address);

  // Deploy CrossChainBridge
  console.log("Deploying CrossChainBridge...");
  const crossChainBridge = await CrossChainBridge.deploy();
  await crossChainBridge.deployed();
  console.log("CrossChainBridge deployed to:", crossChainBridge.address);

  // Deploy AssetFactory
  console.log("Deploying AssetFactory...");
  const assetFactory = await AssetFactory.deploy(crossChainBridge.address, soulboundNFT.address);
  await assetFactory.deployed();
  console.log("AssetFactory deployed to:", assetFactory.address);

  // Set up roles
  console.log("Setting up roles...");
  
  // Get signers
  const [deployer] = await ethers.getSigners();

  // Grant BRIDGE_ROLE to CrossChainBridge contract in SoulboundNFT
  const BRIDGE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ROLE"));
  await soulboundNFT.grantRole(BRIDGE_ROLE, crossChainBridge.address);
  console.log("Granted BRIDGE_ROLE to CrossChainBridge in SoulboundNFT");

  // Grant CREATOR_ROLE to deployer in AssetFactory
  const CREATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CREATOR_ROLE"));
  await assetFactory.grantRole(CREATOR_ROLE, deployer.address);
  console.log("Granted CREATOR_ROLE to deployer in AssetFactory");

  // Set up chain validators in CrossChainBridge
  await crossChainBridge.setChainValidator("eth-mainnet", deployer.address);
  await crossChainBridge.setChainValidator("solana-mainnet", deployer.address);
  await crossChainBridge.setChainValidator("polygon-mainnet", deployer.address);
  console.log("Set up chain validators in CrossChainBridge");

  console.log("Deployment complete!");
  
  // Return the contract addresses for verification
  return {
    SoulboundNFT: soulboundNFT.address,
    CrossChainBridge: crossChainBridge.address,
    AssetFactory: assetFactory.address
  };
}

// Execute deployment
main()
  .then((addresses) => {
    console.log("Deployment successful!");
    console.log("Deployed contract addresses:", addresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });