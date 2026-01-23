-- Auto-Submit Expired Verifications
-- This function processes matches where one player submitted but the other didn't
-- within the 24-hour deadline. The first submission is accepted as final.

CREATE OR REPLACE FUNCTION process_auto_submit_verifications()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_processed int := 0;
    v_match RECORD;
    v_stats jsonb;
BEGIN
    -- Find matches past their auto-submit deadline
    FOR v_match IN 
        SELECT id, player1_id, player2_id, 
               pending_p1_submission, pending_p2_submission,
               p1_submitted_at, p2_submitted_at
        FROM matches
        WHERE verification_status = 'pending_verification'
          AND auto_submit_deadline < NOW()
          AND (pending_p1_submission IS NOT NULL OR pending_p2_submission IS NOT NULL)
    LOOP
        -- Use whichever submission exists (or first if somehow both exist)
        v_stats := COALESCE(v_match.pending_p1_submission, v_match.pending_p2_submission);
        
        IF v_stats IS NOT NULL THEN
            -- Mark as verified (auto-submitted)
            UPDATE matches
            SET verification_status = 'verified'
            WHERE id = v_match.id;
            
            -- Mark all games as verified
            UPDATE games
            SET verification_status = 'verified'
            WHERE match_id = v_match.id;
            
            -- Finalize 8ball
            PERFORM finalize_match_stats(
                v_match.id,
                '8ball',
                '',
                COALESCE((v_stats->'8ball'->>'p1_racks')::int, 0),
                COALESCE((v_stats->'8ball'->>'p2_racks')::int, 0),
                COALESCE((v_stats->'8ball'->>'p2_racks')::int, 0),
                COALESCE((v_stats->'8ball'->>'p1_racks')::int, 0),
                0, 0,
                COALESCE((v_stats->'8ball'->>'p1_break_runs')::int, 0),
                COALESCE((v_stats->'8ball'->>'p1_rack_runs')::int, 0),
                0, 0,
                COALESCE((v_stats->'8ball'->>'p2_break_runs')::int, 0),
                COALESCE((v_stats->'8ball'->>'p2_rack_runs')::int, 0),
                0, 0
            );
            
            -- Finalize 9ball
            PERFORM finalize_match_stats(
                v_match.id,
                '9ball',
                '',
                COALESCE((v_stats->'9ball'->>'p1_racks')::int, 0),
                COALESCE((v_stats->'9ball'->>'p2_racks')::int, 0),
                COALESCE((v_stats->'9ball'->>'p2_racks')::int, 0),
                COALESCE((v_stats->'9ball'->>'p1_racks')::int, 0),
                0, 0,
                COALESCE((v_stats->'9ball'->>'p1_break_runs')::int, 0),
                0,
                COALESCE((v_stats->'9ball'->>'p1_snaps')::int, 0),
                0,
                COALESCE((v_stats->'9ball'->>'p2_break_runs')::int, 0),
                0,
                COALESCE((v_stats->'9ball'->>'p2_snaps')::int, 0),
                0
            );
            
            v_processed := v_processed + 1;
        END IF;
    END LOOP;
    
    RETURN v_processed;
END;
$$;

-- Grant execute to service role (for cron jobs)
GRANT EXECUTE ON FUNCTION process_auto_submit_verifications TO service_role;

COMMENT ON FUNCTION process_auto_submit_verifications IS 
'Processes expired verification deadlines. When one player submits but the other 
does not respond within 24 hours, the first submission is auto-accepted.
Should be called by a scheduled job (e.g., Supabase pg_cron).';

-- Optional: Create a cron job to run every hour
-- Note: This requires pg_cron extension to be enabled in Supabase
-- SELECT cron.schedule('process-auto-verifications', '0 * * * *', 'SELECT process_auto_submit_verifications()');
