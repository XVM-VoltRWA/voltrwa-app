# RWA Marketplace Functions

This document describes the 15 core functions that power the RWA marketplace.

## Asset Management (2 functions)

### `create-asset`
**Purpose**: Creates new RWA assets with automatic token issuance  
**Method**: POST  
**Input**: Asset details (name, description, price, token currency, etc.)  
**Output**: Asset ID, issuance transaction details  
**Flow**: User creates asset → Backend wallet issues token → Token minted to user

### `get-assets`
**Purpose**: Retrieves assets by owner, status, or ID  
**Method**: GET  
**Input**: Query parameters (owner, status, id, limit)  
**Output**: Array of matching assets  
**Usage**: Load user assets, get specific asset details

## Marketplace (4 functions)

### `get-marketplace-assets`
**Purpose**: Lists all assets available for purchase  
**Method**: GET  
**Input**: Optional limit parameter  
**Output**: Array of assets with status 'for_sale' and escrow_status 'escrowed'  
**Usage**: Display marketplace listings

### `escrow-token`
**Purpose**: Lists asset for sale by transferring token to escrow  
**Method**: POST  
**Input**: Asset ID  
**Output**: XUMM payload for seller to sign token transfer  
**Flow**: User lists asset → Token transferred to backend escrow wallet → Asset appears in marketplace

### `purchase-from-escrow`
**Purpose**: Initiates purchase of escrowed asset  
**Method**: POST  
**Input**: Asset ID, buyer address  
**Output**: XUMM payload for buyer to pay XRP to seller  
**Flow**: Buyer pays XRP → Automatic token transfer to buyer → Ownership updated

### `remove-from-sale`
**Purpose**: Removes asset from marketplace and returns token to owner  
**Method**: POST  
**Input**: Asset ID  
**Output**: Transaction hash of token return  
**Flow**: Automatic token transfer from escrow back to original owner

## Transaction Management (3 functions)

### `transaction-status`
**Purpose**: Checks XUMM transaction status  
**Method**: POST  
**Input**: XUMM payload ID  
**Output**: Transaction status (signed, expired, txid)  
**Usage**: Frontend polling to detect transaction completion

### `poll-pending-transactions`
**Purpose**: Processes all pending transactions (escrow & purchase)  
**Method**: GET  
**Input**: None  
**Output**: Summary of processed transactions  
**Flow**: Finds pending transactions → Checks XUMM status → Updates database → Triggers token transfers
**Note**: Replaces unreliable webhook system

### `auto-transfer-token`
**Purpose**: Transfers tokens from escrow to buyer after purchase  
**Method**: POST  
**Input**: Asset ID, buyer address, payment transaction hash  
**Output**: Token transfer transaction hash  
**Usage**: Called by polling system when purchase completes

## Token Lifecycle (5 functions)

### `complete-token-issuance`
**Purpose**: Completes token creation process after trust line is established  
**Method**: POST  
**Input**: Asset ID, payload ID, transaction hash  
**Output**: Success confirmation  
**Usage**: Called after user creates trust line for their new token

### `complete-minting`
**Purpose**: Completes token minting to user after trust line creation  
**Method**: POST  
**Input**: Asset ID, holder address, payload ID, transaction hash  
**Output**: Success confirmation  
**Usage**: Final step in token creation flow

### `auto-mint-token`
**Purpose**: Automatically mints tokens to asset holder  
**Method**: POST  
**Input**: Asset ID, holder address, transaction hash  
**Output**: Minting transaction hash  
**Usage**: Called internally by other functions

### `mint-token-to-holder`
**Purpose**: Creates XUMM transaction for minting tokens  
**Method**: POST  
**Input**: Asset ID, holder address  
**Output**: XUMM payload for minting  
**Usage**: Called during token creation process

### `create-trustline`
**Purpose**: Creates trust line for users to receive tokens  
**Method**: POST  
**Input**: Asset ID, holder address  
**Output**: XUMM payload for trust line creation  
**Usage**: Required before users can receive tokens

