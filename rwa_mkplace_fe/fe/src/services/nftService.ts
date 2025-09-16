const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:54321/functions/v1";

export interface NFTMetadata {
  external_link?: string;
  description: string;
  category?: string;
  properties?: Record<string, string>;
  valuation?: number;
}

export interface CreateNFTRequest {
  name: string;
  image_url: string;
  owner_address: string;
  metadata: NFTMetadata;
}

export interface CreateNFTResponse {
  success: boolean;
  nft_token_id?: string;
  mint_transaction_hash?: string;
  mint_explorer_link?: string;
  transfer_offer_hash?: string;
  transfer_offer_link?: string;
  transfer_status?: string;
  network?: string;
  minter_address?: string;
  owner_address?: string;
  acceptance?: {
    qr_code: string;
    deep_link: string;
    payload_id: string;
    offer_index: string;
    instruction: string;
  };
  manual_acceptance?: {
    offer_index: string;
    instruction: string;
  };
  message?: string;
  error?: string;
}

export const createNFT = async (request: CreateNFTRequest): Promise<CreateNFTResponse> => {
  const response = await fetch(`${API_BASE_URL}/create-nft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const nftService = {
  createNFT,
};
