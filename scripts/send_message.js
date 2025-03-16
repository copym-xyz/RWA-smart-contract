const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const senderAddress = "YOUR_DEPLOYED_SENDER_ADDRESS"; // From deployment output
  const MessageSender = await ethers.getContractAt("MessageSender", senderAddress, owner);

  const message = "Hello from Polygon Amoy!";
  const tx = await MessageSender.sendMessage(message);
  const receipt = await tx.wait();
  console.log("Message sent, tx hash:", receipt.transactionHash);

  // Extract sequence from logs (Wormhole emits a LogMessagePublished event)
  const wormholeInterface = new ethers.utils.Interface([
    "event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)",
  ]);
  const log = receipt.logs.find((log) => log.address === "0x0CBE91CF822c73C2315FB05100b6a28C03563d3e");
  const parsed = wormholeInterface.parseLog(log);
  console.log("Sequence:", parsed.args.sequence.toString());
}

main().catch((error) => console.error(error));