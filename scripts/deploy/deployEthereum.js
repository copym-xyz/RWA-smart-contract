const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to Ethereum network...");

  // Get deployment accounts
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  
  // Deploy SoulboundNFT contract
  console.log("Deploying SoulboundNFT contract...");
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const soulboundNFT = await SoulboundNFT.deploy();
  await soulboundNFT.deployed();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);
  
  // Deploy CrossChainBridge contract
  console.log("Deploying CrossChainBridge contract...");
  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
  const crossChainBridge = await CrossChainBridge.deploy();
  await crossChainBridge.deployed();
  console.log(`CrossChainBridge deployed to: ${crossChainBridge.address}`);
  
  // Set up roles
  console.log("Setting up roles...");
  
  // Define roles
  const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
  
  // Grant verifier role to deployer in SoulboundNFT
  const verifierRoleTx = await soulboundNFT.grantRole(VERIFIER_ROLE, deployer.address);
  await verifierRoleTx.wait();
  console.log(`Granted VERIFIER_ROLE to ${deployer.address} in SoulboundNFT`);
  
  // Grant oracle role to deployer in CrossChainBridge
  const oracleRoleTx = await crossChainBridge.grantRole(ORACLE_ROLE, deployer.address);
  await oracleRoleTx.wait();
  console.log(`Granted ORACLE_ROLE to ${deployer.address} in CrossChainBridge`);
  
  // Set up bridge endpoints
  console.log("Setting up bridge endpoints...");
  
  // Set up Ethereum endpoint - in reality this would point to an external service
  const ethereumEndpointTx = await crossChainBridge.setBridgeEndpoint(
    "1", // Ethereum mainnet chain ID
    "ethereum_bridge_endpoint" // This would be a real endpoint URL in production
  );
  await ethereumEndpointTx.wait();
  console.log("Ethereum bridge endpoint set");
  
  // Set up Polygon endpoint
  const polygonEndpointTx = await crossChainBridge.setBridgeEndpoint(
    "137", // Polygon mainnet chain ID
    "polygon_bridge_endpoint" // This would be a real endpoint URL in production
  );
  await polygonEndpointTx.wait();
  console.log("Polygon bridge endpoint set");
  
  // Write deployment information to a file
  const fs = require("fs");
  const deploymentInfo = {
    network: network.name,
    soulboundNFT: soulboundNFT.address,
    crossChainBridge: crossChainBridge.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `deployment-${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info written to deployment-${network.name}.json`);
  
  console.log("Deployment completed successfully!");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });