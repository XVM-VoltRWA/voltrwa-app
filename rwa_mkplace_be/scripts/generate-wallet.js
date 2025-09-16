/**
 * Generate XRPL Wallet for Backend Operations
 * 
 * Run this script to generate a new XRPL wallet with seed
 * that can be used for automated backend operations.
 * 
 * Usage: node generate-wallet.js
 */

const xrpl = require('xrpl');

async function generateWallet() {
  const network = process.env.NETWORK || 'mainnet';
  const isTestnet = network === 'testnet';
  
  console.log(`🔐 Generating new XRPL wallet for backend operations (${network.toUpperCase()})...\n`);
  
  // Generate a new random wallet
  const wallet = xrpl.Wallet.generate();
  
  console.log('✅ New wallet generated!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('WALLET DETAILS (SAVE THESE SECURELY!)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Address:     ${wallet.address}`);
  console.log(`Public Key:  ${wallet.publicKey}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Seed:        ${wallet.seed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📝 Add to your .env file:');
  console.log(`BACKEND_WALLET_SEED=${wallet.seed}`);
  console.log(`BACKEND_WALLET_ADDRESS=${wallet.address}`);
  console.log(`NETWORK=${network}`);
  
  console.log('\n⚠️  IMPORTANT:');
  console.log(`1. This wallet needs at least 10 ${isTestnet ? 'Test ' : ''}XRP to be activated on ${network.toUpperCase()}`);
  console.log('2. Send 10-20 XRP to the address above to activate it');
  console.log('3. Keep the seed SECRET - never commit it to git');
  console.log('4. This wallet will be used only for automated minting operations');
  console.log('\n💡 You can activate the wallet by sending XRP from:');
  console.log('   - Your XUMM wallet');
  if (isTestnet) {
    console.log('   - XRPL Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html');
  } else {
    console.log('   - Any exchange (Binance, Coinbase, etc.)');
  }
  console.log('   - Another XRPL wallet\n');
}

generateWallet().catch(console.error);