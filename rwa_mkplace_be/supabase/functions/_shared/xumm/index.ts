/**
 * Lightweight XUMM helper that builds payload bodies for XUMM SDK.
 * We avoid taking a direct dependency on the SDK or QR code generation here so
 * callers can decide how/where to execute the SDK call (honoring environment limits).
 *
 * */
import { XummSdk } from "npm:xumm-sdk@1.11.2";
import QRCode from "npm:qrcode@1.5.3";
import { XummJsonTransaction, XummPayloadBody, XummPayloadResult, XummSignInPayload, XummPayloadStatus } from "./type.ts";

export class XummService {
    public constructor(private apiKey: string, private apiSecret: string) {
    }
    /**
     * Build a payload body that can be passed to Xumm SDK's payload.create.
     */
    buildXummPayloadBody(txjson: XummJsonTransaction, expireSeconds = 10): XummPayloadBody {
        return { txjson, options: { submit: true, expire: expireSeconds } };
    }

    /**
     * Create a payload using the Xumm SDK and return uuid, deep link and QR code data URL.
     * If userToken is provided, the request will be pushed directly to the user's XUMM app.
     *
     * @param txjson - The transaction JSON to be signed
     * @param expireSeconds - How long the payload should remain valid (default: 10 minutes)
     * @param userToken - Optional XUMM user token for push notifications
     * @returns Payload result with UUID, deep link, QR code, and push status
     */
    async createXummPayload(
        txjson: XummJsonTransaction,
        expireSeconds = 600,
        userToken?: string
    ): Promise<XummPayloadResult> {
        const xumm = new XummSdk(this.apiKey, this.apiSecret);

        // Build payload configuration
        const payloadConfig: XummPayloadBody & { user_token?: string } = {
            txjson: txjson,
            options: {
                submit: true,
                expire: expireSeconds
            }
        };

        // Add user token if provided to enable push notification
        if (userToken) {
            payloadConfig.user_token = userToken;
            console.log("Creating XUMM payload with push notification for user token");
        }

        // @ts-ignore: SDK typing mismatch in this environment; runtime payload body is valid
        const payload = await xumm.payload.create(payloadConfig);
        if (!payload) throw new Error("Failed to create XUMM payload");

        const uuid = payload.uuid;
        const deepLink = `https://xumm.app/sign/${uuid}`;
        const qrCodeDataUrl = await QRCode.toDataURL(deepLink);

        // Check if push notification was sent successfully
        const pushed: boolean = Boolean(payload.pushed);

        if (pushed) {
            console.log(`Push notification sent successfully for payload ${uuid}`);
        }

        return {
            uuid,
            deepLink,
            qrCodeDataUrl,
            pushed
        };
    }

    /**
     * Create a sign-in payload for XUMM authentication.
     * Returns payload details including QR code for user to scan.
     */
    async createSignInPayload(walletAddress?: string): Promise<XummPayloadResult> {
        const xumm = new XummSdk(this.apiKey, this.apiSecret);

        const signInPayload: XummSignInPayload = {
            txjson: {
                TransactionType: "SignIn"
            },
            options: {
                submit: false,
                expire: 600  // 10 minutes
            }
        };

        if (walletAddress) {
            signInPayload.txjson.Account = walletAddress;
        }

        // @ts-ignore: SDK typing mismatch in this environment
        const payload = await xumm.payload.create(signInPayload);
        if (!payload) throw new Error("Failed to create sign-in payload");

        const uuid = payload.uuid;
        const deepLink = `https://xumm.app/sign/${uuid}`;
        const qrCodeDataUrl = await QRCode.toDataURL(deepLink);

        return {
            uuid,
            deepLink,
            qrCodeDataUrl,
            pushed: Boolean(payload.pushed)
        };
    }

    /**
     * Get the status of a XUMM payload and retrieve user token if signed.
     */
    async getPayloadStatus(payloadId: string): Promise<XummPayloadStatus> {
        const xumm = new XummSdk(this.apiKey, this.apiSecret);

        // @ts-ignore: SDK typing mismatch in this environment
        const payload = await xumm.payload.get(payloadId);

        if (!payload) {
            throw new Error("Payload not found");
        }

        return {
            signed: payload.meta.signed,
            resolved: payload.meta.resolved,
            expired: payload.meta.expired,
            cancelled: payload.meta.cancelled,
            user_token: payload.application?.issued_user_token || undefined,
            wallet_address: payload.response?.account || undefined
        };
    }
}

export default XummService;

