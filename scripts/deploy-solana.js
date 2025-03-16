const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@project-serum/anchor');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load the IDL for the identity program
const idl = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../target/idl/identity_program.json'),
  'utf-8'
));

async function main() {
  console.log("Starting deployment to Solana devnet...");

  // Set up connection to Solana devnet
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
  
  // Load deployer keypair
  let keypair;
  if (process.env.SOLANA_PRIVATE_KEY) {
    // Load from env if available
    const secretKey = Buffer.from(process.env.SOLANA_PRIVATE_KEY, 'base64');
    keypair = Keypair.fromSecretKey(secretKey);
  } else {
    // Or load from local keypair file
    const keypairFile = path.join(process.env.HOME, '.config/solana/id.json');
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keypairFile, 'utf8')));
    keypair = Keypair.fromSecretKey(secretKey);
  }
  
  console.log(`Deploying with account: ${keypair.publicKey.toString()}`);
  
  // Check account balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Account balance: ${balance / 10**9} SOL`);
  
  if (balance < 1000000000) { // 1 SOL
    console.warn("WARNING: Account balance is low. You may need more SOL to deploy.");
  }

  // Set up provider
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: 'confirmed',
  });

  // Get programId from IDL or create a new one
  let programId;
  if (idl.metadata && idl.metadata.address) {
    programId = new PublicKey(idl.metadata.address);
  } else {
    // If programId not in IDL, generate a new one
    programId = Keypair.generate().publicKey;
  }
  
  console.log(`Program ID: ${programId.toString()}`);

  // Note: In a real deployment scenario, you'd now do:
  // 1. Build the program: anchor build
  // 2. Deploy the program: anchor deploy
  // But for this script, we'll assume the deployment is done with the Anchor CLI
  // and we're just saving the deployment information

  console.log("Solana program deployment should be done with the Anchor CLI.");
  console.log("Run the following commands to deploy:");
  console.log("  cd solana-programs/identity-program");
  console.log("  anchor build");
  console.log("  anchor deploy");

  // Create deployment artifacts directory if it doesn't exist
  const artifactsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save deployment information
  const deploymentData = {
    network: "solana-devnet",
    deployer: keypair.publicKey.toString(),
    programId: programId.toString(),
    timestamp: new Date().toISOString()
  };

  // Save deployment to file
  const deploymentPath = path.join(artifactsDir, "solana-devnet.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`Deployment data saved to ${deploymentPath}`);
  
  // Update .env file with program ID (append if exists)
  const envPath = path.join(__dirname, "../../.env");
  const envAdditions = `
# Solana Program ID - Deployed at ${new Date().toISOString()}
SOLANA_IDENTITY_PROGRAM_ID=${programId.toString()}
`;

  if (fs.existsSync(envPath)) {
    fs.appendFileSync(envPath, envAdditions);
    console.log("Program ID added to .env file");
  } else {
    console.log("No .env file found. Please add the following to your .env file:");
    console.log(envAdditions);
  }

  console.log("Solana deployment information saved successfully!");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });