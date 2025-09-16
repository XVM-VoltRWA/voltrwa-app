/**
 * XUMM Sign-In Endpoint
 *
 * Creates a sign-in request for XUMM wallet and returns user token after signing
 *
 * Method: POST/GET
 *
 * POST Input:
 * {
 *   wallet_address?: string  // Optional: specific wallet to sign in with
 * }
 *
 * GET Input:
 * ?payload_id=xxx  // Check status and get user token
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import XummService from "../_shared/xumm/index.ts";
import config from "../_shared/config/index.ts";
import type { SignInRequest, SignInResponse, SignInStatusResponse } from "./type.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("xumm-signin: starting function");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET request to check payload status and retrieve user token
  if (req.method === "GET") {
    const payloadId = url.searchParams.get("payload_id");

    if (!payloadId) {
      const errorResponse: SignInStatusResponse = {
        success: false,
        payload_id: "",
        signed: false,
        status: "pending",
        message: "Missing payload_id parameter",
        error: "Missing payload_id parameter"
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!config.XUMM_API_KEY || !config.XUMM_API_SECRET) {
      const errorResponse: SignInStatusResponse = {
        success: false,
        payload_id: payloadId,
        signed: false,
        status: "pending",
        message: "XUMM credentials not configured",
        error: "XUMM credentials not configured"
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const xummService = new XummService(config.XUMM_API_KEY, config.XUMM_API_SECRET);
      const status = await xummService.getPayloadStatus(payloadId);

      const response: SignInStatusResponse = {
        success: true,
        payload_id: payloadId,
        signed: status.signed,
        status: status.resolved ? "resolved" : "pending",
        message: ""
      };

      if (status.signed && status.user_token) {
        response.user_token = status.user_token;
        response.wallet_address = status.wallet_address;
        response.message = "Sign-in successful! Save the user_token for push notifications.";
        response.instructions = "Use the user_token in the xumm_user_token field when calling create-nft-v2 to receive push notifications directly in your XUMM wallet.";
      } else if (status.expired) {
        response.expired = true;
        response.message = "Sign-in request expired. Please create a new sign-in request.";
      } else if (status.cancelled) {
        response.cancelled = true;
        response.message = "Sign-in request was cancelled.";
      } else {
        response.message = "Waiting for sign-in...";
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error checking payload:", error);
      const errorResponse: SignInStatusResponse = {
        success: false,
        payload_id: payloadId,
        signed: false,
        status: "pending",
        message: "Failed to check payload status",
        error: error instanceof Error ? error.message : "Failed to check payload status"
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // POST request to create sign-in payload
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as SignInRequest;
    const { wallet_address } = body;

    if (!config.XUMM_API_KEY || !config.XUMM_API_SECRET) {
      throw new Error("XUMM credentials not configured");
    }

    const xummService = new XummService(config.XUMM_API_KEY, config.XUMM_API_SECRET);
    const payload = await xummService.createSignInPayload(wallet_address);

    const response: SignInResponse = {
      success: true,
      payload_id: payload.uuid,
      qr_code: payload.qrCodeDataUrl,
      deep_link: payload.deepLink,
      message: "Scan the QR code with XUMM to sign in",
      next_step: `After signing, call GET /xumm-signin?payload_id=${payload.uuid} to retrieve your user token`
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating sign-in:", error);
    const errorResponse: SignInResponse = {
      success: false,
      payload_id: "",
      message: "Failed to create sign-in",
      error: error instanceof Error ? error.message : "Failed to create sign-in"
    };
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});