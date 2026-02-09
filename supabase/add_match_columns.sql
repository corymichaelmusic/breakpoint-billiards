-- Add missing columns to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS scheduled_time TEXT,
ADD COLUMN IF NOT EXISTS table_name TEXT;
