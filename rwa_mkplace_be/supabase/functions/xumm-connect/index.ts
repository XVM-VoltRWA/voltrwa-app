/**
 * XUMM Wallet Connection Endpoint
 * 
 * Creates a wallet connection QR code for users to connect their XRP wallet through XUMM.
 * This endpoint generates a SignIn transaction that users can scan and sign to authenticate.
 * 
 * Method: POST
 * 
 * Input: {} (empty object)
 * 
 * Output:
 * {
 *   payloadId: string,    // XUMM payload UUID for status tracking
 *   qrCode: string,       // Base64 data URL of QR code image
 *   deepLink: string      // Direct XUMM app link
 * }
 * 
 * Error Responses:
 * - 405: Method not allowed (non-POST requests)
 * - 500: Failed to create wallet connection
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { XummSdk } from 'npm:xumm-sdk@1.11.2'
import QRCode from 'npm:qrcode@1.5.3'

const XUMM_API_KEY = Deno.env.get('XUMM_API_KEY')!
const XUMM_API_SECRET = Deno.env.get('XUMM_API_SECRET')!

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
    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)

    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' },
      options: { submit: false, expire: 300 }
    })

    const qrCodeDataUrl = await QRCode.toDataURL(`https://xumm.app/sign/${payload.uuid}`)

    return new Response(
      JSON.stringify({
        payloadId: payload.uuid,
        qrCode: qrCodeDataUrl,
        deepLink: `https://xumm.app/sign/${payload.uuid}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error creating XUMM payload:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create wallet connection' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})