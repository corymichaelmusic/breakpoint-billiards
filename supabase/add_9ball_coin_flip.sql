
-- Add 9-ball coin flip winner column
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS coin_flip_winner_id_9ball text;
