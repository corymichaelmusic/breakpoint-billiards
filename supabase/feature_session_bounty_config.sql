-- Add Bounty Config to Leagues (Session)
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS bounty_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bounty_val_8_run integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS bounty_val_9_run integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS bounty_val_9_snap integer DEFAULT 1;

-- Backfill: Enable for all currently ACTIVE sessions to maintain existing behavior for test users
UPDATE public.leagues
SET bounty_enabled = true
WHERE status = 'active' AND type = 'session';
