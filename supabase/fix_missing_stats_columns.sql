-- Fix missing columns in profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS breakpoint_rating DOUBLE PRECISION DEFAULT 500.0;

-- Fix missing columns in league_players
ALTER TABLE public.league_players 
ADD COLUMN IF NOT EXISTS breakpoint_rating DOUBLE PRECISION DEFAULT 500.0,
ADD COLUMN IF NOT EXISTS breakpoint_confidence DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS breakpoint_racks_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS breakpoint_racks_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS breakpoint_racks_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS matches_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS matches_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shutouts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_break_and_runs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rack_and_runs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_nine_on_snap INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_early_8 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_break_and_runs_8ball INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_break_and_runs_9ball INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rack_and_runs_8ball INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rack_and_runs_9ball INTEGER DEFAULT 0;

-- Backfill profile ratings from fargo_rating if they are still using default
UPDATE public.profiles 
SET breakpoint_rating = COALESCE(fargo_rating, 500.0)
WHERE breakpoint_rating = 500.0 AND fargo_rating IS NOT NULL;
