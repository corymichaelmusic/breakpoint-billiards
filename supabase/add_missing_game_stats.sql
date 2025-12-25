-- Add missing 9-ball stats and breaker_id to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS is_win_zip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_9_on_snap BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS breaker_id text references public.profiles(id);
