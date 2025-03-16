const { ethers } = require("ethers");
const { Connection, PublicKey } = require("@solana/web3.js");
require("dotenv").config();

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY;
const SOLANA_RPC_URL = "https://api.devnet.solana.com";
const BRIDGE_ADDRESS = "0xc6C6aE41F4f2fBf510ecC52f1B55a4E601ecdC59";
const PROGRAM_ID = "YOUR_SOLANA_PROGRAM_ID_HERE"; // Replace with deployed ID

const bridgeAbi = [
  "event VerificationRequested(uint256 indexed requestId, string did, string sourceChain, string targetChain)",
  "function completeVerification(uint256 requestId, bool verified) external",
];

async function main() {
  // Polygon setup
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
  const wallet = new ethers.Wallet(POLYGON_PRIVATE_KEY, provider);
  const bridge = new ethers.Contract(BRIDGE_ADDRESS, bridgeAbi, wallet);

  // Solana setup
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);

  console.log("Oracle running...");

  bridge.on("VerificationRequested", async (requestId, did, sourceChain, targetChain) => {
    console.log(`Verification requested: ${requestId}, DID: ${did}, Target: ${targetChain}`);

    if (targetChain === "solana_devnet") {
      // Simulate Solana verification (replace with real logic)
      const verified = true; // Query Solana program state or external source

      // Complete verification on Polygon
      const tx = await bridge.completeVerification(requestId, verified);
      await tx.wait();
      console.log(`Verification ${requestId} completed: ${verified}`);
    }
  });
}

main().catch(console.error);