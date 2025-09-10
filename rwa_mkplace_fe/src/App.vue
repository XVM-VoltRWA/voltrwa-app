<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:54321/functions/v1'

interface WalletConnection {
  connected: boolean
  address: string
  payloadId?: string
}

interface Asset {
  id: string
  name: string
  description: string
  price_xrp: number
  status: string
  seller_address: string
  token_currency: string
  token_issuer: string  // Backend wallet address (not user's)
  owner_address: string
  image_url?: string
  created_at?: string
  updated_at?: string
  token_amount?: string
  issuance_payload_id?: string
  issuance_status?: string
  issuance_tx_hash?: string
  listed_at?: string
  escrow_status?: string
}

const wallet = reactive<WalletConnection>({
  connected: false,
  address: ''
})

const connectionStatus = ref('')
const qrCode = ref('')
const deepLink = ref('')
const assets = ref<Asset[]>([])
const assetsTotal = ref(0)
const logs = ref<string[]>([])

const assetFilters = reactive({
  status: 'active',
  limit: 20,
  offset: 0
})

const purchaseForm = reactive({
  assetId: '',
  status: '',
  payloadId: '',
  qrCode: '',
  deepLink: ''
})

const createAssetForm = reactive({
  name: '',
  description: '',
  price_xrp: '',
  token_currency: '',
  image_url: ''
})

const tokenIssuanceForm = reactive({
  assetId: '',
  status: '',
  payloadId: '',
  qrCode: '',
  deepLink: ''
})

const mintTokenForm = reactive({
  assetId: '',
  holderAddress: '',
  status: '',
  payloadId: '',
  qrCode: '',
  deepLink: ''
})

const trustLineForm = reactive({
  assetId: '',
  status: '',
  payloadId: '',
  qrCode: '',
  deepLink: ''
})

const sellOfferForm = reactive({
  token_currency: '',
  token_amount: '',
  xrp_price: '',
  selectedAssetId: '',
  status: '',
  payloadId: '',
  qrCode: '',
  deepLink: ''
})

const escrowForm = reactive({
  assetId: '',
  status: '',
  payloadId: '',
  qrCode: '',
  deepLink: ''
})

const userProfile = ref<any>(null)
const userAssets = ref<Asset[]>([])
const marketplaceAssets = ref<Asset[]>([])
const walletBalance = ref<string>('')

// Wallet persistence functions
const saveWalletToStorage = () => {
  if (wallet.connected && wallet.address) {
    localStorage.setItem('rwa-wallet', JSON.stringify({
      connected: wallet.connected,
      address: wallet.address,
      connectedAt: Date.now()
    }))
  }
}

const loadWalletFromStorage = () => {
  try {
    const stored = localStorage.getItem('rwa-wallet')
    if (stored) {
      const walletData = JSON.parse(stored)
      // Check if connection is not older than 7 days
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - walletData.connectedAt < sevenDaysInMs) {
        wallet.connected = walletData.connected
        wallet.address = walletData.address
        connectionStatus.value = `Connected: ${walletData.address} (restored)`
        addLog('Wallet connection restored from storage')
        loadUserAssets()
        loadWalletBalance()
        return true
      } else {
        localStorage.removeItem('rwa-wallet')
        addLog('Stored wallet connection expired')
      }
    }
  } catch (error) {
    console.error('Failed to load wallet from storage:', error)
    localStorage.removeItem('rwa-wallet')
  }
  return false
}

const disconnectWallet = () => {
  wallet.connected = false
  wallet.address = ''
  wallet.payloadId = undefined
  connectionStatus.value = ''
  userAssets.value = []
  userProfile.value = null
  walletBalance.value = ''
  localStorage.removeItem('rwa-wallet')
  addLog('Wallet disconnected')
}

const loadWalletBalance = async () => {
  if (!wallet.connected || !wallet.address) {
    return
  }
  
  try {
    // Use XRPL public API to get account info
    const response = await fetch('https://s1.ripple.com:51234/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'account_info',
        params: [{
          account: wallet.address,
          strict: true,
          ledger_index: 'validated'
        }]
      })
    })
    
    const data = await response.json()
    
    if (data.result && data.result.account_data) {
      const balance = (parseInt(data.result.account_data.Balance) / 1000000).toFixed(6)
      walletBalance.value = balance
      addLog(`Wallet balance: ${balance} XRP`)
    }
  } catch (error) {
    console.error('Failed to load wallet balance:', error)
    addLog('Failed to load wallet balance')
  }
}

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  logs.value.unshift(`[${timestamp}] ${message}`)
}

const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
  const url = `${BASE_URL}${endpoint}`
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }
    
    addLog(`${method} ${endpoint} ${body ? JSON.stringify(body) : ''}`)
    
    const response = await fetch(url, options)
    const data = await response.json()
    
    addLog(`Response: ${JSON.stringify(data)}`)
    
    return { ok: response.ok, data }
  } catch (error) {
    addLog(`Error: ${error}`)
    return { ok: false, data: null }
  }
}

