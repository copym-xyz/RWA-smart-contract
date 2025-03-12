require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Import additional Hardhat plugins
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-gas-reporter");
require("solidity-coverage");

// Load environment variables
const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || ETHEREUM_PRIVATE_KEY;
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// Default configuration
const config = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Hardhat local network
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.MAINNET_RPC_URL || `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
        enabled: false,
      },
    },
    // Local development network
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545/",
    },
    amoy: {
      chainId: 80002, // Polygon Amoy chain ID
      url: `https://rpc-amoy.polygon.technology/`,
      accounts: [POLYGON_PRIVATE_KEY],
      saveDeployments: true,
      gasPrice: 35000000000, // Default gas price for Amoy in wei
    },
    goerli: {
      chainId: 5,
      url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [ETHEREUM_PRIVATE_KEY],
      saveDeployments: true,
    },
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [ETHEREUM_PRIVATE_KEY],
      saveDeployments: true,
    },
    // Polygon testnets
    mumbai: {
      chainId: 80001,
      url: `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [POLYGON_PRIVATE_KEY],
      saveDeployments: true,
    },
  },
  // Etherscan verification config
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
    },
  },
  // Gas reporter config
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "ETH",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  // Namedaccounts for deployments
  namedAccounts: {
    deployer: {
      default: 0,
    },
    verifier: {
      default: 1,
    },
  },
  // Custom mocha settings
  mocha: {
    timeout: 200000, // 200 seconds
  },
};

// Add Solana configuration if needed (requires additional setup)
// This would typically be handled separately with @solana/web3.js and related tools

module.exports = config;