## XUMM Integration (2 functions)

### `xumm-connect`
**Purpose**: Initiates wallet connection via XUMM  
**Method**: POST  
**Input**: None  
**Output**: XUMM payload for wallet connection  
**Usage**: User wallet authentication

### `xumm-status`
**Purpose**: Checks XUMM payload status  
**Method**: POST  
**Input**: XUMM payload ID  
**Output**: Payload status and user info  
**Usage**: Wallet connection verification

## Manual Fix Functions (1 function)

### `fix-escrow-status`
**Purpose**: Manual cleanup for stuck escrow transactions  
**Method**: POST  
**Input**: Payload ID  
**Output**: Updated transaction status  
**Usage**: Rarely used for troubleshooting stuck transactions

## Architecture Overview

### Detailed Flow Diagrams

#### 1. Adding an Asset Flow
```
Frontend Calls:
1. POST /create-asset
   → Creates asset record in DB (status: 'pending')
   → Backend wallet creates token on XRPL
   → Returns XUMM payload for user to create trustline

2. POST /transaction-status (polling)
   → Frontend polls to check if trustline creation is complete
   → Once signed, trustline exists on XRPL

3. POST /complete-token-issuance
   → Updates asset status to 'minting'
   → Triggers internal token minting process

Internal Backend Calls:
4. auto-mint-token (called internally)
   → Backend wallet mints tokens to user's address
   → Tokens transferred on XRPL ledger

5. complete-minting (called internally)
   → Updates asset status to 'active'
   → Asset fully created and tokens in user's wallet
```

#### 2. Posting Asset for Sale Flow
```
Frontend Calls:
1. POST /escrow-token
   → Creates escrow transaction record in DB
   → Returns XUMM payload for token transfer to escrow

2. POST /transaction-status (polling)
   → Frontend polls to check if transfer is complete
   → Once signed, tokens move to backend escrow wallet on XRPL

Internal Processing:
3. poll-pending-transactions (backend cron job)
   → Detects completed escrow transaction
   → Updates asset escrow_status to 'escrowed'
   → Updates asset status to 'for_sale'
   → Asset now visible in marketplace
```

#### 3. Buying an Asset Flow
```
Frontend Calls:
1. POST /purchase-from-escrow
   → Creates purchase transaction record in DB
   → Returns XUMM payload for buyer to pay XRP to seller

2. POST /transaction-status (polling)
   → Frontend polls to check if payment is complete
   → Once signed, XRP transferred from buyer to seller on XRPL

Internal Backend Calls:
3. poll-pending-transactions (backend cron job)
   → Detects completed purchase payment
   → Triggers automatic token transfer

4. auto-transfer-token (called internally)
   → Backend escrow wallet transfers token to buyer on XRPL
   → Updates asset owner in DB
   → Updates asset status to 'active'
   → Updates escrow_status to 'not_escrowed'
   → Purchase complete - buyer owns asset
```

### Core Flow Summary
1. **Asset Creation**: `create-asset` → trustline → `complete-token-issuance` → `auto-mint-token` → `complete-minting`
2. **Listing**: `escrow-token` → XUMM sign → `poll-pending-transactions` → asset marked for sale
3. **Purchase**: `purchase-from-escrow` → XUMM payment → `poll-pending-transactions` → `auto-transfer-token` → ownership transferred
4. **Transaction Processing**: `poll-pending-transactions` continuously monitors all pending transactions

### Key Design Decisions
- **Backend Wallet**: Single issuer wallet for all tokens (XRPL limitation)
- **Escrow System**: Secure marketplace prevents double-spending
- **Polling over Webhooks**: Reliable transaction completion detection
- **Automatic Transfers**: Seamless token movement without user intervention

### Dependencies
- All functions use XUMM for transaction signing
- Backend wallet seed required for automatic operations
- Supabase database for asset and transaction state
- XRPL network for token operations