const connectWallet = async () => {
  connectionStatus.value = 'Initiating connection...'
  
  const result = await apiRequest('/xumm-connect', 'POST', {})
  
  if (result.ok) {
    const { payloadId, qrCode: qr, deepLink: dl } = result.data
    wallet.payloadId = payloadId
    qrCode.value = qr
    deepLink.value = dl
    connectionStatus.value = 'Waiting for wallet connection...'
    
    pollConnectionStatus(payloadId)
  } else {
    connectionStatus.value = 'Connection failed'
  }
}

const pollConnectionStatus = async (payloadId: string) => {
  const poll = async () => {
    const result = await apiRequest('/xumm-status', 'POST', { payloadId })
    
    if (result.ok) {
      if (result.data.signed) {
        wallet.connected = true
        wallet.address = result.data.account
        connectionStatus.value = `Connected: ${result.data.account}`
        qrCode.value = ''
        deepLink.value = ''
        saveWalletToStorage()
        loadUserAssets()
        loadWalletBalance()
      } else {
        setTimeout(poll, 2500)
      }
    } else {
      connectionStatus.value = 'Connection polling failed'
    }
  }
  
  poll()
}

const browseAssets = async () => {
  const params = new URLSearchParams({
    status: assetFilters.status,
    limit: assetFilters.limit.toString(),
    offset: assetFilters.offset.toString()
  })
  
  const result = await apiRequest(`/get-assets?${params}`)
  
  if (result.ok) {
    assets.value = result.data.assets
    assetsTotal.value = result.data.total
  }
}

const purchaseAsset = async () => {
  if (!wallet.connected) {
    purchaseForm.status = 'Please connect wallet first'
    return
  }
  
  purchaseForm.status = 'Initiating purchase...'
  
  const result = await apiRequest('/xumm-buy-asset', 'POST', {
    assetId: purchaseForm.assetId,
    buyerAddress: wallet.address
  })
  
  if (result.ok) {
    const { payloadId, qrCode: qr, deepLink: dl } = result.data
    purchaseForm.payloadId = payloadId
    purchaseForm.qrCode = qr
    purchaseForm.deepLink = dl
    purchaseForm.status = 'Waiting for transaction signature...'
    
    pollTransactionStatus(payloadId, 'purchase')
  } else {
    purchaseForm.status = 'Purchase initiation failed'
  }
}

