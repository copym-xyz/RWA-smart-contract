const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainBridge", function () {
  let soulboundNFT, crossChainBridge, owner, addr1;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();

    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();

    const CrossChainBridge = await ethers.getContractFactory("CrossChainBridge");
    crossChainBridge = await CrossChainBridge.deploy(
      "0x000000000000000000000000000000000000dead", // Mock Wormhole
      "0x000000000000000000000000000000000000beef"  // Mock TokenBridge
    );
    await crossChainBridge.deployed();

    await soulboundNFT.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE")), owner.address);
    await crossChainBridge.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ADMIN_ROLE")), owner.address);
    await crossChainBridge.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE")), owner.address);
  });

  it("should request and complete verification", async () => {
    await crossChainBridge.setBridgeEndpoint("solana_devnet", "test-endpoint");
    const tx = await crossChainBridge.requestVerification("did:example:123", "solana_devnet");
    const receipt = await tx.wait();
    const requestId = receipt.events.find(e => e.event === "VerificationRequested").args.requestId;

    await expect(crossChainBridge.completeVerification(requestId, true))
      .to.emit(crossChainBridge, "VerificationCompleted")
      .withArgs(requestId, true);
  });
});