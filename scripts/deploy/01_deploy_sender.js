const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const wormholeAddress = "0x0CBE91CF822c73C2315FB05100b6a28C03563d3e"; // Polygon Amoy Core Bridge
  await deploy("MessageSender", {
    from: deployer,
    args: [wormholeAddress],
    log: true,
  });
};
module.exports.tags = ["MessageSender"];