const pollTransactionStatus = async (payloadId: string, type: 'purchase' | 'sell' | 'issuance' | 'mint' | 'trustline' | 'escrow') => {
  const poll = async () => {
    const result = await apiRequest('/transaction-status', 'POST', { payloadId })
    
    if (result.ok) {
      if (result.data.signed) {
        const message = `Transaction signed! TxID: ${result.data.txid}`
        if (type === 'purchase') {
          purchaseForm.status = message + ` | Asset Status: ${result.data.assetStatus}`
          purchaseForm.qrCode = ''
          purchaseForm.deepLink = ''
          
          // Reload marketplace and user assets when purchase completes
          await loadMarketplaceAssets()
          await loadUserAssets()
          
          // Show trustline creation popup for the purchased token
          const shouldAddTrustline = confirm(
            `🎉 Purchase completed successfully!\n\n` +
            `To see your new token in your wallet, you need to add a trustline.\n\n` +
            `Would you like to create a trustline now?`
          )
          
          if (shouldAddTrustline && purchaseForm.assetId) {
            // Get the asset details to create trustline
            const assetResponse = await apiRequest(`/get-assets?id=${purchaseForm.assetId}`)
            if (assetResponse.ok && assetResponse.data.assets.length > 0) {
              const asset = assetResponse.data.assets[0]
              
              // Pre-fill the trustline form
              // trustLineForm doesn't have currency/issuer properties, skipping
              
              // Automatically trigger trustline creation to show QR code
              trustLineForm.status = `Creating trustline for purchased token: ${asset.name} (${asset.token_currency})...`
              
              const result = await apiRequest('/create-trustline', 'POST', {
                assetId: asset.id,
                holderAddress: wallet.address
              })

              if (result.ok) {
                const { payloadId, qrCode, deepLink, message } = result.data
                trustLineForm.payloadId = payloadId
                trustLineForm.qrCode = qrCode
                trustLineForm.deepLink = deepLink
                trustLineForm.status = `${message} - Scan QR code to add ${asset.name} to your wallet`
                
                // Start monitoring the trustline transaction
                setTimeout(() => pollTransactionStatus(payloadId, 'trustline'), 5000)
              } else {
                trustLineForm.status = `Failed to create trustline for ${asset.name}: ${result.data?.error || 'Unknown error'}`
              }
            }
          }
        } else if (type === 'sell') {
          sellOfferForm.status = message
          sellOfferForm.qrCode = ''
          sellOfferForm.deepLink = ''
        } else if (type === 'issuance') {
          // Complete the token issuance process
          const completeResult = await apiRequest('/complete-token-issuance', 'POST', {
            payloadId,
            txHash: result.data.txid,
            assetId: tokenIssuanceForm.assetId
          })
          
          if (completeResult.ok) {
            tokenIssuanceForm.status = message + ' | Tokens issued successfully! Asset is now active.'
            addLog('Asset activated with issued tokens')
          } else {
            tokenIssuanceForm.status = message + ' | Tokens issued but failed to update asset status'
          }
          
          tokenIssuanceForm.qrCode = ''
          tokenIssuanceForm.deepLink = ''
          loadUserAssets()
        } else if (type === 'mint') {
          mintTokenForm.status = message + ' | Token minted to holder wallet! Check your wallet.'
          mintTokenForm.qrCode = ''
          mintTokenForm.deepLink = ''
          addLog('Token minted successfully')
        } else if (type === 'trustline') {
          trustLineForm.status = message + ' | Trust line created! Now minting token to your wallet...'
          trustLineForm.qrCode = ''
          trustLineForm.deepLink = ''
          addLog('Trust line created successfully')
          
          // After trust line is created, complete the minting
          if (trustLineForm.assetId) {
            const mintResult = await apiRequest('/complete-minting', 'POST', {
              assetId: trustLineForm.assetId,
              holderAddress: wallet.address
            })
            
            if (mintResult.ok && mintResult.data.success) {
              trustLineForm.status = `✅ ${mintResult.data.message}`
              addLog(`Token minted! TX: ${mintResult.data.transactionHash}`)
              loadUserAssets()
            } else {
              trustLineForm.status = `Trust line created but minting failed: ${mintResult.data?.error || 'Unknown error'}`
            }
          }
        } else if (type === 'escrow') {
          escrowForm.status = message + ' | Token transferred to escrow! Processing listing...'
          escrowForm.qrCode = ''
          escrowForm.deepLink = ''
          addLog('Token escrowed successfully - processing listing')
          
          // Call polling function to update status
          const pollResult = await apiRequest('/poll-pending-transactions', 'GET')
          
          if (pollResult.ok && pollResult.data.success) {
            escrowForm.status = message + ' | Asset successfully listed for sale!'
            addLog(`Polling complete: ${pollResult.data.updated} asset(s) updated`)
          } else {
            escrowForm.status = message + ' | Asset will be listed shortly (automatic processing)'
            addLog('Polling failed - asset will be processed automatically')
          }
          
          loadUserAssets()
          loadMarketplaceAssets()
        } else if (type === 'escrow') {
          escrowForm.status = message + ' | Token transferred to escrow! Processing listing...'
          escrowForm.qrCode = ''
          escrowForm.deepLink = ''
          addLog('Token escrowed successfully - processing listing')
          
          // Call polling function to update status
          const pollResult = await apiRequest('/poll-pending-transactions', 'GET')
          
          if (pollResult.ok && pollResult.data.success) {
            escrowForm.status = message + ' | Asset successfully listed for sale!'
            addLog(`Polling complete: ${pollResult.data.updated} asset(s) updated`)
          } else {
            escrowForm.status = message + ' | Asset will be listed shortly (automatic processing)'
            addLog('Polling failed - asset will be processed automatically')
          }
          
          loadUserAssets()
          loadMarketplaceAssets()
        }
      } else if (result.data.expired) {
        const expiredMessage = 'Transaction expired'
        if (type === 'purchase') {
          purchaseForm.status = expiredMessage
        } else if (type === 'sell') {
          sellOfferForm.status = expiredMessage
        } else if (type === 'issuance') {
          tokenIssuanceForm.status = expiredMessage
        } else if (type === 'mint') {
          mintTokenForm.status = expiredMessage
        } else if (type === 'trustline') {
          trustLineForm.status = expiredMessage
        } else if (type === 'escrow') {
          escrowForm.status = expiredMessage
        } else if (type === 'escrow') {
          escrowForm.status = expiredMessage
        }
      } else {
        setTimeout(poll, 4000)
      }
    }
  }
  
  poll()
}

const createAsset = async () => {
  if (!wallet.connected) {
    return
  }
  
  const result = await apiRequest('/create-asset', 'POST', {
    name: createAssetForm.name,
    description: createAssetForm.description,
    price_xrp: parseFloat(createAssetForm.price_xrp),
    token_currency: createAssetForm.token_currency,
    // token_issuer is set by backend (using BACKEND_WALLET_ADDRESS)
    seller_address: wallet.address,
    image_url: createAssetForm.image_url
  })
  
  if (result.ok) {
    const { message, asset, requiresTrustLine } = result.data
    
    addLog(message)
    
    // Clear the form
    Object.keys(createAssetForm).forEach(key => {
      (createAssetForm as any)[key] = ''
    })
    
    // Reload assets
    await loadUserAssets()
    
    // If trust line is required, prompt user to create it
    if (requiresTrustLine && asset) {
      setTimeout(() => {
        alert(`Asset created! Now please click "Add to Wallet" to create a trust line and receive your ${asset.token_currency} token.`)
      }, 1000)
    }
  }
}

