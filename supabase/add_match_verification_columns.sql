
-- Add verification columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS p1_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS p2_verified boolean DEFAULT false;
