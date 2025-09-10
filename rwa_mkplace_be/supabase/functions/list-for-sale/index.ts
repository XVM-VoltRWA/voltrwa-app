/**
 * List Asset for Sale with Escrow
 * 
 * Lists an RWA token for sale by transferring it to the backend wallet (escrow).
 * This ensures the token is locked and available for purchase.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,      // UUID of the asset to list
 *   sellerAddress: string // Wallet address of the seller
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
    const { assetId, sellerAddress } = await req.json()

    if (!assetId || !sellerAddress) {
      return new Response(
        JSON.stringify({ error: 'assetId and sellerAddress are required' }),
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
      .eq('owner_address', sellerAddress)  // Must be the current owner
      .eq('status', 'active')
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

    // Check if already in escrow
    if (asset.escrow_status === 'escrowed') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Asset is already listed for sale in escrow'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Connect to XRPL and create wallet from seed
    const client = new Client(XRPL_SERVER)
    await client.connect()
    
    const wallet = Wallet.fromSeed(BACKEND_WALLET_SEED)
    
    // Create transaction to transfer token from seller to backend (escrow)
    // Note: This transaction will be signed by the backend wallet but sent from seller
    // We need to use the seller's wallet to sign - this should be done via XUMM
    
    await client.disconnect()

    // For now, we'll mark as pending escrow and require XUMM signature
    // The actual escrow transfer will be handled by a separate XUMM transaction
    await supabase
      .from('assets')
      .update({
        status: 'pending_sale',
        escrow_status: 'pending',
        listed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Asset prepared for listing. Please sign the escrow transaction to complete.',
        requiresEscrowSignature: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Error listing for sale:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to list asset for sale',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})