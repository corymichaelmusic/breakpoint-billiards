-- Add a notes column to matches for internal record-keeping
-- This column is not read by any UI code
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS notes text;
