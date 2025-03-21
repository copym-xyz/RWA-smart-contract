require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");

// Plugin imports
require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("solidity-coverage");

// Load environment variables
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-amoy.g.alchemy.com/v2/0ZMvaBwqV9-86WAO9YpqFyL42495Wbcc";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOLANA_IDENTITY_PROGRAM_ID = process.env.SOLANA_IDENTITY_PROGRAM_ID || "";

// Default configuration
const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: "0.8.0", 
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  coverage: {
    exclude: [
      "contracts/interfaces/*",
      "contracts/mocks/*",
    ],
  },
  networks: {
    // Local networks for testing
    hardhat: {
      chainId: 31337,
      forking: {
        url: POLYGON_RPC_URL,
        enabled: process.env.FORKING_ENABLED === "true",
      },
    },
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545/",
    },
    // Polygon Amoy network
    amoy: {
      chainId: parseInt(process.env.POLYGON_CHAIN_ID) || 80002,
      url: POLYGON_RPC_URL,
      accounts: POLYGON_PRIVATE_KEY ? [POLYGON_PRIVATE_KEY] : [],
      saveDeployments: true,
      gasPrice: "auto", // Let Hardhat estimate
      // Or use EIP-1559
      maxPriorityFeePerGas: "30",  // Fixed value in Gwei
      maxFeePerGas: "50",          // Fixed value in Gwei
    },
  },
  scripts: {
    "test": "hardhat test",
    "test-crosschain": "hardhat run scripts/test-crosschain.js",
    "deploy": "hardhat run scripts/deploy-polygon.js --network amoy",
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    token: "MATIC",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  namedAccounts: {
    deployer: {
      default: 0, // First account from accounts array
    },
    verifier: {
      default: 1, // Second account (if available)
    },
  },
  mocha: {
    timeout: 200000, // 200 seconds
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deployments: "./deployments",
  },
};

module.exports = config;