const createSellOffer = async () => {
  if (!wallet.connected) {
    sellOfferForm.status = 'Please connect wallet first'
    return
  }
  
  sellOfferForm.status = 'Creating sell offer...'
  
  const selectedAsset = userAssets.value.find(asset => asset.id === sellOfferForm.selectedAssetId)
  if (!selectedAsset) {
    sellOfferForm.status = 'Please select an asset'
    return
  }

  const result = await apiRequest('/xumm-sell-transaction', 'POST', {
    tokenCurrency: selectedAsset.token_currency,
    tokenIssuer: wallet.address,
    tokenAmount: sellOfferForm.token_amount,
    xrpPrice: sellOfferForm.xrp_price
  })
  
  if (result.ok) {
    const { payloadId, qrCode: qr, deepLink: dl } = result.data
    sellOfferForm.payloadId = payloadId
    sellOfferForm.qrCode = qr
    sellOfferForm.deepLink = dl
    sellOfferForm.status = 'Waiting for transaction signature...'
    
    pollTransactionStatus(payloadId, 'sell')
  } else {
    sellOfferForm.status = 'Sell offer creation failed'
  }
}

const loadProfile = async () => {
  if (!wallet.connected) {
    return
  }
  
  const result = await apiRequest(`/user-profile?wallet_address=${wallet.address}`)
  
  if (result.ok) {
    userProfile.value = result.data
  }
}

const loadUserAssets = async () => {
  if (!wallet.connected) {
    return
  }
  
  const result = await apiRequest(`/get-assets?owner=${wallet.address}&status=active&limit=100`)
  
  if (result.ok) {
    userAssets.value = result.data.assets || []
    addLog(`Loaded ${userAssets.value.length} user assets`)
  } else {
    addLog(`Failed to load user assets: ${JSON.stringify(result.data)}`)
  }
}

const loadMarketplaceAssets = async () => {
  const result = await apiRequest('/get-marketplace-assets?limit=100')
  
  if (result.ok) {
    marketplaceAssets.value = result.data.assets || []
    addLog(`Loaded ${marketplaceAssets.value.length} marketplace assets`)
  } else {
    addLog(`Failed to load marketplace assets: ${JSON.stringify(result.data)}`)
  }
}

const clearLogs = () => {
  logs.value = []
}

const selectedAssetInfo = computed(() => {
  return userAssets.value.find(asset => asset.id === sellOfferForm.selectedAssetId)
})

const createTrustLine = async (asset: Asset) => {
  if (!wallet.connected) {
    trustLineForm.status = 'Please connect wallet first'
    return
  }
  
  
  trustLineForm.status = 'Creating trust line transaction for your wallet...'
  trustLineForm.assetId = asset.id
  
  const result = await apiRequest('/create-trustline', 'POST', {
    assetId: asset.id,
    holderAddress: wallet.address
  })
  
  if (result.ok) {
    const { payloadId, qrCode, deepLink } = result.data
    trustLineForm.payloadId = payloadId
    trustLineForm.qrCode = qrCode
    trustLineForm.deepLink = deepLink
    trustLineForm.status = result.data.message + ' Then you can receive the token!'
    
    pollTransactionStatus(payloadId, 'trustline')
  } else {
    trustLineForm.status = 'Trust line creation failed'
  }
}

const listForSale = async (asset: Asset) => {
  if (!wallet.connected) {
    alert('Please connect wallet first')
    return
  }
  
  if (confirm(`List ${asset.name} for sale at ${asset.price_xrp} XRP? This will transfer the token to escrow.`)) {
    escrowForm.status = 'Creating escrow transaction...'
    escrowForm.assetId = asset.id
    
    const result = await apiRequest('/escrow-token', 'POST', {
      assetId: asset.id
    })
    
    if (result.ok) {
      const { payloadId, qrCode, deepLink, message } = result.data
      escrowForm.payloadId = payloadId
      escrowForm.qrCode = qrCode
      escrowForm.deepLink = deepLink
      escrowForm.status = message
      
      // Poll for completion
      pollTransactionStatus(payloadId, 'escrow')
    } else {
      escrowForm.status = 'Failed to create escrow transaction'
    }
  }
}

const removeFromSale = async (asset: Asset) => {
  if (!wallet.connected) {
    alert('Please connect wallet first')
    return
  }
  
  if (confirm(`Remove ${asset.name} from sale? This will return the token to your wallet.`)) {
    const result = await apiRequest('/remove-from-sale', 'POST', {
      assetId: asset.id,
      ownerAddress: wallet.address
    })
    
    if (result.ok && result.data.success) {
      alert(`✅ ${result.data.message}`)
      await loadUserAssets()
      await loadMarketplaceAssets()
    } else {
      alert(`❌ ${result.data?.error || 'Failed to remove from sale'}`)
    }
  }
}

