-- Add escrow and marketplace fields to assets table

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS escrow_status TEXT CHECK (escrow_status IN ('pending', 'escrowed', NULL)),
ADD COLUMN IF NOT EXISTS escrow_payload_id TEXT,
ADD COLUMN IF NOT EXISTS purchase_payload_id TEXT,
ADD COLUMN IF NOT EXISTS pending_buyer TEXT,
ADD COLUMN IF NOT EXISTS listed_at TIMESTAMP WITH TIME ZONE;

-- Update status enum to include new marketplace statuses
ALTER TABLE assets 
DROP CONSTRAINT IF EXISTS assets_status_check;

ALTER TABLE assets 
ADD CONSTRAINT assets_status_check 
CHECK (status IN ('active', 'inactive', 'sold', 'pending_escrow', 'for_sale', 'pending_purchase'));

-- Create index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_assets_marketplace 
ON assets (status, escrow_status, price_xrp);

-- Create index for escrow operations
CREATE INDEX IF NOT EXISTS idx_assets_escrow_payload 
ON assets (escrow_payload_id);

-- Create index for purchase operations  
CREATE INDEX IF NOT EXISTS idx_assets_purchase_payload 
ON assets (purchase_payload_id);