export type SignInRequest = {
    wallet_address?: string;
};

export type SignInResponse = {
    success: boolean;
    payload_id: string;
    qr_code?: string;
    deep_link?: string;
    message: string;
    next_step?: string;
    webhook_url?: string;
    expires_at?: string;
    error?: string;
};

export type SignInStatusResponse = {
    success: boolean;
    payload_id: string;
    signed: boolean;
    status: "resolved" | "pending";
    user_token?: string;
    wallet_address?: string;
    message: string;
    instructions?: string;
    expired?: boolean;
    cancelled?: boolean;
    error?: string;
};