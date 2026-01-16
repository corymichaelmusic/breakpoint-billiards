-- Add match_fee column to leagues table
-- Default is 20 (representing $20 per match)

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS match_fee INTEGER DEFAULT 20;

-- Update any existing sessions to have the default match fee
UPDATE leagues SET match_fee = 20 WHERE match_fee IS NULL AND type = 'session';
