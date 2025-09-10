/**
 * Fix Escrow Status
 * 
 * Manual function to fix assets stuck in pending_escrow status.
 * Checks if the escrow transaction was actually completed and updates status.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   payloadId: string  // XUMM payload ID to check
 * }
 * 
 * Output:
 * {
 *   success: boolean,
 *   message: string,
 *   updatedAssets: number
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { XummSdk } from 'npm:xumm-sdk@1.11.2'

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)

    // Get the XUMM payload status
    const payloadStatus = await xumm.payload.get(payloadId)
    
    if (!payloadStatus.meta.signed) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Transaction not signed yet'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Find assets with this escrow payload ID that are still pending
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('escrow_payload_id', payloadId)
      .eq('status', 'pending_escrow')

    if (assetsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch assets' }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'No pending escrow assets found for this payload'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Update all matching assets to for_sale status
    const { error: updateError, count } = await supabase
      .from('assets')
      .update({
        status: 'for_sale',
        escrow_status: 'escrowed',
        listed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('escrow_payload_id', payloadId)
      .eq('status', 'pending_escrow')

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update asset status' }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated ${count || 0} asset(s) to for_sale status`,
        updatedAssets: count || 0,
        txid: payloadStatus.response?.txid
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Error fixing escrow status:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})