const purchaseMarketplaceAsset = async (asset: Asset) => {
  if (!wallet.connected) {
    alert('Please connect wallet first')
    return
  }
  
  if (confirm(`Purchase ${asset.name} for ${asset.price_xrp} XRP?`)) {
    // Set the asset ID in the purchase form for tracking
    purchaseForm.assetId = asset.id
    purchaseForm.status = 'Creating purchase transaction...'
    
    const result = await apiRequest('/purchase-from-escrow', 'POST', {
      assetId: asset.id,
      buyerAddress: wallet.address
    })
    
    if (result.ok) {
      const { payloadId, qrCode, deepLink, message } = result.data
      
      // Update purchase form with QR code
      purchaseForm.payloadId = payloadId
      purchaseForm.qrCode = qrCode
      purchaseForm.deepLink = deepLink
      purchaseForm.status = `${message} - Scan QR code or click link to complete purchase`
      
      // Start monitoring the transaction
      setTimeout(() => pollTransactionStatus(payloadId, 'purchase'), 5000)
      
      // Don't reload marketplace immediately - wait for transaction completion
    } else {
      purchaseForm.status = 'Failed to create purchase transaction'
      alert(`❌ ${result.data?.error || 'Failed to create purchase transaction'}`)
    }
  }
}

const fixEscrowStatus = async () => {
  if (!escrowForm.payloadId) {
    alert('No escrow transaction to fix')
    return
  }
  
  const result = await apiRequest('/fix-escrow-status', 'POST', {
    payloadId: escrowForm.payloadId
  })
  
  if (result.ok && result.data.success) {
    alert(`✅ ${result.data.message}`)
    escrowForm.status = 'Asset successfully listed for sale!'
    await loadUserAssets()
    await loadMarketplaceAssets()
  } else {
    alert(`❌ ${result.data?.message || 'Failed to fix escrow status'}`)
  }
}

const pollPendingTransactions = async () => {
  const result = await apiRequest('/poll-pending-transactions', 'GET')
  
  if (result.ok && result.data.success) {
    const { processed, updated } = result.data
    
    if (updated > 0) {
      alert(`✅ Processed ${processed} pending transactions, updated ${updated} assets to marketplace`)
      await loadUserAssets()
      await loadMarketplaceAssets()
    } else if (processed > 0) {
      alert(`ℹ️ Checked ${processed} pending transactions, none ready to update yet`)
    } else {
      alert('ℹ️ No pending transactions to check')
    }
    
    addLog(`Polling: ${processed} processed, ${updated} updated`)
  } else {
    alert('❌ Failed to check pending transactions')
  }
}

const onAssetSelect = () => {
  // Clear previous form data when selecting a new asset
  sellOfferForm.token_amount = ''
  sellOfferForm.xrp_price = ''
  sellOfferForm.status = ''
  sellOfferForm.payloadId = ''
  sellOfferForm.qrCode = ''
  sellOfferForm.deepLink = ''
}


const toggleAssetStatus = async (asset: Asset) => {
  const newStatus = asset.status === 'active' ? 'inactive' : 'active'
  
  const result = await apiRequest(`/update-asset-status`, 'POST', {
    assetId: asset.id,
    status: newStatus,
    ownerAddress: wallet.address
  })
  
  if (result.ok) {
    addLog(`Asset ${asset.name} status updated to ${newStatus}`)
    loadUserAssets()
  } else {
    addLog(`Failed to update asset status: ${JSON.stringify(result.data)}`)
  }
}

// Initialize app - load wallet from storage
onMounted(() => {
  loadWalletFromStorage()
  loadMarketplaceAssets()  // Load marketplace on app start
})
</script>

