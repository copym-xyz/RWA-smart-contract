const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainBridge with CommodityToken", function () {
  let soulboundNFT, crossChainBridge, commodityToken, owner, addr1;

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

    const CommodityToken = await ethers.getContractFactory("CommodityToken");
    commodityToken = await CommodityToken.deploy("Gold Token", "GOLD", "Gold");
    await commodityToken.deployed();

    await soulboundNFT.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE")), owner.address);
    await crossChainBridge.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ADMIN_ROLE")), owner.address);
    await crossChainBridge.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE")), owner.address);
    await commodityToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address);
    await commodityToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ROLE")), crossChainBridge.address);
  });

  it("should mint and bridge tokens", async () => {
    await crossChainBridge.setBridgeEndpoint("solana_devnet", "test-endpoint");

    // Mint tokens
    await commodityToken.mint(owner.address, ethers.utils.parseUnits("100", 18));
    expect(await commodityToken.balanceOf(owner.address)).to.equal(ethers.utils.parseUnits("100", 18));

    // Approve and bridge tokens
    await commodityToken.approve(crossChainBridge.address, ethers.utils.parseUnits("50", 18));
    const tx = await crossChainBridge.bridgeTokens(commodityToken.address, ethers.utils.parseUnits("50", 18), "solana_devnet");
    const receipt = await tx.wait();
    const transferId = receipt.events.find(e => e.event === "TokenTransferInitiated").args.transferId;

    // Complete transfer
    await expect(crossChainBridge.completeTokenTransfer(transferId, true))
      .to.emit(crossChainBridge, "TokenTransferCompleted")
      .withArgs(transferId, true);

    expect(await commodityToken.balanceOf(owner.address)).to.equal(ethers.utils.parseUnits("50", 18));
  });
});