-- Add bounty_val_shutout column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leagues' AND column_name = 'bounty_val_shutout') THEN
        ALTER TABLE leagues ADD COLUMN bounty_val_shutout numeric DEFAULT 1;
    END IF;
END $$;