<template>
  <div class="container">
    <h1>🏠 RWA Marketplace API Tester</h1>
    
    <!-- Wallet Connection -->
    <div class="section">
      <h2>🔗 Wallet Connection</h2>
      <div class="wallet-buttons">
        <button 
          @click="connectWallet" 
          :disabled="wallet.connected"
          class="btn primary"
        >
          {{ wallet.connected ? 'Connected' : 'Connect Wallet' }}
        </button>
        <button 
          v-if="wallet.connected"
          @click="disconnectWallet" 
          class="btn secondary"
        >
          Disconnect
        </button>
      </div>
      <div v-if="connectionStatus" class="status">{{ connectionStatus }}</div>
      <div v-if="wallet.connected && walletBalance" class="balance-display">
        💰 Balance: {{ walletBalance }} XRP
        <button @click="loadWalletBalance" class="btn small">Refresh</button>
      </div>
      <div v-if="qrCode" class="qr-section">
        <p>Scan QR Code or use deep link:</p>
        <img :src="qrCode" alt="QR Code" class="qr-code" />
        <a :href="deepLink" target="_blank" class="deep-link">Open in XUMM</a>
      </div>
    </div>

    <!-- Marketplace -->
    <div class="section">
      <h2>🏪 Marketplace - Assets for Sale</h2>
      
      <div class="subsection">
        <div class="form-row">
          <button @click="loadMarketplaceAssets" class="btn secondary">Refresh Marketplace</button>
          <button @click="pollPendingTransactions" class="btn secondary" style="margin-left: 10px;">Check Pending Listings</button>
          <span style="margin-left: 10px; color: #666;">Total: {{ marketplaceAssets.length }} assets for sale</span>
        </div>
        
        <div v-if="marketplaceAssets.length === 0" class="empty-state">
          No assets for sale at the moment. List your asset to be the first!
        </div>
        
        <div v-else class="assets-grid">
          <div v-for="asset in marketplaceAssets" :key="asset.id" class="asset-card marketplace-card">
            <h4>{{ asset.name }}</h4>
            <p>{{ asset.description }}</p>
            <div class="asset-details">
              <p><strong>Price:</strong> {{ asset.price_xrp }} XRP</p>
              <p><strong>Token:</strong> {{ asset.token_currency }} (1 unique token)</p>
              <p><strong>Seller:</strong> {{ asset.seller_address?.substring(0, 8) }}...</p>
              <p><strong>Listed:</strong> {{ asset.listed_at ? new Date(asset.listed_at).toLocaleDateString() : 'N/A' }}</p>
              <p><strong>Status:</strong> 🏦 In Escrow</p>
            </div>
            <div class="asset-actions">
              <button 
                v-if="wallet.connected && wallet.address !== asset.seller_address"
                @click="purchaseMarketplaceAsset(asset)" 
                class="btn primary"
              >
                Buy for {{ asset.price_xrp }} XRP
              </button>
              <span v-else-if="!wallet.connected" class="info-text">
                Connect wallet to purchase
              </span>
              <span v-else class="info-text">
                Your own asset
              </span>
              <button 
                v-if="wallet.connected && wallet.address === asset.seller_address"
                @click="removeFromSale(asset)" 
                class="btn secondary small"
                style="margin-top: 10px;"
              >
                🏠 Remove from Sale
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Buyer Flow -->
    <div class="section" v-if="wallet.connected">
      <h2>🛒 Buyer Flow</h2>
      
      <div class="subsection">
        <h3>Browse Assets</h3>
        <div class="form-row">
          <label>Status:</label>
          <select v-model="assetFilters.status">
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div class="form-row">
          <label>Limit:</label>
          <input type="number" v-model="assetFilters.limit" min="1" max="100">
        </div>
        <div class="form-row">
          <label>Offset:</label>
          <input type="number" v-model="assetFilters.offset" min="0">
        </div>
        <button @click="browseAssets" class="btn secondary">Browse Assets</button>
        
        <div v-if="assets.length" class="assets-grid">
          <div v-for="asset in assets" :key="asset.id" class="asset-card">
            <h4>{{ asset.name }}</h4>
            <p>{{ asset.description }}</p>
            <p><strong>Price:</strong> {{ asset.price_xrp }} XRP</p>
            <p><strong>Status:</strong> {{ asset.status }}</p>
            <p><strong>ID:</strong> {{ asset.id }}</p>
            <button @click="purchaseForm.assetId = asset.id" class="btn small">
              Select for Purchase
            </button>
          </div>
        </div>
        <div v-if="assetsTotal" class="total">Total assets: {{ assetsTotal }}</div>
      </div>

      <div class="subsection">
        <h3>Purchase Asset</h3>
        <div class="form-row">
          <label>Asset ID:</label>
          <input v-model="purchaseForm.assetId" placeholder="Enter asset UUID">
        </div>
        <button @click="purchaseAsset" class="btn primary">Purchase Asset</button>
        <div v-if="purchaseForm.status" class="status">{{ purchaseForm.status }}</div>
        <div v-if="purchaseForm.qrCode" class="qr-section">
          <img :src="purchaseForm.qrCode" alt="Purchase QR" class="qr-code" />
          <a :href="purchaseForm.deepLink" target="_blank" class="deep-link">Open in XUMM</a>
        </div>
      </div>
    </div>

    <!-- Seller Flow -->
    <div class="section" v-if="wallet.connected">
      <h2>💰 Seller Flow</h2>
      
      <div class="subsection">
        <h3>Create Asset</h3>
        <div class="form-row">
          <label>Name:</label>
          <input v-model="createAssetForm.name" placeholder="Real Estate Token">
        </div>
        <div class="form-row">
          <label>Description:</label>
          <textarea v-model="createAssetForm.description" placeholder="Describe your asset..."></textarea>
        </div>
        <div class="form-row">
          <label>Price (XRP):</label>
          <input v-model="createAssetForm.price_xrp" type="number" placeholder="1000" step="0.000001">
        </div>
        <div class="form-row">
          <label>Token Currency:</label>
          <input v-model="createAssetForm.token_currency" placeholder="RET">
        </div>
        <div class="form-row">
          <label>Token Issuer:</label>
          <input :value="wallet.address" readonly placeholder="Auto-filled from connected wallet" class="readonly-input">
        </div>
        <div class="form-row">
          <label>Image URL:</label>
          <input v-model="createAssetForm.image_url" placeholder="https://example.com/image.jpg">
        </div>
        <button @click="createAsset" class="btn primary">Create Asset</button>
      </div>

      <!-- Token Issuance QR Section - Shows immediately after asset creation -->
      <div v-if="tokenIssuanceForm.status" class="subsection">
        <h3>🪙 Token Issuance</h3>
        <div class="status">{{ tokenIssuanceForm.status }}</div>
        <div v-if="tokenIssuanceForm.qrCode" class="qr-section">
          <p>Scan QR Code to issue tokens to your wallet:</p>
          <img :src="tokenIssuanceForm.qrCode" alt="Token Issuance QR" class="qr-code" />
          <a :href="tokenIssuanceForm.deepLink" target="_blank" class="deep-link">Open in XUMM</a>
        </div>
      </div>

      <!-- Token Mint QR Section -->
      <div v-if="mintTokenForm.status" class="subsection">
        <h3>🪙 Mint Token to Wallet</h3>
        <div class="status">{{ mintTokenForm.status }}</div>
        <div v-if="mintTokenForm.qrCode" class="qr-section">
          <p>Scan QR Code to mint token to another wallet:</p>
          <img :src="mintTokenForm.qrCode" alt="Token Mint QR" class="qr-code" />
          <a :href="mintTokenForm.deepLink" target="_blank" class="deep-link">Open in XUMM</a>
        </div>
      </div>

      <!-- Trust Line QR Section -->
      <div v-if="trustLineForm.status" class="subsection">
        <h3>🔗 Add Token to Your Wallet</h3>
        <div class="status">{{ trustLineForm.status }}</div>
        <div v-if="trustLineForm.qrCode" class="qr-section">
          <p>Scan QR Code to add this token to your wallet:</p>
          <img :src="trustLineForm.qrCode" alt="Trust Line QR" class="qr-code" />
          <a :href="trustLineForm.deepLink" target="_blank" class="deep-link">Open in XUMM</a>
        </div>
      </div>

      <!-- Escrow QR Section -->
      <div v-if="escrowForm.status" class="subsection">
        <h3>🏦 Transfer Token to Escrow</h3>
        <div class="status">{{ escrowForm.status }}</div>
        <div v-if="escrowForm.qrCode" class="qr-section">
          <p>Scan QR Code to transfer your token to escrow for listing:</p>
          <img :src="escrowForm.qrCode" alt="Escrow QR" class="qr-code" />
          <a :href="escrowForm.deepLink" target="_blank" class="deep-link">Open in XUMM</a>
        </div>
        <div v-if="escrowForm.payloadId && escrowForm.status.includes('automatic listing')" style="margin-top: 15px;">
          <button @click="fixEscrowStatus" class="btn secondary small">
            Fix Listing (if stuck)
          </button>
          <p style="font-size: 12px; color: #666; margin-top: 5px;">
            Click if asset doesn't appear in marketplace after signing
          </p>
        </div>
      </div>

      <div class="subsection">
        <h3>Create DEX Sell Offer</h3>
        <div class="form-row">
          <label>Select Asset:</label>
          <select v-model="sellOfferForm.selectedAssetId" @change="onAssetSelect">
            <option value="">Choose an asset to sell...</option>
            <option v-for="asset in userAssets" :key="asset.id" :value="asset.id">
              {{ asset.name }} ({{ asset.token_currency }})
            </option>
          </select>
        </div>
        <div class="form-row" v-if="sellOfferForm.selectedAssetId">
          <label>Token Currency:</label>
          <input :value="selectedAssetInfo?.token_currency || ''" readonly class="readonly-input">
        </div>
        <div class="form-row" v-if="sellOfferForm.selectedAssetId">
          <label>Token Issuer:</label>
          <input :value="wallet.address" readonly class="readonly-input">
        </div>
        <div class="form-row">
          <label>Token Amount:</label>
          <input v-model="sellOfferForm.token_amount" placeholder="100">
        </div>
        <div class="form-row">
          <label>XRP Price:</label>
          <input v-model="sellOfferForm.xrp_price" placeholder="1000">
        </div>
        <button @click="createSellOffer" class="btn secondary">Create Sell Offer</button>
        <div v-if="sellOfferForm.status" class="status">{{ sellOfferForm.status }}</div>
        <div v-if="sellOfferForm.qrCode" class="qr-section">
          <img :src="sellOfferForm.qrCode" alt="Sell Offer QR" class="qr-code" />
          <a :href="sellOfferForm.deepLink" target="_blank" class="deep-link">Open in XUMM</a>
        </div>
      </div>

      <div class="subsection">
        <h3>User Profile</h3>
        <button @click="loadProfile" class="btn secondary">Load Profile</button>
        <div v-if="userProfile" class="profile-data">
          <pre>{{ JSON.stringify(userProfile, null, 2) }}</pre>
        </div>
      </div>

      <div class="subsection">
        <h3>My Assets</h3>
        <button @click="loadUserAssets" class="btn secondary">Refresh My Assets</button>
        <div v-if="userAssets.length === 0" class="empty-state">
          No assets found. Create your first asset above!
        </div>
        <div v-else class="assets-grid">
          <div v-for="asset in userAssets" :key="asset.id" class="asset-card my-asset-card">
            <h4>{{ asset.name }}</h4>
            <p>{{ asset.description }}</p>
            <div class="asset-details">
              <p><strong>Price:</strong> {{ asset.price_xrp }} XRP</p>
              <p><strong>Status:</strong> 
                <span :class="'status-' + asset.status">{{ asset.status }}</span>
              </p>
              <p><strong>Token:</strong> {{ asset.token_currency }} (1 unique token)</p>
              <p><strong>Issuance:</strong> 
                <span :class="'status-' + (asset.issuance_status || 'not_started')">{{ asset.issuance_status || 'not_started' }}</span>
              </p>
              <p><strong>Created:</strong> {{ asset.created_at ? new Date(asset.created_at).toLocaleDateString() : 'N/A' }}</p>
            </div>
            <div class="asset-actions">
              <button 
                v-if="asset.status === 'active'"
                @click="createTrustLine(asset)" 
                class="btn small success"
              >
                Add to Wallet
              </button>
              <button 
                v-if="asset.status === 'active' && asset.issuance_status === 'completed'"
                @click="listForSale(asset)" 
                class="btn small primary"
              >
                List for Sale
              </button>
              <button 
                v-if="(asset.status === 'for_sale' && asset.escrow_status === 'escrowed') || asset.status === 'for_sale'"
                @click="removeFromSale(asset)" 
                class="btn small success"
              >
                🏠 Remove from Sale
              </button>
              <button 
                v-if="asset.status === 'active'"
                @click="toggleAssetStatus(asset)" 
                class="btn small secondary"
              >
                {{ asset.status === 'active' ? 'Deactivate' : 'Activate' }}
              </button>
              <div v-if="tokenIssuanceForm.assetId === asset.id && tokenIssuanceForm.status" class="pending-message">
                ⏳ {{ tokenIssuanceForm.status }}
              </div>
              <div v-if="mintTokenForm.assetId === asset.id && mintTokenForm.status" class="pending-message">
                🪙 {{ mintTokenForm.status }}
              </div>
              <div v-if="trustLineForm.assetId === asset.id && trustLineForm.status" class="pending-message">
                🔗 {{ trustLineForm.status }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="userAssets.length > 0" class="total">
          Total: {{ userAssets.length }} assets
        </div>
      </div>

    </div>

    <!-- Logs -->
    <div class="section">
      <h2>📋 API Logs</h2>
      <button @click="clearLogs" class="btn small">Clear Logs</button>
      <div class="logs">
        <div v-for="log in logs" :key="log" class="log-entry">{{ log }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
}

.section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #dee2e6;
}

