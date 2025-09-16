import type { TransactionMetadataBase } from "npm:xrpl@4.4.1";

/**
 * Result returned from a successful NFT mint operation.
 * - nftTokenId: the issued NFToken ID (usually a hex/string identifier)
 * - txHash: the transaction hash for the mint on the ledger
 * - meta: any raw metadata returned from the xrpl library / transaction metadata
 */
export type MintResult = {
    nftTokenId: string;
    txHash: string;
    meta: unknown;
};

/**
 * Options used when minting an NFToken.
 * - name: human-friendly name for the NFT
 * - imageUrl: URL pointing to the NFT image
 * - metadata: arbitrary additional metadata stored/linked with the token
 * - flags/taxon/transferFee: optional XRPL-specific minting parameters
 */
export type MintOptions = {
    name: string;
    imageUrl: string;
    metadata?: Record<string, unknown>;
    flags?: number;
    taxon?: number;
    transferFee?: number;
};

/**
 * Partial shape of NFToken mint transaction metadata returned by XRPL.
 * Extends the xrpl TransactionMetadataBase and includes optional fields
 * that some mint responses populate (names follow XRPL naming).
 */
export interface NFTokenMintMetadata extends TransactionMetadataBase {
    nftoken_id?: string
    offer_id?: string
}

/**
 * Options when creating an offer to transfer/sell an NFToken.
 * - amount: if present, this becomes a sell offer for that amount (string to match XRPL format)
 * - flags: optional XRPL flags for the offer (e.g., tfSellToken)
 */
export type OfferOptions = {
    amount?: string; // default: "0"
    // if set, offer = sell offer
    // if not, offer = buy offer
    flags?: number;
};

/**
 * Result information after creating a transfer/sell/buy offer for an NFToken.
 * - transferTxHash: transaction hash that created the offer (if available)
 * - offerIndex: the ledger offer index/id (string) used to accept the offer later
 */
export type OfferResult = {
    transferTxHash?: string;
    offerIndex?: string;
};

/**
 * Compact representation of a sell offer stored/returned by helpers.
 * - amount: optional string amount for sell offers
 * - destination: optional recipient address
 * - nft_offer_index: ledger index for the offer
 */
export type SellOffer = { amount?: string; destination?: string; nft_offer_index?: string };