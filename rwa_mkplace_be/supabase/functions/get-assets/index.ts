/**
 * Asset Listing Endpoint
 * 
 * Retrieves paginated asset listings from the marketplace with optional filtering.
 * Supports filtering by status and owner, with seller profile information included.
 * 
 * Method: GET
 * 
 * Query Parameters:
 * - status: string (optional, default: 'active') // Asset status filter
 * - owner: string (optional) // Filter by owner wallet address
 * - limit: number (optional, default: 50) // Maximum number of results
 * - offset: number (optional, default: 0) // Pagination offset
 * 
 * Output:
 * {
 *   assets: {                  // Array of asset objects
 *     id: string,
 *     name: string,
 *     description: string | null,
 *     price_xrp: number,
 *     token_currency: string,
 *     token_issuer: string,
 *     seller_address: string,
 *     owner_address: string,
 *     image_url: string | null,
 *     status: string,
 *     created_at: string,
 *     updated_at: string,
 *     user_profiles: {         // Seller profile information
 *       name?: string,
 *       avatar_url?: string
 *     } | null
 *   }[],
 *   total: number | null,      // Total count of matching assets
 *   limit: number,             // Applied limit
 *   offset: number             // Applied offset
 * }
 * 
 * Error Responses:
 * - 405: Method not allowed (non-GET requests)
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

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }

  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'active'
    const owner = url.searchParams.get('owner')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let query = supabase
      .from('assets')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (owner) {
      query = query.eq('owner_address', owner)
    }

    const { data: assets, error, count } = await query

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        assets: assets || [],
        total: count,
        limit,
        offset
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error fetching assets:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch assets' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})