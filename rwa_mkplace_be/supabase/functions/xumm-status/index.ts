/**
 * XUMM Connection Status Endpoint
 * 
 * Checks the status of a wallet connection payload to determine if the user has signed in.
 * Used for polling to detect when a user completes the wallet connection process.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   payloadId: string     // XUMM payload UUID from xumm-connect
 * }
 * 
 * Output:
 * {
 *   signed: boolean,      // Whether the user has signed the transaction
 *   account?: string      // User's XRP wallet address (if signed)
 * }
 * 
 * Error Responses:
 * - 400: payloadId is required
 * - 405: Method not allowed (non-POST requests)  
 * - 500: Failed to check connection status
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { XummSdk } from 'npm:xumm-sdk@1.11.2'

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
    const { payloadId } = await req.json()

    if (!payloadId) {
      return new Response(
        JSON.stringify({ error: 'payloadId is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)
    const payload = await xumm.payload.get(payloadId)

    if (payload.meta.signed) {
      return new Response(
        JSON.stringify({
          signed: true,
          account: payload.response.account
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } else {
      return new Response(
        JSON.stringify({
          signed: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
  } catch (error) {
    console.error('Error checking XUMM payload status:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to check connection status' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})