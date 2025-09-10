-- Fix assets stuck in pending_escrow status
-- Run this to fix assets that completed escrow but didn't get status updated

UPDATE assets 
SET 
  status = 'for_sale',
  escrow_status = 'escrowed',
  listed_at = COALESCE(listed_at, updated_at),
  updated_at = NOW()
WHERE 
  status = 'pending_escrow' 
  AND escrow_payload_id IS NOT NULL
  AND escrow_payload_id != '';

-- Check the results
SELECT id, name, status, escrow_status, listed_at 
FROM assets 
WHERE status = 'for_sale' AND escrow_status = 'escrowed';