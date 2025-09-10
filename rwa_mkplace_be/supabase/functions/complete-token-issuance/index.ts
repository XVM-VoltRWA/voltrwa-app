/**
 * Token Issuance Completion Endpoint
 * 
 * Called when token issuance transaction is completed. Updates the asset
 * status from pending_issuance to active and stores the transaction hash.
 * 
 * Method: POST
 * 
 * Input:
 * {
 *   payloadId: string,    // XUMM payload UUID
 *   txHash: string,       // XRPL transaction hash
 *   assetId?: string      // Optional asset ID for verification
 * }
 * 
 * Output:
 * {
 *   message: string,      // Success message
 *   asset: {}            // Updated asset object
 * }
 * 
 * Error Responses:
 * - 400: Missing required fields
 * - 404: Asset not found
 * - 405: Method not allowed (non-POST requests)  
 * - 500: Database error
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
    const { payloadId, txHash, assetId } = await req.json()

    if (!payloadId || !txHash) {
      return new Response(
        JSON.stringify({ error: 'payloadId and txHash are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find the asset by payload ID
    let query = supabase
      .from('assets')
      .select('*')
      .eq('issuance_payload_id', payloadId)

    if (assetId) {
      query = query.eq('id', assetId)
    }

    const { data: asset, error: fetchError } = await query.single()

    if (fetchError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Asset not found for this payload' }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Update asset to completed status with token issuance details
    const { data: updatedAsset, error: updateError } = await supabase
      .from('assets')
      .update({
        status: 'active',
        issuance_status: 'completed',
        issuance_tx_hash: txHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', asset.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
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
        message: 'Token issuance completed successfully',
        asset: updatedAsset
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error completing token issuance:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})