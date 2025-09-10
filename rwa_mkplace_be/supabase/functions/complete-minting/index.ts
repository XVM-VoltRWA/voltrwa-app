/**
 * Complete Token Minting After Trust Line
 * 
 * Completes the token minting process after a user has created a trust line.
 * This is called after the trust line is successfully created.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,        // UUID of the asset
 *   holderAddress: string   // Wallet address that created the trust line
 * }
 * 
 * Output:
 * {
 *   success: boolean,
 *   transactionHash?: string,
 *   message: string
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import xrpl from 'npm:xrpl@2.7.0'
const { Client, Wallet } = xrpl

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BACKEND_WALLET_SEED = Deno.env.get('BACKEND_WALLET_SEED')!
const BACKEND_WALLET_ADDRESS = Deno.env.get('BACKEND_WALLET_ADDRESS')!
const NETWORK = Deno.env.get('NETWORK') || 'mainnet'
const XRPL_SERVER = NETWORK === 'testnet' ? 'wss://testnet.xrpl-labs.com' : 'wss://xrplcluster.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }

  try {
    const { assetId, holderAddress } = await req.json()

    if (!assetId || !holderAddress) {
      return new Response(
        JSON.stringify({ error: 'assetId and holderAddress are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('owner_address', holderAddress)  // Must be the owner
      .single()

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Asset not found or you are not the owner' }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Check if already minted
    if (asset.issuance_status === 'completed' && asset.issuance_tx_hash) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Token already minted to your wallet',
          transactionHash: asset.issuance_tx_hash
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Connect to XRPL and create wallet from seed
    const client = new Client(XRPL_SERVER)
    await client.connect()
    
    const wallet = Wallet.fromSeed(BACKEND_WALLET_SEED)
    
    // Verify the wallet is the issuer
    if (wallet.address !== asset.token_issuer) {
      await client.disconnect()
      return new Response(
        JSON.stringify({ 
          error: 'Backend wallet is not the issuer of this token',
          details: `Expected issuer: ${asset.token_issuer}, Backend wallet: ${wallet.address}`
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Create payment transaction to mint token
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,  // Backend wallet (issuer)
      Destination: holderAddress,
      Amount: {
        currency: asset.token_currency,
        issuer: wallet.address,
        value: "1"  // Always 1 for RWA
      },
      Memos: [{
        Memo: {
          MemoType: new TextEncoder().encode('rwa_complete_mint').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
          MemoData: new TextEncoder().encode(`Complete mint: ${asset.name} | ID: ${assetId}`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
        }
      }]
    }

    // Submit and wait for validation
    const response = await client.submitAndWait(payment, { wallet })
    
    await client.disconnect()

    if (response.result.meta?.TransactionResult === 'tesSUCCESS') {
      // Update asset with successful minting info
      await supabase
        .from('assets')
        .update({
          issuance_status: 'completed',
          issuance_tx_hash: response.result.hash,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)

      return new Response(
        JSON.stringify({
          success: true,
          transactionHash: response.result.hash,
          message: `Token successfully minted! Check your wallet for ${asset.token_currency}.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Transaction failed: ${response.result.meta?.TransactionResult}`,
          details: response.result
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

  } catch (error) {
    console.error('Error completing mint:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to complete minting',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})