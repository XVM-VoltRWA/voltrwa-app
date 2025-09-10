/**
 * Purchase Asset from Escrow
 * 
 * Handles the complete purchase flow:
 * 1. Buyer pays XRP to seller
 * 2. Backend automatically transfers token from escrow to buyer
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,      // UUID of the asset to purchase
 *   buyerAddress: string  // Wallet address of the buyer
 * }
 * 
 * Output:
 * {
 *   payloadId: string,    // XUMM payload UUID for XRP payment
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
    const { assetId, buyerAddress } = await req.json()

    if (!assetId || !buyerAddress) {
      return new Response(
        JSON.stringify({ error: 'assetId and buyerAddress are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get asset details and verify it's in escrow
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('status', 'for_sale')  // Must be listed for sale
      .eq('escrow_status', 'escrowed')  // Must be in escrow
      .single()

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Asset not found, not for sale, or not in escrow' }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)

    // Create payment transaction - buyer pays XRP to seller
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Account: buyerAddress,  // Buyer's wallet
        Destination: asset.seller_address,  // Original seller gets the XRP
        Amount: String(Math.floor(Number(asset.price_xrp) * 1000000)), // XRP in drops
        Memos: [{
          Memo: {
            MemoType: new TextEncoder().encode('rwa_purchase').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
            MemoData: new TextEncoder().encode(`Purchase: ${asset.name} | ID: ${assetId}`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
          }
        }]
      },
      options: { 
        submit: true, 
        expire: 900,
        return_url: {
          web: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'}/purchase-complete?assetId=${assetId}`
        },
        webhook: {
          url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/purchase-webhook`,
          data: {
            assetId: assetId,
            buyerAddress: buyerAddress,
            type: 'purchase'
          }
        }
      }
    })

    // Update asset status to pending purchase
    await supabase
      .from('assets')
      .update({
        status: 'pending_purchase',
        purchase_payload_id: payload.uuid,
        pending_buyer: buyerAddress,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)

    const qrCodeDataUrl = await QRCode.toDataURL(`https://xumm.app/sign/${payload.uuid}`)

    return new Response(
      JSON.stringify({
        payloadId: payload.uuid,
        qrCode: qrCodeDataUrl,
        deepLink: `https://xumm.app/sign/${payload.uuid}`,
        message: `Pay ${asset.price_xrp} XRP to purchase ${asset.name}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error creating purchase transaction:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create purchase transaction' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})