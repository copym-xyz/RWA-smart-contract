// test-token-transfer.js
require('dotenv').config();
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Testing cross-chain token transfer between Polygon and Solana...");
  
  // === POLYGON SETUP ===
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const wallet = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log(`Connected to Polygon with address: ${wallet.address}`);
  
  // Load contracts with hardcoded addresses
  const bridgeAddress = "0xEDe05747FB7d095d3562e7169B5632A3fBe6e9Bd";
  const goldTokenAddress = "0x8415b5f0ae583E8581673427C007c720Aa610706";
  
  console.log(`Using CrossChainBridge at: ${bridgeAddress}`);
  console.log(`Using Gold CommodityToken at: ${goldTokenAddress}`);
  
  // Define minimal ABIs for the required functions
  const commodityTokenAbi = [
    "function name() external view returns (string memory)",
    "function symbol() external view returns (string memory)",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function hasRole(bytes32 role, address account) external view returns (bool)",
    "function grantRole(bytes32 role, address account) external",
    "function mint(address to, uint256 amount) external",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  const bridgeAbi = [
    "function hasRole(bytes32 role, address account) external view returns (bool)",
    "function commodityTokens(string memory) external view returns (address)",
    "function registerCommodityToken(string memory commodityType, address tokenAddress) external",
    "function bridgeTokens(address tokenAddress, uint256 amount, string memory targetChain) external",
    "function tokenTransferRequests(uint256) external view returns (uint256 transferId, address tokenAddress, uint256 amount, string sourceChain, string targetChain, address sender, bool completed)",
    "event TokenTransferInitiated(uint256 indexed transferId, address token, uint256 amount, string targetChain)"
  ];
  
  // Create contract instances
  const goldToken = new ethers.Contract(goldTokenAddress, commodityTokenAbi, wallet);
  const bridge = new ethers.Contract(bridgeAddress, bridgeAbi, wallet);
  
  console.log("Contract instances created");
  
  // === SKIP SOLANA SETUP - We'll only test the Polygon side ===
  console.log("Skipping Solana connection, running Polygon-only test");
  console.log(`Target Solana program ID: ${process.env.SOLANA_IDENTITY_PROGRAM_ID || "Not configured"}`);
  
  try {
    // 1. First, check token balances
    console.log("Checking initial token balances...");
    
    const tokenName = await goldToken.name();
    const tokenSymbol = await goldToken.symbol();
    const decimals = await goldToken.decimals();
    console.log(`Token details: ${tokenName} (${tokenSymbol}), Decimals: ${decimals}`);
    
    const balance = await goldToken.balanceOf(wallet.address);
    
    // Convert to string first to be safe
    const balanceStr = balance.toString();
    console.log(`Initial balance on Polygon: ${balanceStr} wei (${ethers.formatUnits(balanceStr, decimals)} ${tokenSymbol})`);
    
    // 2. If balance is zero, mint some tokens for testing
    const oneToken = ethers.parseUnits("1.0", decimals).toString();
    
    if (balanceStr === "0" || parseInt(balanceStr) < parseInt(oneToken)) {
      console.log("Balance too low, attempting to mint tokens for testing...");
      
      // Check if wallet has MINTER_ROLE
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      let hasRole;
      
      try {
        hasRole = await goldToken.hasRole(MINTER_ROLE, wallet.address);
        console.log(`Has MINTER_ROLE: ${hasRole}`);
      } catch (error) {
        console.warn("Error checking role:", error.message);
        hasRole = false;
      }
      
      if (!hasRole) {
        console.log("Attempting to grant MINTER_ROLE to wallet...");
        try {
          // This assumes the wallet is an admin
          const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
          const tx = await goldToken.grantRole(MINTER_ROLE, wallet.address);
          await tx.wait();
          console.log("MINTER_ROLE granted successfully");
        } catch (error) {
          console.error("Error granting role:", error.message);
          console.log("Note: This may fail if your wallet is not an admin.");
          console.log("If this test fails due to insufficient balance, you may need to get tokens from another source.");
        }
      }
      
      // Mint 100 tokens
      try {
        console.log("Minting tokens...");
        const amountToMint = ethers.parseUnits("100", decimals);
        const mintTx = await goldToken.mint(wallet.address, amountToMint);
        
        console.log("Transaction sent, waiting for confirmation...");
        console.log("Transaction hash:", mintTx.hash);
        
        const mintReceipt = await mintTx.wait();
        console.log("Tokens minted successfully in block:", mintReceipt.blockNumber);
        
        const newBalance = await goldToken.balanceOf(wallet.address);
        const newBalanceStr = newBalance.toString();
        console.log(`New balance after minting: ${newBalanceStr} wei (${ethers.formatUnits(newBalanceStr, decimals)} ${tokenSymbol})`);
      } catch (error) {
        console.error("Error minting tokens:", error.message);
        console.log("Continuing with current balance...");
      }
    }
    
    // 3. Make sure the token is registered in the bridge
    console.log("Checking if token is registered in the bridge...");
    let registeredAddress;
    
    try {
      registeredAddress = await bridge.commodityTokens("Gold");
      console.log(`Registered address for Gold: ${registeredAddress}`);
    } catch (error) {
      console.warn("Error checking token registration:", error.message);
      registeredAddress = ethers.AddressZero;
    }
    
    if (registeredAddress === ethers.AddressZero || 
        registeredAddress.toLowerCase() !== goldTokenAddress.toLowerCase()) {
      console.log("Token not registered or address mismatch. Attempting to register...");
      
      // Check if wallet has BRIDGE_ADMIN_ROLE
      const BRIDGE_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ADMIN_ROLE"));
      let hasRole;
      
      try {
        hasRole = await bridge.hasRole(BRIDGE_ADMIN_ROLE, wallet.address);
        console.log(`Has BRIDGE_ADMIN_ROLE: ${hasRole}`);
      } catch (error) {
        console.warn("Error checking role:", error.message);
        hasRole = false;
      }
      
      if (!hasRole) {
        console.error("Wallet does not have BRIDGE_ADMIN_ROLE to register tokens");
        console.log("Continuing anyway, but token transfer may fail...");
      }
      
      try {
        const registerTx = await bridge.registerCommodityToken("Gold", goldTokenAddress);
        
        console.log("Transaction sent, waiting for confirmation...");
        console.log("Transaction hash:", registerTx.hash);
        
        const registerReceipt = await registerTx.wait();
        console.log("Token registered successfully in block:", registerReceipt.blockNumber);
      } catch (error) {
        console.error("Error registering token:", error.message);
        console.log("Continuing anyway, but token transfer may fail...");
      }
    }
    
    // 4. Approve tokens for bridge contract
    console.log("Approving tokens to be spent by the bridge...");
    const balance2 = await goldToken.balanceOf(wallet.address);
    const balance2Str = balance2.toString();
    const amountToTransfer = ethers.parseUnits("1.0", decimals);
    const amountToTransferStr = amountToTransfer.toString();
    
    // Check if we have enough tokens
    if (parseInt(balance2Str) < parseInt(amountToTransferStr)) {
      console.error(`Insufficient balance: ${ethers.formatUnits(balance2Str, decimals)} ${tokenSymbol}`);
      console.error(`Required: ${ethers.formatUnits(amountToTransferStr, decimals)} ${tokenSymbol}`);
      console.log("Test cannot proceed. Please ensure you have enough tokens.");
      return;
    }
    
    try {
      const approveTx = await goldToken.approve(bridgeAddress, amountToTransfer);
      
      console.log("Transaction sent, waiting for confirmation...");
      console.log("Transaction hash:", approveTx.hash);
      
      const approveReceipt = await approveTx.wait();
      console.log("Tokens approved successfully in block:", approveReceipt.blockNumber);
      console.log(`Approved ${ethers.formatUnits(amountToTransferStr, decimals)} ${tokenSymbol} to be spent by the bridge`);
    } catch (error) {
      console.error("Error approving tokens:", error.message);
      console.log("Test cannot proceed. Token approval failed.");
      return;
    }
    
    // 5. Initiate token transfer
    console.log("Initiating token transfer to Solana...");
    try {
      const transferTx = await bridge.bridgeTokens(goldTokenAddress, amountToTransfer, "solana_devnet");
      
      console.log("Transaction sent, waiting for confirmation...");
      console.log("Transaction hash:", transferTx.hash);
      
      const transferReceipt = await transferTx.wait();
      console.log("Token transfer initiated in block:", transferReceipt.blockNumber);
      
      // Find the token transfer initiated event
      const events = transferReceipt.events || [];
      const event = events.find(e => e.event === "TokenTransferInitiated");
      
      if (event) {
        const transferId = event.args.transferId.toString();
        console.log(`Token transfer initiated with ID: ${transferId}`);
        console.log("Event data:", {
          transferId,
          token: event.args.token,
          amount: ethers.formatUnits(event.args.amount.toString(), decimals),
          targetChain: event.args.targetChain
        });
        
        // 6. Check for transfer status
        console.log("Checking transfer request status...");
        try {
          const transferRequest = await bridge.tokenTransferRequests(transferId);
          console.log("Token transfer request status:", {
            transferId: transferRequest.transferId.toString(),
            tokenAddress: transferRequest.tokenAddress,
            amount: ethers.formatUnits(transferRequest.amount.toString(), decimals),
            sourceChain: transferRequest.sourceChain,
            targetChain: transferRequest.targetChain,
            sender: transferRequest.sender,
            completed: transferRequest.completed
          });
          
          if (transferRequest.completed) {
            console.log("Token transfer completed successfully!");
          } else {
            console.log("Token transfer is still pending. This is expected in this test environment.");
            console.log("In a production setup, a relayer service would process the Wormhole VAA and complete the transfer.");
          }
        } catch (error) {
          console.error("Error checking transfer status:", error.message);
        }
        
        // 7. Check final balances
        const finalBalance = await goldToken.balanceOf(wallet.address);
        const finalBalanceStr = finalBalance.toString();
        console.log(`Final balance on Polygon: ${ethers.formatUnits(finalBalanceStr, decimals)} ${tokenSymbol}`);
        
        if (parseInt(finalBalanceStr) < parseInt(balance2Str)) {
          console.log("Balance decreased, indicating tokens were successfully transferred from your wallet to the bridge.");
        } else {
          console.log("Warning: Balance didn't change. The transfer may have failed.");
        }
      } else {
        console.log("No TokenTransferInitiated event found. Looking at raw logs:");
        if (transferReceipt.logs) {
          transferReceipt.logs.forEach((log, i) => {
            console.log(`Log ${i}:`, log);
          });
        } else {
          console.log("No logs found in receipt");
        }
      }
    } catch (error) {
      console.error("Error transferring tokens:", error.message);
    }
    
    console.log("Cross-chain token transfer test completed.");
  } catch (error) {
    console.error("Error in cross-chain token transfer test:", error);
    console.error(error.stack);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });