const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  // Load deployed contracts with new addresses
  const soulboundNFT = await ethers.getContractAt("SoulboundNFT", "0x4C2F7092C2aE51D986bEFEe378e50BD4dB99C901");
  const crossChainBridge = await ethers.getContractAt("CrossChainBridge", "0x7A9Ec1d04904907De0ED7b6839CcdD59c3716AC9");
  const goldToken = await ethers.getContractAt("CommodityToken", "0x49fd2BE640DB2910c2fAb69bB8531Ab6E76127ff");

  // Test SoulboundNFT - Minting with verifyIdentity
  console.log("Verifying and minting Soulbound NFT...");
  const did = "did:example:123";
  const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("sample-credential-data"));
  const credentialCID = "QmTestCID123";
  const mintTx = await soulboundNFT.verifyIdentity(deployer.address, did, credentialHash, credentialCID);
  await mintTx.wait();
  console.log("Soulbound NFT minted. Owner of token 0:", await soulboundNFT.ownerOf(0));
  console.log("DID for token 0:", await soulboundNFT.getDID(0));

  // Test CommodityToken - Minting
  console.log("Minting 100 GOLD tokens...");
  const mintGoldTx = await goldToken.mint(deployer.address, ethers.parseUnits("100", 18));
  await mintGoldTx.wait();
  console.log("Deployer GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));

  // Test CrossChainBridge - Bridging
  console.log("Approving 50 GOLD tokens for bridging...");
  const approveTx = await goldToken.approve(crossChainBridge.target, ethers.parseUnits("50", 18));
  await approveTx.wait();
  console.log("Allowance for bridge:", ethers.formatUnits(await goldToken.allowance(deployer.address, crossChainBridge.target), 18));

  console.log("Bridging 50 GOLD tokens...");
  const bridgeTx = await crossChainBridge.bridgeTokens(goldToken.target, ethers.parseUnits("50", 18), "solana_devnet");
  const receipt = await bridgeTx.wait();
  console.log("Bridge Tx Hash:", bridgeTx.hash);
  console.log("Deployer GOLD balance after bridge:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));
  console.log("Bridge GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(crossChainBridge.target), 18));

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

  // Simulate completion
  console.log("Completing token transfer...");
  try {
    const completeTx = await crossChainBridge.completeTokenTransfer(transferId, true);
    await completeTx.wait();
    console.log("Bridge completed. New Deployer GOLD balance:", ethers.formatUnits(await goldToken.balanceOf(deployer.address), 18));
    console.log("Bridge GOLD balance after burn:", ethers.formatUnits(await goldToken.balanceOf(crossChainBridge.target), 18));
  } catch (error) {
    console.error("Error in completeTokenTransfer:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Main script error:", error);
    process.exit(1);
  });