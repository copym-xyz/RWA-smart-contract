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
  await soulboundNFT.deployed();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);

  // Deploy CrossChainBridge Contract
  console.log("Deploying CrossChainBridge contract...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const crossChainBridge = await CrossChainBridge.deploy();
  await crossChainBridge.deployed();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.address}`);

  // Set up roles
  console.log("Setting up roles...");
 
  // Define roles
  const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
  const BRIDGE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
 
  // Grant roles
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
  
  // Set Solana devnet endpoint
  tx = await crossChainBridge.setBridgeEndpoint(
    "solana-devnet",
    "https://api.devnet.solana.com"
  );
  await tx.wait();
  console.log("Set bridge endpoint for Solana devnet");
  
  // Create deployment artifacts directory if it doesn't exist
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
      SoulboundNFT: {
        address: soulboundNFT.address
      },
      CrossChainBridge: {
        address: crossChainBridge.address
      }
    },
    timestamp: new Date().toISOString()
  };

  // Save deployment to file
  const deploymentPath = path.join(artifactsDir, "amoy.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`Deployment data saved to ${deploymentPath}`);
  
  console.log("Polygon Amoy deployment completed successfully!");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });