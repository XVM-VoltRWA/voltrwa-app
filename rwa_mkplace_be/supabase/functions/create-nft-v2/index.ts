// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client, Wallet } from "npm:xrpl@4.4.0";
import NftService from "../_shared/nft/service.ts";
import config from "../_shared/config/index.ts";
import { getExplorerBase, getNetworkUrl } from "../_shared/config/index.ts";
import type {
  CreateNftRequest,
  CreateNftResponse,
  OfferAcceptance,
} from "./type.ts";
import XummService from "../_shared/xumm/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("create-nft-v2: starting function");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // typed input
  const body = (await req.json()) as CreateNftRequest;
  const { name, image_url, metadata, owner_address, xumm_user_token } = body;
  if (!name || !image_url) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: name, image_url" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!config.BACKEND_WALLET_SEED)
    throw new Error("Backend wallet seed not configured");
  if (!config.XUMM_API_KEY)
    throw new Error(
      "XUMM API key/secret not configured; skipping XUMM payload creation"
    );

  if (!config.XUMM_API_SECRET)
    throw new Error(
      "XUMM API key/secret not configured; skipping XUMM payload creation"
    );

  const client = new Client(getNetworkUrl(config.NETWORK));
  await client.connect();
  const backendWallet = Wallet.fromSeed(config.BACKEND_WALLET_SEED);
  const nftService = new NftService(client, backendWallet);
  const xummService = new XummService(
    config.XUMM_API_KEY,
    config.XUMM_API_SECRET
  );

  try {
    // Mint using shared service
    const mintResult = await nftService.mintNft(backendWallet, {
      name,
      imageUrl: image_url,
      metadata: metadata || {},
    });

    const response: CreateNftResponse = {
      success: true,
      nft_token_id: mintResult.nftTokenId,
      mint_transaction_hash: mintResult.txHash,
      mint_explorer_link: `${getExplorerBase(config.NETWORK)}/transactions/${
        mintResult.txHash
      }`,
      network: config.NETWORK,
      minter_address: backendWallet.address,
    };

    // If owner_address provided, create a transfer offer and optionally build XUMM payload (edge handles XUMM SDK/QR)
    if (owner_address) {
      const giveNftToCreatorResult = await nftService.giveNftToCreator(
        mintResult.nftTokenId,
        owner_address,
        { amount: "0", flags: 1 },
        backendWallet
      );
      if (giveNftToCreatorResult) {
        response.transfer_offer_hash = giveNftToCreatorResult.transferTxHash;
        response.offer_index = giveNftToCreatorResult.offerIndex;
      }

      // If we have offer index and XUMM credentials in config, create a XUMM payload and QR here
      if (
        giveNftToCreatorResult &&
        giveNftToCreatorResult.offerIndex &&
        config.XUMM_API_KEY &&
        config.XUMM_API_SECRET
      ) {
        try {
          const payload = await xummService.createXummPayload(
            {
              TransactionType: "NFTokenAcceptOffer",
              Account: owner_address,
              NFTokenSellOffer: giveNftToCreatorResult.offerIndex,
            },
            600,
            xumm_user_token
          );

          if (payload) {
            const acceptance: OfferAcceptance = {
              payload_id: payload.uuid,
              deep_link: payload.deepLink,
              qr_code: payload.qrCodeDataUrl,
              offer_index: giveNftToCreatorResult.offerIndex,
              pushed: payload.pushed,
              instruction: payload.pushed
                ? "A notification has been sent to your XUMM wallet. Please accept the NFT transfer."
                : "Scan this QR code with XUMM to accept the NFT transfer",
            };
            response.acceptance = acceptance;
            response.message = payload.pushed
              ? "NFT minted! Check your XUMM wallet to accept the transfer."
              : "NFT minted! Scan the QR code to accept the transfer to your wallet.";
          }
        } catch (err) {
          console.error("Failed to create XUMM payload:", err);
          response.message =
            "NFT minted and transfer offer created. Could not prepare XUMM payload.";
        }
      } else if (
        giveNftToCreatorResult &&
        giveNftToCreatorResult.transferTxHash
      ) {
        response.message =
          "NFT minted and transfer offer created. Accept the offer in XUMM manually.";
        response.manual_acceptance = {
          offer_index: giveNftToCreatorResult.offerIndex,
          instruction:
            "Open XUMM and look for pending NFT offers to accept this transfer",
        };
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-nft error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } finally {
    client.disconnect();
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-nft-v2' \
 --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
 --header 'Content-Type: application/json' \
 --data '{
"name": "My NFT Name",
"image_url": "https://example.com/image.png",
"metadata": { "note": "mint test" },
"owner_address": "rpwDs3p5SgW6MZn5WJUsS4Cu7VX8a6uQ2D" 
}'

owner_address: should not be backend wallet

*/
