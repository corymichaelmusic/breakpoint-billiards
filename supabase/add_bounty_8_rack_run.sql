-- Add bounty_val_8_rack_run column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'leagues'
          AND column_name = 'bounty_val_8_rack_run'
    ) THEN
        ALTER TABLE leagues ADD COLUMN bounty_val_8_rack_run numeric DEFAULT 2;
    END IF;
END $$;

-- Backfill existing rows to preserve the current mobile hardcoded behavior
UPDATE leagues
SET bounty_val_8_rack_run = 2
WHERE bounty_val_8_rack_run IS NULL;
