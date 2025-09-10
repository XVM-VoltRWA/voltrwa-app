/**
 * Mint Token to Holder Wallet
 * 
 * Creates and sends the RWA token to a designated holder wallet so the asset creator
 * can see the token in a wallet. This is useful for portfolio tracking and verification.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,        // UUID of the asset
 *   holderAddress: string   // Wallet address to receive the token (can be same as issuer)
 * }
 * 
 * Output:
 * {
 *   payloadId: string,      // XUMM payload UUID
 *   qrCode: string,         // QR code for signing
 *   deepLink: string        // XUMM deep link
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

    // Create transaction to mint token to holder wallet
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: 'Payment',
        Destination: holderAddress,
        Amount: {
          currency: asset.token_currency,
          issuer: asset.token_issuer,
          value: "1"  // Always 1 for RWA
        },
        Memos: [{
          Memo: {
            MemoType: new TextEncoder().encode('rwa_token_mint').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
            MemoData: new TextEncoder().encode(`Mint: ${asset.name} | ID: ${assetId}`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
          }
        }]
      },
      options: { 
        submit: true, 
        expire: 900,
        return_url: {
          web: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'}/token-minted?assetId=${assetId}`
        }
      }
    })

    const qrCodeDataUrl = await QRCode.toDataURL(`https://xumm.app/sign/${payload.uuid}`)

    return new Response(
      JSON.stringify({
        payloadId: payload.uuid,
        qrCode: qrCodeDataUrl,
        deepLink: `https://xumm.app/sign/${payload.uuid}`,
        message: `Sign to mint ${asset.name} token to holder wallet`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error creating mint transaction:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create mint transaction' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})