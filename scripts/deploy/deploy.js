const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(`Deploying contracts to ${network.name}...`);

  // Get deployment accounts
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())}`);

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

  // Set up bridge endpoints based on network
  console.log("Setting up bridge endpoints...");
  
  // Define chain IDs for supported networks
  const chainIds = {
    mainnet: "1",
    goerli: "5",
    sepolia: "11155111",
    polygon: "137",
    mumbai: "80001"
  };
  
  // Set endpoints for all supported networks
  for (const [netName, chainId] of Object.entries(chainIds)) {
    // Skip current network
    if (netName === network.name) continue;
    
    // Create a placeholder endpoint URL (would be a real endpoint in production)
    const endpoint = `https://bridge-${netName}.example.com`;
    
    tx = await crossChainBridge.setBridgeEndpoint(chainId, endpoint);
    await tx.wait();
    console.log(`Set bridge endpoint for ${netName} (Chain ID: ${chainId})`);
  }

  // Create deployment artifacts directory if it doesn't exist
  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save deployment information
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    contracts: {
      SoulboundNFT: {
        address: soulboundNFT.address,
        abi: JSON.parse(SoulboundNFT.interface.format("json"))
      },
      CrossChainBridge: {
        address: crossChainBridge.address,
        abi: JSON.parse(CrossChainBridge.interface.format("json"))
      }
    },
    timestamp: new Date().toISOString()
  };

  // Save deployment to network-specific file
  const deploymentPath = path.join(artifactsDir, `${network.name}.json`);
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`Deployment data saved to ${deploymentPath}`);
  
  // Generate frontend contract configuration
  // This will be used by the frontend to connect to the deployed contracts
  const frontendDir = path.join(__dirname, "../../frontend/src/contracts");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }
  
  // Save ABIs
  fs.writeFileSync(
    path.join(frontendDir, "SoulboundNFT.json"),
    JSON.stringify(SoulboundNFT.interface.format("json"), null, 2)
  );
  
  fs.writeFileSync(
    path.join(frontendDir, "CrossChainBridge.json"),
    JSON.stringify(CrossChainBridge.interface.format("json"), null, 2)
  );
  
  // Save contract addresses
  const contractAddresses = {
    [network.config.chainId]: {
      SoulboundNFT: soulboundNFT.address,
      CrossChainBridge: crossChainBridge.address
    }
  };
  
  fs.writeFileSync(
    path.join(frontendDir, "contractAddresses.json"),
    JSON.stringify(contractAddresses, null, 2)
  );
  
  console.log("Contract ABIs and addresses exported for frontend");

  // Verify contracts on Etherscan if on a public network and API key is available
  if (network.name !== "hardhat" && network.name !== "localhost") {
    if (process.env.ETHERSCAN_API_KEY) {
      console.log("Waiting for block confirmations...");
      // Wait for 6 blocks for better Etherscan verification reliability
      await soulboundNFT.deployTransaction.wait(6);
      await crossChainBridge.deployTransaction.wait(6);
      
      console.log("Verifying contracts on Etherscan...");
      
      try {
        await run("verify:verify", {
          address: soulboundNFT.address,
          constructorArguments: []
        });
        console.log("SoulboundNFT verified on Etherscan");
      } catch (error) {
        console.error("Error verifying SoulboundNFT:", error);
      }
      
      try {
        await run("verify:verify", {
          address: crossChainBridge.address,
          constructorArguments: []
        });
        console.log("CrossChainBridge verified on Etherscan");
      } catch (error) {
        console.error("Error verifying CrossChainBridge:", error);
      }
    } else {
      console.log("Skipping Etherscan verification (ETHERSCAN_API_KEY not set)");
    }
  }

  console.log("Deployment completed successfully!");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });