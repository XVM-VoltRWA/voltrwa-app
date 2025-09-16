/**
 * Result returned from creating a XUMM payload.
 * - uuid: payload identifier used by XUMM APIs
 * - deepLink: URL that opens the payload in XUMM mobile app
 * - qrCodeDataUrl: data URL containing a PNG/svg QR code for the payload
 * - pushed: indicates if the payload was pushed to the user's XUMM app
 */
export type XummPayloadResult = {
    uuid: string;
    deepLink: string;
    qrCodeDataUrl: string;
    pushed?: boolean;
};

/**
 * Body shape sent to XUMM when creating a payload.
 * - txjson: XRPL transaction JSON describing the action (e.g., NFTokenAcceptOffer)
 * - options: optional XUMM payload options (submit immediately, expiration seconds)
 */
export type XummPayloadBody = {
    txjson: Record<string, unknown>;
    options?: { submit?: boolean; expire?: number };
};

const XummTxTypes = [
    'SignIn',
    'PaymentChannelAuthorize'
] as const

const XrplTxTypes = [
    'AccountDelete',
    'AccountSet',
    'CheckCancel',
    'CheckCash',
    'CheckCreate',
    'ClaimReward',
    'DepositPreauth',
    'EscrowCancel',
    'EscrowCreate',
    'EscrowFinish',
    'Import',
    'Invoke',
    'NFTokenAcceptOffer',
    'NFTokenBurn',
    'NFTokenCancelOffer',
    'NFTokenCreateOffer',
    'NFTokenMint',
    'OfferCancel',
    'OfferCreate',
    'Payment',
    'PaymentChannelClaim',
    'PaymentChannelCreate',
    'PaymentChannelFund',
    'Remit',
    'SetHook',
    'SetRegularKey',
    'SignerListSet',
    'TicketCreate',
    'TrustSet',
    'URITokenBurn',
    'URITokenBuy',
    'URITokenCancelSellOffer',
    'URITokenCreateSellOffer',
    'URITokenMint'
] as const

export type XummTransactionType = typeof XummTxTypes[number]
export type XrplTransactionType = typeof XrplTxTypes[number]

export interface XummJsonTransaction extends Record<string, unknown> {
    TransactionType: XummTransactionType | XrplTransactionType
}

/**
 * Sign-in specific payload structure
 */
export interface XummSignInPayload {
    txjson: {
        TransactionType: "SignIn";
        Account?: string;
    };
    options?: {
        submit?: boolean;
        expire?: number;
    };
}

/**
 * Payload status response structure
 */
export interface XummPayloadStatus {
    signed: boolean;
    resolved: boolean;
    expired?: boolean;
    cancelled?: boolean;
    user_token?: string;
    wallet_address?: string;
}