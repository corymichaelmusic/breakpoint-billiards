
-- Add realtime columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS coin_flip_winner_id text REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS current_turn_id text REFERENCES public.profiles(id);
