-- Score Verification System - Database Migration
-- Adds columns to track dual-device verification before stats are finalized

-- 1. Add verification columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS pending_p1_submission jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pending_p2_submission jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS p1_submitted_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS p2_submitted_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS auto_submit_deadline timestamptz DEFAULT NULL;

-- 2. Add check constraint for verification_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'matches_verification_status_check'
    ) THEN
        ALTER TABLE public.matches 
        ADD CONSTRAINT matches_verification_status_check 
        CHECK (verification_status IN ('in_progress', 'pending_verification', 'verified', 'disputed'));
    END IF;
END $$;

-- 3. Add status column to games table for pending/verified tracking
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'games_verification_status_check'
    ) THEN
        ALTER TABLE public.games 
        ADD CONSTRAINT games_verification_status_check 
        CHECK (verification_status IN ('pending', 'verified', 'disputed'));
    END IF;
END $$;

-- 4. Create index for efficient verification status queries
CREATE INDEX IF NOT EXISTS idx_matches_verification_status 
ON public.matches(verification_status) 
WHERE verification_status != 'verified';

-- 5. Comment documentation
COMMENT ON COLUMN public.matches.pending_p1_submission IS 'JSON stats submitted by player 1, awaiting verification';
COMMENT ON COLUMN public.matches.pending_p2_submission IS 'JSON stats submitted by player 2, awaiting verification';
COMMENT ON COLUMN public.matches.p1_submitted_at IS 'Timestamp when player 1 submitted their scores';
COMMENT ON COLUMN public.matches.p2_submitted_at IS 'Timestamp when player 2 submitted their scores';
COMMENT ON COLUMN public.matches.verification_status IS 'Status: in_progress, pending_verification, verified, disputed';
COMMENT ON COLUMN public.matches.auto_submit_deadline IS 'Deadline for auto-submit if opponent does not submit';
COMMENT ON COLUMN public.games.verification_status IS 'Whether this game record has been verified by both players';
