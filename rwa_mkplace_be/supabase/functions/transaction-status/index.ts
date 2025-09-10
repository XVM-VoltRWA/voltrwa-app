/**
 * Transaction Status Endpoint
 * 
 * Enhanced status checking for XUMM transactions with asset purchase context.
 * Provides detailed transaction information including asset-specific data.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   payloadId: string     // XUMM payload UUID to check status for
 * }
 * 
 * Output:
 * {
 *   signed: boolean,        // Whether transaction was signed
 *   expired: boolean,       // Whether payload has expired
 *   cancelled: boolean,     // Whether user cancelled the transaction
 *   resolved: boolean,      // Whether payload is fully resolved
 *   account: string | null, // User's XRP wallet address (if signed)
 *   txid: string | null,    // XRPL transaction hash (if successful)
 *   assetId?: string,       // Asset UUID (if asset purchase transaction)
 *   assetStatus?: string    // Current status of the asset (if applicable)
 * }
 * 
 * Error Responses:
 * - 400: payloadId is required
 * - 405: Method not allowed (non-POST requests)
 * - 500: Failed to check transaction status
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { XummSdk } from 'npm:xumm-sdk@1.11.2'
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

    const response = {
      signed: payload.meta.signed,
      expired: payload.meta.expired,
      cancelled: payload.meta.cancelled,
      resolved: payload.meta.resolved,
      account: payload.response.account || null,
      txid: payload.response.txid || null
    }

    if (payload.meta.signed && payload.response.txid) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      
      const memos = payload.response.dispatched_result?.Memos
      let assetId = null

      if (memos && memos.length > 0) {
        for (const memo of memos) {
          if (memo.Memo?.MemoType) {
            const memoType = Buffer.from(memo.Memo.MemoType, 'hex').toString('utf8')
            if (memoType === 'asset_purchase' && memo.Memo.MemoData) {
              assetId = Buffer.from(memo.Memo.MemoData, 'hex').toString('utf8')
              break
            }
          }
        }
      }

      if (assetId) {
        const { data: asset } = await supabase
          .from('assets')
          .select('status')
          .eq('id', assetId)
          .single()

        response.assetId = assetId
        response.assetStatus = asset?.status || 'unknown'
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error checking transaction status:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to check transaction status' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})