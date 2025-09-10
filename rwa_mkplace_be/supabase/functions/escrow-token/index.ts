/**
 * Escrow Token for Sale
 * 
 * Creates a XUMM transaction for the seller to transfer their token 
 * to the backend wallet (escrow) to list it for sale.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string       // UUID of the asset to escrow
 * }
 * 
 * Output:
 * {
 *   payloadId: string,    // XUMM payload UUID
 *   qrCode: string,       // QR code for signing
 *   deepLink: string      // XUMM deep link
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { XummSdk } from 'npm:xumm-sdk@1.11.2'
import QRCode from 'npm:qrcode@1.5.3'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const XUMM_API_KEY = Deno.env.get('XUMM_API_KEY')!
const XUMM_API_SECRET = Deno.env.get('XUMM_API_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BACKEND_WALLET_ADDRESS = Deno.env.get('BACKEND_WALLET_ADDRESS')!

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
    const { assetId } = await req.json()

    if (!assetId) {
      return new Response(
        JSON.stringify({ error: 'assetId is required' }),
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
      .eq('status', 'active')
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

    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)

    // Create escrow transaction - seller sends token to backend wallet
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Account: asset.owner_address,  // Seller's wallet
        Destination: BACKEND_WALLET_ADDRESS,  // Backend escrow wallet
        Amount: {
          currency: asset.token_currency,
          issuer: asset.token_issuer,  // Backend wallet is issuer
          value: "1"  // Always 1 for RWA
        },
        Memos: [{
          Memo: {
            MemoType: new TextEncoder().encode('rwa_escrow').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
            MemoData: new TextEncoder().encode(`Escrow for sale: ${asset.name} | ID: ${assetId}`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
          }
        }]
      },
      options: { 
        submit: true, 
        expire: 900,
        return_url: {
          web: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'}/escrow-complete?assetId=${assetId}`
        }
      }
    })

    // Update asset status to pending escrow
    await supabase
      .from('assets')
      .update({
        status: 'pending_escrow',
        escrow_payload_id: payload.uuid,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)

    const qrCodeDataUrl = await QRCode.toDataURL(`https://xumm.app/sign/${payload.uuid}`)

    return new Response(
      JSON.stringify({
        payloadId: payload.uuid,
        qrCode: qrCodeDataUrl,
        deepLink: `https://xumm.app/sign/${payload.uuid}`,
        message: `Sign to transfer ${asset.name} to escrow for listing`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error creating escrow transaction:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create escrow transaction' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})