/**
 * Create Trust Line for RWA Token
 * 
 * Creates a trust line transaction that allows a wallet to receive
 * a specific RWA token. This must be done before the token can be sent.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   assetId: string,        // UUID of the asset
 *   holderAddress: string   // Wallet that wants to trust the token
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
      .single()

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Asset not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)

    // Create trust line transaction
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: 'TrustSet',
        LimitAmount: {
          currency: asset.token_currency,
          issuer: asset.token_issuer,
          value: "10"  // Allow up to 10 tokens (in case of multiple assets)
        },
        Memos: [{
          Memo: {
            MemoType: new TextEncoder().encode('rwa_trustline').reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase(),
            MemoData: new TextEncoder().encode(`Trust: ${asset.name} (${asset.token_currency})`).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '').toUpperCase()
          }
        }]
      },
      options: { 
        submit: true, 
        expire: 900,
        return_url: {
          web: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'}/trustline-created?assetId=${assetId}`
        }
      },
      user_token: holderAddress // This will suggest the holder wallet to sign
    })

    const qrCodeDataUrl = await QRCode.toDataURL(`https://xumm.app/sign/${payload.uuid}`)

    return new Response(
      JSON.stringify({
        payloadId: payload.uuid,
        qrCode: qrCodeDataUrl,
        deepLink: `https://xumm.app/sign/${payload.uuid}`,
        message: `Sign to create trust line for ${asset.name} (${asset.token_currency})`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error creating trust line:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create trust line transaction' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})