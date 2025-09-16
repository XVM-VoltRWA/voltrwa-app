# RWA Marketplace

A decentralized marketplace for Real World Assets (RWAs) built on the XRP Ledger, enabling the tokenization, trading, and ownership transfer of physical and digital assets through blockchain technology.

## Overview

This marketplace provides a complete infrastructure for converting real-world assets into tradeable digital tokens on the XRP Ledger. Users can create, mint, and trade tokenized representations of assets such as real estate, artwork, commodities, or any other valuable items.

## Architecture

### Backend (rwa_mkplace_be)
The backend is built on Supabase with TypeScript edge functions that handle:

- **Asset Management**: Creation and lifecycle management of RWA records
- **XRPL Integration**: Direct communication with XRP Ledger for token operations
- **Token Issuance**: Minting of unique tokens representing real-world assets
- **Wallet Operations**: XUMM wallet integration for secure transaction signing
- **Escrow System**: Secure holding of tokens during marketplace transactions
- **Trust Line Management**: Automated setup of token trust relationships
- **Transaction Monitoring**: Real-time tracking and status updates for XRPL transactions
- **Marketplace Logic**: Buy/sell order management and asset listing functionality

### Frontend (rwa_mkplace_fe)
The frontend is currently implemented as a comprehensive test tool built with Vue.js that provides:

- **Wallet Connection**: Integration with XUMM mobile wallet for XRPL access
- **Asset Creation Interface**: Forms and workflows for tokenizing new assets
- **Marketplace Browser**: View and interact with available tokenized assets
- **Transaction Management**: Real-time monitoring of blockchain transactions
- **Trust Line Setup**: Guided process for adding tokens to user wallets
- **Escrow Operations**: Interface for secure asset transfers and purchases
- **Testing Environment**: Complete API testing suite for all backend functions

The frontend serves as both a functional marketplace interface and a development tool for testing all backend capabilities, providing developers and users with full visibility into the tokenization and trading processes.