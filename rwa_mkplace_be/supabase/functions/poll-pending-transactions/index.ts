/**
 * Poll Pending Transactions
 * 
 * Checks all pending escrow transactions and updates their status
 * if they've been completed. This replaces the unreliable webhook system.
 * 
 * Method: GET (can be called by cron job or manually)
 * 
 * Output:
 * {
 *   success: boolean,
 *   processed: number,
 *   updated: number,
 *   details: Array
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

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET)

    // Find all assets with pending escrow transactions
    const { data: pendingEscrowAssets, error: escrowFetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('status', 'pending_escrow')
      .not('escrow_payload_id', 'is', null)

    // Find all assets with pending purchase transactions
    const { data: pendingPurchaseAssets, error: purchaseFetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('status', 'pending_purchase')
      .not('purchase_payload_id', 'is', null)

    if (escrowFetchError || purchaseFetchError) {
      console.error('Error fetching pending assets:', { escrowFetchError, purchaseFetchError })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending transactions' }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const pendingAssets = [...(pendingEscrowAssets || []), ...(pendingPurchaseAssets || [])]

    if (pendingAssets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          updated: 0,
          message: 'No pending transactions to check'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const results = []
    let updatedCount = 0

    // Check each pending transaction
    for (const asset of pendingAssets) {
      try {
        const isEscrow = asset.status === 'pending_escrow'
        const isPurchase = asset.status === 'pending_purchase'
        const payloadId = isEscrow ? asset.escrow_payload_id : asset.purchase_payload_id
        const transactionType = isEscrow ? 'escrow' : 'purchase'
        
        console.log(`Checking ${transactionType} transaction for asset ${asset.name} (${asset.id})`)
        
        // Get XUMM payload status
        const payloadStatus = await xumm.payload.get(payloadId)
        
        const result = {
          assetId: asset.id,
          assetName: asset.name,
          payloadId: payloadId,
          transactionType: transactionType,
          signed: payloadStatus.meta.signed,
          expired: payloadStatus.meta.expired,
          action: 'none'
        }

        if (payloadStatus.meta.signed && payloadStatus.response?.txid) {
          // Transaction was signed
          let updateError = null
          
          if (isEscrow) {
            // Escrow completed - update to for_sale
            const { error } = await supabase
              .from('assets')
              .update({
                status: 'for_sale',
                escrow_status: 'escrowed',
                listed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', asset.id)
            updateError = error
            
            if (!error) {
              console.log(`✅ Updated asset ${asset.name} to for_sale status`)
              result.action = 'updated_to_for_sale'
            }
            
          } else if (isPurchase) {
            // Purchase completed - call auto-transfer to move actual token to buyer
            try {
              const transferResponse = await fetch(`${SUPABASE_URL}/functions/v1/auto-transfer-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({
                  assetId: asset.id,
                  buyerAddress: asset.pending_buyer,
                  txHash: payloadStatus.response.txid
                })
              })
              
              const transferResult = await transferResponse.json()
              
              if (transferResult.success) {
                console.log(`✅ Purchase completed - transferred ${asset.name} token to ${asset.pending_buyer}`)
                result.action = 'purchase_completed'
                result.tokenTransferTxid = transferResult.transactionHash
                // Database update handled by auto-transfer function
                updateError = null
              } else {
                console.error(`Failed to transfer token for ${asset.id}:`, transferResult)
                result.action = 'error'
                result.error = `Token transfer failed: ${transferResult.error}`
                updateError = new Error(transferResult.error)
              }
            } catch (transferError) {
              console.error(`Error calling auto-transfer for ${asset.id}:`, transferError)
              result.action = 'error'  
              result.error = `Token transfer error: ${transferError.message}`
              updateError = transferError
            }
          }

          if (updateError) {
            console.error(`Failed to update asset ${asset.id}:`, updateError)
            result.action = 'error'
            result.error = updateError.message
          } else {
            result.txid = payloadStatus.response.txid
            updatedCount++
          }

        } else if (payloadStatus.meta.expired) {
          // Transaction expired
          let resetError = null
          
          if (isEscrow) {
            // Reset escrow - back to active
            const { error } = await supabase
              .from('assets')
              .update({
                status: 'active',
                escrow_status: null,
                escrow_payload_id: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', asset.id)
            resetError = error
            
            if (!error) {
              console.log(`🔄 Reset expired escrow for asset ${asset.name}`)
              result.action = 'escrow_expired'
            }
            
          } else if (isPurchase) {
            // Purchase expired - back to for_sale
            const { error } = await supabase
              .from('assets')
              .update({
                status: 'for_sale',
                purchase_payload_id: null,
                pending_buyer: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', asset.id)
            resetError = error
            
            if (!error) {
              console.log(`🔄 Reset expired purchase for asset ${asset.name}`)
              result.action = 'purchase_expired'
            }
          }

          if (resetError) {
            console.error(`Failed to reset expired asset ${asset.id}:`, resetError)
            result.action = 'error'
            result.error = resetError.message
          } else {
            updatedCount++
          }
        }

        results.push(result)
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`Error processing asset ${asset.id}:`, error)
        results.push({
          assetId: asset.id,
          assetName: asset.name,
          action: 'error',
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingAssets.length,
        updated: updatedCount,
        details: results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('Error in poll-pending-transactions:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})