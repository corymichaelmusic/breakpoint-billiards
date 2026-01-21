
-- Add scoped verification columns for 8-ball
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS p1_verified_8ball BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS p2_verified_8ball BOOLEAN DEFAULT FALSE;

-- Add scoped verification columns for 9-ball
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS p1_verified_9ball BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS p2_verified_9ball BOOLEAN DEFAULT FALSE;

-- Optional: Copy existing verification status to correct columns if needed
-- Assuming currently running matches might be in a weird state, better to start fresh or let them verify again.
-- However, if we want to be nice:
-- UPDATE public.matches SET p1_verified_8ball = p1_verified, p2_verified_8ball = p2_verified WHERE game_type_preference = '8ball' OR (points_8ball_p1 > 0 OR points_8ball_p2 > 0);
-- UPDATE public.matches SET p1_verified_9ball = p1_verified, p2_verified_9ball = p2_verified WHERE game_type_preference = '9ball' OR (points_9ball_p1 > 0 OR points_9ball_p2 > 0);
