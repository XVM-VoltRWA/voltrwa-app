import type { Client, TxResponse, Wallet, NFTokenCreateOffer } from "npm:xrpl@4.4.0";
import { NFTokenMint } from "npm:xrpl@4.4.0";
import type { MintResult, MintOptions, NFTokenMintMetadata, OfferOptions, OfferResult } from "./type.ts";
import type { SellOffer } from "./type.ts";

/**
 * NftService - small helper around XRPL NFToken minting.
 *
 * Usage: provide a connected `client` and a `wallet` created from a seed.
 */
export class NftService {
    /**
     * Create a new NftService instance.
     * @param client Connected xrpl Client used to submit requests and transactions.
     * @param backendWallet Wallet used as the default signing wallet when a caller does not provide one.
     */
    constructor(private client: Client, private backendWallet: Wallet) { }

    /**
     * Mint an NFToken with the supplied metadata.
     *
     * This builds the token metadata, encodes it to the XRPL URI hex format,
     * submits an NFTokenMint transaction and waits for validation. If a
     * `wallet` is provided it will be used for signing, otherwise the
     * `backendWallet` supplied to the constructor is used.
     *
     * Errors: throws if the transaction returns no metadata, if the transaction
     * result is not `tesSUCCESS`, or if a NFTokenID cannot be extracted from
     * the transaction metadata.
     *
     * @param wallet Optional wallet to sign the mint transaction. If omitted the service's backendWallet is used.
     * @param opts Mint options (name, imageUrl, optional metadata, flags, taxon, transferFee).
     * @returns Promise resolving to MintResult with nftTokenId, txHash and raw meta.
     */
    async mintNft(
        wallet: Wallet | undefined,
        opts: MintOptions
    ): Promise<MintResult> {
        const { name, imageUrl, metadata = {}, flags = 8, taxon = 0, transferFee = 0 } = opts;

        // Build token metadata object
        const nftMetadata = {
            name,
            image: imageUrl,
            minted_on: new Date().toISOString(),
            ...metadata,
        };

        // Convert metadata JSON to hex URI as required by XRPL
        const metadataString = JSON.stringify(nftMetadata);
        const encoder = new TextEncoder();
        const metadataBytes = encoder.encode(metadataString);
        const metadataHex = Array.from(metadataBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase();

        const useWallet = wallet ?? this.backendWallet;

        const nftMint: NFTokenMint = {
            TransactionType: "NFTokenMint" as const,
            Account: useWallet.address,
            URI: metadataHex,
            Flags: flags,
            NFTokenTaxon: taxon,
            TransferFee: transferFee,
        };

        const mintResponse: TxResponse<NFTokenMint> = await this.client.submitAndWait(nftMint, {
            wallet: useWallet,
            autofill: true,
        });

        const txMeta = mintResponse?.result?.meta;
        if (!txMeta) throw new Error("No metadata returned from mint transaction");
        if (typeof txMeta === "string") throw new Error("Unexpected meta format: string");

        // Check result
        const txResult = txMeta;
        if (txResult.TransactionResult !== "tesSUCCESS") {
            throw new Error(`Mint failed: ${String(txResult)}`);
        }

        const txHash = mintResponse.result.hash as string;

        // Extract token id (robustly)
        const nftTokenId = NftService.extractTokenIdFromMeta(txMeta);
        if (!nftTokenId) throw new Error("Failed to extract NFTokenID from transaction metadata");

        return {
            nftTokenId,
            txHash,
            meta: txMeta,
        };
    }

    /**
     * Create an NFTokenCreateOffer (a sell offer) to transfer or give an NFT to another account.
     *
     * This method submits an NFTokenCreateOffer signed by `wallet` (or the
     * service's backendWallet when omitted) and then attempts to discover the
     * created offer index by polling the ledger via `fetchSellOffers`.
     *
     * Returns an OfferResult on success (transferTxHash and offerIndex) or
     * `null` when the offer could not be found after creation.
     *
     * Errors: throws if the create offer transaction fails or if fetching the
     * offer index encounters an unexpected error.
     *
     * @param nftTokenId NFTokenID to create an offer for.
     * @param destination Destination account for the offer (recipient of the token if accepted).
     * @param opts Offer options (amount, flags).
     * @param wallet Optional wallet to sign the create-offer transaction.
     * @returns Promise resolving to OfferResult or null if no matching offer was discovered.
     */
    async giveNftToCreator(
        nftTokenId: string,
        destination: string,
        opts: OfferOptions = {},
        wallet?: Wallet
    ): Promise<OfferResult | null> {
        // flags always = 1 for sell offer
        const { amount = "0", flags = 1 } = opts;

        const useWallet = wallet ?? this.backendWallet;

        const createSellOffer: NFTokenCreateOffer = {
            TransactionType: "NFTokenCreateOffer",
            Account: useWallet.address,
            NFTokenID: nftTokenId,
            Destination: destination,
            Amount: amount,
            Flags: flags,
        };

        const createSellOfferResponse = await this.client.submit(createSellOffer, {
            wallet: useWallet,
            autofill: true,
        });

        if (createSellOfferResponse.result.engine_result !== "tesSUCCESS") {
            throw new Error("Sell offer creation failed: " + createSellOfferResponse.id + " - " + createSellOfferResponse.result.engine_result);
        }

        try {
            const offers: SellOffer[] = await this.fetchSellOffers(nftTokenId);
            const ourOffer = offers.find((offer) => offer.amount === amount && offer.destination === destination);
            if (ourOffer) {
                return {
                    transferTxHash: createSellOfferResponse.result.tx_json.hash,
                    offerIndex: ourOffer.nft_offer_index,
                };
            }
        } catch (err) {
            throw new Error("Could not fetch offer index: " + String(err));
        }

        return null;
    }

    /**
     *  This attempts to extract the NFTokenID from the transaction metadata in a robust way.
    *
    * The helper scans multiple shapes of transaction metadata (CreatedNode,
    * ModifiedNode, FinalFields/NewFields) to find the new NFToken entry and
    * return its NFTokenID. As a fallback it will search the JSON string for an
    * NFTokenID pattern.
    *
    * @param meta Transaction metadata object returned by the xrpl client.
    * @returns The NFTokenID string when found, otherwise null.
     */
    private static extractTokenIdFromMeta(meta: NFTokenMintMetadata): string | null {
        if (!meta) return null;

        const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

        // Direct field (some xrpl clients expose this)
        if (isRecord(meta)) {
            const nftokenId = meta["nftoken_id"] as unknown;
            if (typeof nftokenId === "string") return nftokenId;
        }

        const nodes = isRecord(meta) && Array.isArray(meta["AffectedNodes"]) ? (meta["AffectedNodes"] as unknown[]) : [];
        for (const wrapper of nodes) {
            if (!isRecord(wrapper)) continue;
            const node = (wrapper["CreatedNode"] ?? wrapper["ModifiedNode"] ?? wrapper["DeletedNode"]);
            if (!isRecord(node)) continue;

            const ledgerType = (node["LedgerEntryType"] ?? node["lf"]) as unknown;
            if (ledgerType === "NFTokenPage") {
                const newFields = isRecord(node["NewFields"]) ? (node["NewFields"] as Record<string, unknown>) : {};
                const finalFields = isRecord(node["FinalFields"]) ? (node["FinalFields"] as Record<string, unknown>) : {};
                const prevFields = isRecord(node["PreviousFields"]) ? (node["PreviousFields"] as Record<string, unknown>) : {};

                const candidates: unknown[] = [];
                if (Array.isArray(newFields["NFTokens"])) candidates.push(...(newFields["NFTokens"] as unknown[]));
                if (Array.isArray(finalFields["NFTokens"])) candidates.push(...(finalFields["NFTokens"] as unknown[]));

                // Created_node: assume first NFT is the new one
                if (isRecord(wrapper["CreatedNode"]) && candidates.length > 0) {
                    const nf = candidates[0];
                    if (isRecord(nf)) {
                        const token = (nf["NFToken"] ?? nf) as unknown;
                        if (isRecord(token)) {
                            const id = token["NFTokenID"] as unknown;
                            if (typeof id === "string") return id;
                        }
                    }
                }

                // Modified_node: find token present in final but not in previous
                if (isRecord(wrapper["ModifiedNode"])) {
                    const prev = Array.isArray(prevFields["NFTokens"]) ? (prevFields["NFTokens"] as unknown[]) : [];
                    const fin = Array.isArray(finalFields["NFTokens"]) ? (finalFields["NFTokens"] as unknown[]) : [];

                    for (const f of fin) {
                        if (!isRecord(f)) continue;
                        const fToken = (f["NFToken"] ?? f) as unknown;
                        if (!isRecord(fToken)) continue;
                        const fId = fToken["NFTokenID"] as unknown;
                        if (typeof fId !== "string") continue;

                        const existed = prev.some((p) => {
                            if (!isRecord(p)) return false;
                            const pToken = (p["NFToken"] ?? p) as unknown;
                            if (!isRecord(pToken)) return false;
                            return pToken["NFTokenID"] === fId;
                        });
                        if (!existed) return fId;
                    }
                }
            }

            // As a fallback, scan node fields for any NFTokenID-like string
            try {
                const saw = JSON.stringify(node);
                const match = saw.match(/"?NFTokenID"?\s*:\s*"([A-Fa-f0-9]+)"/);
                if (match) return match[1];
            } catch (_err) {
                // ignore stringify errors
            }
        }

        return null;
    }

    /**
     * Fetch NFT sell offers for a given NFTokenID using the connected xrpl client.
     *
     * This method calls the `nft_sell_offers` ledger command and returns a
     * simplified array of SellOffer entries (amount, destination, nft_offer_index).
     *
     * It tolerates variations in the XRPL client response shape and returns an
     * empty array if no offers are found. Any unexpected request errors will
     * propagate to the caller.
     *
     * @param nftTokenId The NFTokenID to query sell offers for.
     * @returns Array of SellOffer objects (may be empty).
     */
    public async fetchSellOffers(nftTokenId: string): Promise<SellOffer[]> {
        const sellOffersRequest = { command: "nft_sell_offers", nft_id: nftTokenId } as unknown;
        // attempt request using the xrpl client typing at runtime
        const resp = await (this.client as unknown as { request: (r: unknown) => Promise<unknown> }).request(sellOffersRequest);
        const maybe = resp as unknown as Record<string, unknown>;
        if (maybe && typeof maybe === "object") {
            const inner = maybe["result"] as unknown;
            if (inner && typeof inner === "object") {
                const offersRaw = (inner as Record<string, unknown>)["offers"];
                if (Array.isArray(offersRaw)) return offersRaw as SellOffer[];
            }
        }
        return [];
    }
}

export default NftService;

