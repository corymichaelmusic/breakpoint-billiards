
-- Add financial and handicap settings to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS is_handicapped BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS entry_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS green_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS money_added NUMERIC DEFAULT 0;