.subsection {
  background: white;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
  border: 1px solid #e9ecef;
}

h2 {
  color: #495057;
  margin-bottom: 15px;
  font-size: 1.25em;
}

h3 {
  color: #6c757d;
  margin-bottom: 10px;
  font-size: 1.1em;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 10px;
}

.form-row label {
  min-width: 120px;
  font-weight: 500;
}

.form-row input, .form-row select, .form-row textarea {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.form-row textarea {
  min-height: 80px;
  resize: vertical;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin: 5px;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  background: #007bff;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn.secondary {
  background: #6c757d;
  color: white;
}

.btn.secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn.small {
  padding: 5px 10px;
  font-size: 12px;
}

.btn.success {
  background: #28a745;
  color: white;
}

.btn.success:hover:not(:disabled) {
  background: #218838;
}

.status {
  background: #e9ecef;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
  font-family: monospace;
  font-size: 13px;
}

.qr-section {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  margin: 10px 0;
}

.qr-code {
  max-width: 200px;
  height: auto;
  margin: 10px 0;
}

.deep-link {
  display: inline-block;
  color: #007bff;
  text-decoration: none;
  font-weight: 500;
}

.deep-link:hover {
  text-decoration: underline;
}

.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin: 15px 0;
}

.asset-card {
  background: white;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.asset-card h4 {
  margin: 0 0 10px 0;
  color: #495057;
}

.asset-card p {
  margin: 5px 0;
  font-size: 14px;
}

.total {
  font-weight: 500;
  color: #495057;
  margin-top: 10px;
}

.profile-data {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  margin-top: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.profile-data pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
}

.logs {
  max-height: 400px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 15px;
  margin-top: 10px;
}

.log-entry {
  color: #f8f8f2;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 5px;
  padding: 2px 0;
  word-break: break-all;
}

.readonly-input {
  background-color: #f8f9fa !important;
  color: #6c757d;
  cursor: not-allowed;
}

.readonly-input:focus {
  outline: none;
  box-shadow: none;
}

.wallet-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

.balance-display {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 2px solid #28a745;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  font-weight: 600;
  color: #155724;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.my-asset-card {
  border-left: 4px solid #007bff;
}

.marketplace-card {
  border-left: 4px solid #28a745;
  background: #f8fff9;
}

.info-text {
  color: #666;
  font-style: italic;
  font-size: 12px;
}

.asset-details {
  margin: 10px 0;
}

.asset-details p {
  margin: 5px 0;
  font-size: 13px;
}

.asset-actions {
  display: flex;
  gap: 5px;
  margin-top: 10px;
}

.status-active {
  color: #28a745;
  font-weight: 600;
}

.status-inactive {
  color: #dc3545;
  font-weight: 600;
}

.status-sold {
  color: #6c757d;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 6px;
  margin: 10px 0;
}


.status-not_started {
  color: #dc3545;
  font-weight: 600;
}

.status-pending {
  color: #ffc107;
  font-weight: 600;
}

.status-completed {
  color: #28a745;
  font-weight: 600;
}

.pending-message {
  font-size: 12px;
  color: #fd7e14;
  font-style: italic;
  margin-top: 5px;
}
</style>
