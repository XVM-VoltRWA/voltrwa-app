/**
 * Asset Creation Endpoint
 * 
 * Creates a new RWA (Real World Asset) listing in the marketplace.
 * Validates input data and stores the asset in the database with 'active' status.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   name: string,           // Asset name (required)
 *   description?: string,   // Asset description (optional)
 *   price_xrp: number,     // Price in XRP (required, must be > 0)
 *   token_currency: string, // 3-letter currency code (required)
 *   token_issuer: string,   // XRP address of token issuer (required)
 *   seller_address: string, // XRP address of seller (required)
 *   image_url?: string     // URL to asset image (optional)
 * }
 * 
 * Output:
 * {
 *   message: string,       // Success message
 *   asset: {              // Created asset object with all fields + UUID
 *     id: string,
 *     name: string,
 *     description: string | null,
 *     price_xrp: number,
 *     token_currency: string,
 *     token_issuer: string,
 *     seller_address: string,
 *     owner_address: string,
 *     image_url: string | null,
 *     status: "active",
 *     created_at: string,
 *     updated_at: string
 *   }
 * }
 * 
 * Error Responses:
 * - 400: Missing required fields or invalid data
 * - 405: Method not allowed (non-POST requests)
 * - 500: Database error
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { XummSdk } from 'npm:xumm-sdk@1.11.2'
import QRCode from 'npm:qrcode@1.5.3'
import xrpl from 'npm:xrpl@2.7.0'
const { Client, Wallet } = xrpl

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const XUMM_API_KEY = Deno.env.get('XUMM_API_KEY')!
const XUMM_API_SECRET = Deno.env.get('XUMM_API_SECRET')!
const BACKEND_WALLET_ADDRESS = Deno.env.get('BACKEND_WALLET_ADDRESS')!
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
    const { 
      name, 
      description, 
      price_xrp, 
      token_currency, 
      seller_address, 
      image_url 
    } = await req.json()
    
    // RWA assets always have exactly 1 token (representing unique ownership)
    const token_amount = '1'
    // Backend wallet is always the token issuer
    const token_issuer = BACKEND_WALLET_ADDRESS

    if (!name || !price_xrp || !token_currency || !seller_address) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: name, price_xrp, token_currency, seller_address' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    if (Number(price_xrp) <= 0) {
      return new Response(
        JSON.stringify({ error: 'price_xrp must be greater than 0' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    if (token_currency.length !== 3) {
      return new Response(
        JSON.stringify({ error: 'token_currency must be 3 characters' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: asset, error } = await supabase
      .from('assets')
      .insert({
        name,
        description: description || null,
        price_xrp: Number(price_xrp),
        token_currency: token_currency.toUpperCase(),
        token_issuer,
        seller_address,
        owner_address: seller_address,
        image_url: image_url || null,
        status: 'active',
        token_amount: 1,
        issuance_status: 'pending',
        issuance_payload_id: null,
        issuance_tx_hash: null
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create asset' }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    await supabase.from('user_profiles').upsert({
      wallet_address: seller_address,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'wallet_address'
    })

    // Don't mint immediately - wait for trust line
    await supabase
      .from('assets')
      .update({
        issuance_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', asset.id)

    return new Response(
      JSON.stringify({ 
        message: 'Asset created successfully! Please click "Add to Wallet" to create a trust line, then the token will be minted to you.',
        asset: { ...asset, issuance_status: 'pending' },
        requiresTrustLine: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error creating asset:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})