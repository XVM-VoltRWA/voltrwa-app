export type CreateNftRequest = {
    name: string;
    image_url: string;
    metadata?: Record<string, unknown>;
    // optional destination address to create a transfer offer for after minting
    owner_address?: string;
    // optional XUMM user token for push notifications (obtained from previous XUMM sign-in)
    xumm_user_token?: string;
};

export type OfferAcceptance = {
    payload_id?: string;
    deep_link?: string;
    qr_code?: string;
    offer_index?: string | null;
    instruction?: string;
    pushed?: boolean;  // indicates if payload was pushed to user's XUMM app
};

export type CreateNftResponse = {
    success: boolean;
    // Mint tx related
    nft_token_id?: string;
    mint_transaction_hash?: string;
    mint_explorer_link?: string;
    network?: string;
    minter_address?: string;

    // Give to creator related (sell offer with 0)
    // for transfer nft to creator
    transfer_offer_hash?: string;
    // index of the sell offer, if any
    offer_index?: string;

    // XUMM QR code and payload to accept the offer, if created
    acceptance?: OfferAcceptance;
    manual_acceptance?: { offer_index?: string | null; instruction?: string };

    // human readable message or error
    message?: string;
    error?: string;
};

// Helper type for the handler function contract
export type CreateNftHandler = (input: CreateNftRequest) => Promise<CreateNftResponse>;

