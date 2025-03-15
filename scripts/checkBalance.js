// Import ethers
const { ethers } = require("ethers");
require("dotenv").config();

async function checkBalance() {
  // Set up the provider
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

  // Specify the address you want to check (could be the deployer's address)
  const address = process.env.POLYGON_ADDRESS || "0x10442808250a00232C429fc7eCAcdc8ADB283E84"; // Replace with the address you want to check

  // Get the balance of the address
  const balance = await provider.getBalance(address);

  // Format the balance in MATIC
  console.log(`Account balance of ${address}: ${ethers.formatEther(balance)} MATIC`);
}

// Call the checkBalance function
checkBalance().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
