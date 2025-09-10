/**
 * Automated Token Transfer After Purchase
 * 
 * Automatically transfers the RWA token from backend wallet (issuer) to buyer
 * after they have paid XRP to the seller. This completes the purchase flow.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,        // UUID of the asset
 *   buyerAddress: string,   // Wallet address that purchased the token
 *   txHash: string         // Transaction hash of the XRP payment to seller
 * }
 * 
 * Output:
 * {
 *   success: boolean,
 *   transactionHash: string,
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
    const { assetId, buyerAddress, txHash } = await req.json()

    if (!assetId || !buyerAddress || !txHash) {
      return new Response(
        JSON.stringify({ error: 'assetId, buyerAddress, and txHash are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get asset details - accept both active and pending_purchase for purchase completion
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .in('status', ['active', 'pending_purchase'])
      .single()

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Asset not found or not available' }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
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

    // Create payment transaction to transfer token to buyer
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,  // Backend wallet (issuer)
      Destination: buyerAddress,
      Amount: {
        currency: asset.token_currency,
        issuer: wallet.address,  // Same as Account since backend wallet is issuer
        value: "1"  // Always 1 for RWA
      },
      Memos: [{
        Memo: {
          MemoType: new TextEncoder().encode('rwa_purchase_complete').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
          MemoData: new TextEncoder().encode(`Purchase complete: ${asset.name} | Payment TX: ${txHash}`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
        }
      }]
    }

    // Submit and wait for validation
    const response = await client.submitAndWait(payment, { wallet })
    
    await client.disconnect()

    if (response.result.meta?.TransactionResult === 'tesSUCCESS') {
      // Update asset ownership in database
      const updateData = {
        owner_address: buyerAddress,
        updated_at: new Date().toISOString()
      }
      
      // If this was a purchase completion, clear purchase fields and set to active
      if (asset.status === 'pending_purchase') {
        updateData.status = 'active'
        updateData.escrow_status = null
        updateData.purchase_payload_id = null
        updateData.pending_buyer = null
      } else {
        // Otherwise, mark as sold (for direct transfers)
        updateData.status = 'sold'
      }
      
      await supabase
        .from('assets')
        .update(updateData)
        .eq('id', assetId)

      // Record the transaction
      await supabase
        .from('transactions')
        .insert({
          asset_id: assetId,
          buyer_address: buyerAddress,
          seller_address: asset.seller_address,
          price_xrp: asset.price_xrp,
          payment_tx_hash: txHash,
          token_transfer_tx_hash: response.result.hash,
          status: 'completed',
          created_at: new Date().toISOString()
        })

      return new Response(
        JSON.stringify({
          success: true,
          transactionHash: response.result.hash,
          message: `Successfully transferred ${asset.name} token to ${buyerAddress}`
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
    console.error('Error in auto-transfer:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to transfer token automatically',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})