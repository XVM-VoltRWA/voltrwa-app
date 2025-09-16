// Centralized environment/config helper for Supabase functions
// Exposes common env vars and helpers for network URLs and explorers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export type EnvConfig = {
    BACKEND_WALLET_SEED: string | undefined;
    BACKEND_WALLET_ADDRESS: string | undefined;
    NETWORK: string;
    XUMM_API_KEY: string | undefined;
    XUMM_API_SECRET: string | undefined;
};

const cfg: EnvConfig = {
    BACKEND_WALLET_SEED: Deno.env.get("BACKEND_WALLET_SEED") ?? undefined,
    BACKEND_WALLET_ADDRESS: Deno.env.get("BACKEND_WALLET_ADDRESS") ?? undefined,
    NETWORK: Deno.env.get("NETWORK") ?? "testnet",
    XUMM_API_KEY: Deno.env.get("XUMM_API_KEY") ?? undefined,
    XUMM_API_SECRET: Deno.env.get("XUMM_API_SECRET") ?? undefined,
};

export function getNetworkUrl(network = cfg.NETWORK) {
    return network === "mainnet"
        ? "wss://xrplcluster.com"
        : "wss://s.altnet.rippletest.net:51233";
}

export function getExplorerBase(network = cfg.NETWORK) {
    return network === "mainnet" ? "https://livenet.xrpl.org" : "https://testnet.xrpl.org";
}

export default cfg;
