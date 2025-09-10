/**
 * Remove Asset from Sale
 * 
 * Automatically returns the token from escrow to the original owner
 * when they want to remove their asset from sale.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,        // UUID of the asset to remove from sale
 *   ownerAddress: string    // Wallet address of the owner
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
    const { assetId, ownerAddress } = await req.json()

    if (!assetId || !ownerAddress) {
      return new Response(
        JSON.stringify({ error: 'assetId and ownerAddress are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get asset details and verify ownership
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('seller_address', ownerAddress)  // Must be the original seller
      .eq('escrow_status', 'escrowed')     // Must be in escrow
      .single()

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Asset not found, not in escrow, or you are not the owner' }),
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
    
    // Create transaction to return token from escrow to owner
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,  // Backend wallet (escrow)
      Destination: ownerAddress,
      Amount: {
        currency: asset.token_currency,
        issuer: asset.token_issuer,  // Backend wallet is issuer
        value: "1"  // Always 1 for RWA
      },
      Memos: [{
        Memo: {
          MemoType: new TextEncoder().encode('rwa_return_escrow').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
          MemoData: new TextEncoder().encode(`Return from escrow: ${asset.name} | ID: ${assetId}`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
        }
      }]
    }

    // Submit and wait for validation
    const response = await client.submitAndWait(payment, { wallet })
    
    await client.disconnect()

    if (response.result.meta?.TransactionResult === 'tesSUCCESS') {
      // Update asset status - returned to owner
      await supabase
        .from('assets')
        .update({
          status: 'active',
          escrow_status: null,
          owner_address: ownerAddress,  // Back to original owner
          listed_at: null,
          purchase_payload_id: null,
          escrow_payload_id: null,
          pending_buyer: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)

      return new Response(
        JSON.stringify({
          success: true,
          transactionHash: response.result.hash,
          message: `${asset.name} successfully returned to your wallet from escrow`
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
    console.error('Error removing from sale:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to remove asset from sale',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})