const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Starting test on Polygon Amoy network...");

  // Initialize provider and signer
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const deployer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log("Testing with account:", deployer.address);

  // Load deployed contract addresses from amoy.json
  const deploymentData = require("../deployments/amoy.json");
  const soulboundNFTAddress = deploymentData.contracts.SoulboundNFT.address;
  const crossChainBridgeAddress = deploymentData.contracts.CrossChainBridge.address;
  const goldTokenAddress = deploymentData.contracts.CommodityToken_Gold.address;

  // Attach to deployed contracts
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT", deployer);
  const soulboundNFT = SoulboundNFT.attach(soulboundNFTAddress);

  const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge", deployer);
  const crossChainBridge = CrossChainBridge.attach(crossChainBridgeAddress);

  const CommodityToken = await ethers.getContractFactory("CommodityToken", deployer);
  const goldToken = CommodityToken.attach(goldTokenAddress);

  // Gas options for Amoy
  const gasOptions = {
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
    maxFeePerGas: ethers.parseUnits("50", "gwei"),
  };

  // Test 1: Mint and verify Soulbound NFT
  console.log("Verifying and minting Soulbound NFT...");
  const did = "did:example:123";
  const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("sample-credential-data"));
  const credentialCID = "QmTestCID123";
  const mintTx = await soulboundNFT.verifyIdentity(deployer.address, did, credentialHash, credentialCID, gasOptions);
  await mintTx.wait();
  console.log("Soulbound NFT minted. Owner of token 0:", await soulboundNFT.ownerOf(0));
  console.log("DID for token 0:", await soulboundNFT.getDID(0));

  // Test 2: Mint GOLD tokens
  console.log("Minting 100 GOLD tokens...");
  const amountToMint = ethers.parseUnits("100", 18);
  const mintGoldTx = await goldToken.mint(deployer.address, amountToMint, gasOptions);
  await mintGoldTx.wait();
  console.log("Deployer GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));

  // Test 3: Approve and bridge GOLD tokens
  console.log("Approving 50 GOLD tokens for bridging...");
  const amountToBridge = ethers.parseUnits("50", 18);
  const approveTx = await goldToken.approve(crossChainBridgeAddress, amountToBridge, gasOptions);
  await approveTx.wait();
  console.log("Allowance for bridge:", ethers.formatUnits(await goldToken.allowance(deployer.address, crossChainBridgeAddress), 18));

  console.log("Bridging 50 GOLD tokens...");
  const targetChain = "solana_devnet"; // Placeholder for Solana integration
  const bridgeTx = await crossChainBridge.bridgeTokens(goldTokenAddress, amountToBridge, targetChain, gasOptions);
  const receipt = await bridgeTx.wait();
  console.log("Bridge Tx Hash:", bridgeTx.hash);
  console.log("Deployer GOLD balance after bridge:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));
  console.log("Bridge GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(crossChainBridgeAddress), 18));

  // Parse the transferId from logs
  let transferId = 0;
  if (receipt.logs && receipt.logs.length > 0) {
    const eventAbi = ["event TokenTransferInitiated(uint256 indexed transferId, address token, uint256 amount, string targetChain)"];
    const iface = new ethers.Interface(eventAbi);
    const transferEvent = receipt.logs.map(log => {
      try {
        return iface.parseLog(log);
      } catch (e) {
        return null;
      }
    }).find(event => event && event.name === "TokenTransferInitiated");
    if (transferEvent) {
      transferId = Number(transferEvent.args.transferId);
      console.log("Parsed Transfer ID from logs:", transferId);
    } else {
      console.log("No TokenTransferInitiated event found in logs");
    }
  } else {
    console.log("Receipt.logs is empty or undefined");
  }
  console.log("Using Transfer ID:", transferId);

  // Test 4: Simulate completion
  console.log("Completing token transfer...");
  try {
    // Adjusted to match a likely 4-argument signature
    const completeTx = await crossChainBridge.completeTokenTransfer(transferId, goldTokenAddress, amountToBridge, deployer.address, gasOptions);
    await completeTx.wait();
    console.log("Bridge completed. New Deployer GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));
    console.log("Bridge GOLD balance after burn:", ethers.formatUnits(await goldToken.balanceOf(crossChainBridgeAddress), 18));
  } catch (error) {
    console.error("Error in completeTokenTransfer:", error.message);
    // If 4 args fail, try VAA-based version (commented out until we confirm)
    // const vaa = "0x<vaa_bytes_from_wormhole>"; // Placeholder VAA
    // const completeTxVaa = await crossChainBridge.completeTokenTransfer(vaa, gasOptions);
    // await completeTxVaa.wait();
    // console.log("Bridge completed with VAA. New Deployer GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Main script error:", error);
    process.exit(1);
  });