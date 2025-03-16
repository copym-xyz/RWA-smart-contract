const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  // Initialize provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/");
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Checking balance for account:", deployer.address);

  // Get balance
  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");
  const WORMHOLE_ADDRESS = ethers.getAddress("0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78");
//   const TOKEN_BRIDGE_ADDRESS = ethers.getAddress("0x377D55a7928c046E18eEbb61977e760d2af53966");
  console.log(`Wormhole Address: ${WORMHOLE_ADDRESS}`);
//   console.log(`Token Bridge Address: ${TOKEN_BRIDGE_ADDRESS}`);

const address = "0x377D55a7928c046E18eEbb61977e760d2af53966";
try {
  const checksummedAddress = (address);
  console.log("Checksummed Address:", checksummedAddress);
} catch (error) {
  console.error("Error:", error);
}

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });