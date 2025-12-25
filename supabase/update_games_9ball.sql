-- Add 9-ball specific columns to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS is_win_zip boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_9_on_snap boolean DEFAULT false;
