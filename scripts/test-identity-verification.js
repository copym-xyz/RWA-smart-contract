// test-identity-verification.js
require('dotenv').config();
const { ethers } = require('hardhat');
const anchor = require('@project-serum/anchor');
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Testing cross-chain identity verification between Polygon and Solana...");
  
  // === POLYGON SETUP ===
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const wallet = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);
  console.log(`Connected to Polygon with address: ${wallet.address}`);
  
  // Load contracts with hardcoded addresses
  const soulboundNFTAddress = "0x26F28bAEF4813d6768Ce70B7f4b2f4827A5D738D";
  const bridgeAddress = "0xEDe05747FB7d095d3562e7169B5632A3fBe6e9Bd";
  
  console.log(`Using SoulboundNFT at: ${soulboundNFTAddress}`);
  console.log(`Using CrossChainBridge at: ${bridgeAddress}`);
  
  // Define minimal ABIs for the required functions
  const soulboundNFTAbi = [
    "function hasRole(bytes32 role, address account) external view returns (bool)",
    "function grantRole(bytes32 role, address account) external",
    "function verifyIdentity(address entity, string memory did, bytes32 credentialHash, string memory credentialCID) external",
    "function getTokenIdByDID(string memory did) external view returns (uint256)",
    "function getDID(uint256 tokenId) external view returns (string memory)"
  ];
  
  const bridgeAbi = [
    "function requestVerification(string memory did, string memory targetChain) external returns (uint256)",
    "function verificationRequests(uint256) external view returns (uint256 requestId, string sourceChain, string targetChain, string did, bool verified, uint256 timestamp)",
    "event VerificationRequested(uint256 indexed requestId, string did, string sourceChain, string targetChain)"
  ];
  
  // Create contract instances
  const soulboundNFT = new ethers.Contract(soulboundNFTAddress, soulboundNFTAbi, wallet);
  const bridge = new ethers.Contract(bridgeAddress, bridgeAbi, wallet);
  
  console.log("Contract instances created");
  
  // === SOLANA SETUP - OPTIONAL ===
  try {
    // Connect to Solana devnet
    const solConnection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", 'confirmed');
    console.log("Connected to Solana");
    
    // This part is just for logging - we won't actually use Solana in this test
    const programId = process.env.SOLANA_IDENTITY_PROGRAM_ID;
    if (programId) {
      console.log(`Solana program ID: ${programId}`);
    }
  } catch (error) {
    console.warn("Error setting up Solana:", error.message);
    console.log("Continuing with only Polygon testing...");
  }
  
  try {
    // 1. Create or retrieve a Soulbound token on Polygon
    console.log("Checking if test DID already exists...");
    const testDID = "did:example:test-verification";
    let tokenId;
    
    try {
      tokenId = await soulboundNFT.getTokenIdByDID(testDID);
      console.log(`DID already exists with token ID: ${tokenId.toString()}`);
    } catch (error) {
      // DID doesn't exist, create a new one
      console.log("DID not found, creating new Soulbound NFT for testing...");
      
      // Check if wallet has VERIFIER_ROLE
      const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
      let hasRole;
      
      try {
        hasRole = await soulboundNFT.hasRole(VERIFIER_ROLE, wallet.address);
        console.log(`Has VERIFIER_ROLE: ${hasRole}`);
      } catch (error) {
        console.warn("Error checking role:", error.message);
        hasRole = false;
      }
      
      if (!hasRole) {
        console.log("Attempting to grant VERIFIER_ROLE to wallet...");
        try {
          // This assumes the wallet is an admin
          const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
          const tx = await soulboundNFT.grantRole(VERIFIER_ROLE, wallet.address);
          await tx.wait();
          console.log("VERIFIER_ROLE granted successfully");
        } catch (error) {
          console.error("Error granting role:", error.message);
          console.log("Note: This may fail if your wallet is not an admin. Continuing anyway...");
        }
      }
      
      // Create credential data
      const credentialData = {
        name: "Test User",
        email: "test@example.com",
        isVerified: true,
        timestamp: Date.now()
      };
      
      // Hash the credential data
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credentialData)));
      const credentialCID = "ipfs://QmTestCredentialCID";
      
      // Mint the Soulbound token
      console.log("Minting new Soulbound token...");
      try {
        const mintTx = await soulboundNFT.verifyIdentity(
          wallet.address,
          testDID,
          credentialHash,
          credentialCID
        );
        
        console.log("Transaction sent, waiting for confirmation...");
        console.log("Transaction hash:", mintTx.hash);
        
        const mintReceipt = await mintTx.wait();
        console.log("NFT minted successfully in block:", mintReceipt.blockNumber);
        
        // Get the token ID
        tokenId = await soulboundNFT.getTokenIdByDID(testDID);
        console.log(`New Soulbound NFT created with token ID: ${tokenId.toString()}`);
      } catch (error) {
        console.error("Error minting NFT:", error.message);
        console.log("Using a test DID for verification anyway...");
        // Use a fallback for continuing the test
        tokenId = 0;
      }
    }
    
    // 2. Request cross-chain verification
    console.log("Requesting cross-chain verification...");
    try {
      const verifyTx = await bridge.requestVerification(testDID, "solana_devnet");
      
      console.log("Transaction sent, waiting for confirmation...");
      console.log("Transaction hash:", verifyTx.hash);
      
      const verifyReceipt = await verifyTx.wait();
      console.log("Verification request sent in block:", verifyReceipt.blockNumber);
      
      // Find the verification request event
      const events = verifyReceipt.events || [];
      const event = events.find(e => e.event === "VerificationRequested");
      
      if (event) {
        const requestId = event.args.requestId.toString();
        console.log(`Verification request sent with ID: ${requestId}`);
        console.log("Event data:", {
          requestId,
          did: event.args.did,
          sourceChain: event.args.sourceChain,
          targetChain: event.args.targetChain
        });
        
        // 3. Check verification status
        console.log("Checking verification request status...");
        try {
          const request = await bridge.verificationRequests(requestId);
          console.log("Verification request status:", {
            requestId: request.requestId.toString(),
            did: request.did,
            sourceChain: request.sourceChain,
            targetChain: request.targetChain,
            verified: request.verified,
            timestamp: new Date(request.timestamp.toNumber() * 1000).toISOString()
          });
          
          if (request.verified) {
            console.log("Identity verification completed successfully!");
          } else {
            console.log("Identity verification is still pending. This is expected in this test environment.");
            console.log("In a production setup, a relayer service would process the Wormhole VAA and complete the verification.");
          }
        } catch (error) {
          console.error("Error checking verification status:", error.message);
        }
      } else {
        console.log("No VerificationRequested event found. Looking at raw logs:");
        if (verifyReceipt.logs) {
          verifyReceipt.logs.forEach((log, i) => {
            console.log(`Log ${i}:`, log);
          });
        } else {
          console.log("No logs found in receipt");
        }
      }
    } catch (error) {
      console.error("Error requesting verification:", error.message);
    }
    
    console.log("Cross-chain identity verification test completed.");
  } catch (error) {
    console.error("Error in cross-chain identity verification test:", error);
    console.error(error.stack);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });