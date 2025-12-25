-- Add innings column to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS innings INT DEFAULT 1;
