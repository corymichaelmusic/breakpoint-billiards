-- Submit Match for Verification RPC
-- Called by each player when they submit their match scores
-- Compares submissions and either verifies or flags disputes

DROP FUNCTION IF EXISTS public.submit_match_for_verification(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION submit_match_for_verification(
    p_match_id uuid,
    p_player_id text,
    p_stats jsonb  -- Contains 8ball and 9ball stats
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player1_id text;
    v_player2_id text;
    v_is_player1 boolean;
    v_other_submission jsonb;
    v_verification_result text;
    v_stats_match boolean;
    v_auto_deadline timestamptz;
    v_current_status text;
    
    -- Stats extraction for comparison
    v_my_8ball_p1 int;
    v_my_8ball_p2 int;
    v_my_9ball_p1 int;
    v_my_9ball_p2 int;
    v_other_8ball_p1 int;
    v_other_8ball_p2 int;
    v_other_9ball_p1 int;
    v_other_9ball_p2 int;
BEGIN
    -- 1. Get match info
    SELECT player1_id, player2_id, verification_status
    INTO v_player1_id, v_player2_id, v_current_status
    FROM matches
    WHERE id = p_match_id;
    
    IF v_player1_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    -- Check if already verified
    IF v_current_status = 'verified' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match already verified');
    END IF;
    
    -- 2. Determine if submitter is player 1 or player 2
    v_is_player1 := (p_player_id = v_player1_id);
    
    IF NOT v_is_player1 AND p_player_id != v_player2_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not part of this match');
    END IF;
    
    -- 3. Store the submission and set auto-submit deadline (24 hours from first submission)
    v_auto_deadline := NOW() + INTERVAL '24 hours';
    
    IF v_is_player1 THEN
        UPDATE matches
        SET 
            pending_p1_submission = p_stats,
            p1_submitted_at = NOW(),
            verification_status = 'pending_verification',
            auto_submit_deadline = COALESCE(auto_submit_deadline, v_auto_deadline)
        WHERE id = p_match_id;
        
        -- Get other player's submission if exists
        SELECT pending_p2_submission INTO v_other_submission
        FROM matches WHERE id = p_match_id;
    ELSE
        UPDATE matches
        SET 
            pending_p2_submission = p_stats,
            p2_submitted_at = NOW(),
            verification_status = 'pending_verification',
            auto_submit_deadline = COALESCE(auto_submit_deadline, v_auto_deadline)
        WHERE id = p_match_id;
        
        -- Get other player's submission if exists
        SELECT pending_p1_submission INTO v_other_submission
        FROM matches WHERE id = p_match_id;
    END IF;
    
    -- 4. If other player hasn't submitted yet, return waiting status
    IF v_other_submission IS NULL THEN
        RETURN jsonb_build_object(
            'success', true, 
            'status', 'waiting_for_opponent',
            'message', 'Your scores have been submitted. Waiting for opponent to submit.',
            'auto_submit_deadline', v_auto_deadline
        );
    END IF;
    
    -- 5. Both players have submitted - compare stats
    -- Extract scores from both submissions for comparison
    v_my_8ball_p1 := (p_stats->'8ball'->>'p1_racks')::int;
    v_my_8ball_p2 := (p_stats->'8ball'->>'p2_racks')::int;
    v_my_9ball_p1 := (p_stats->'9ball'->>'p1_racks')::int;
    v_my_9ball_p2 := (p_stats->'9ball'->>'p2_racks')::int;
    
    v_other_8ball_p1 := (v_other_submission->'8ball'->>'p1_racks')::int;
    v_other_8ball_p2 := (v_other_submission->'8ball'->>'p2_racks')::int;
    v_other_9ball_p1 := (v_other_submission->'9ball'->>'p1_racks')::int;
    v_other_9ball_p2 := (v_other_submission->'9ball'->>'p2_racks')::int;
    
    -- Core stats must match exactly (Racks, Break Runs, Rack Runs, Snaps)
    v_stats_match := (
        -- 8-Ball Racks
        v_my_8ball_p1 = v_other_8ball_p1 AND
        v_my_8ball_p2 = v_other_8ball_p2 AND
        -- 9-Ball Racks
        v_my_9ball_p1 = v_other_9ball_p1 AND
        v_my_9ball_p2 = v_other_9ball_p2 AND
        
        -- 8-Ball Bonus Stats
        COALESCE((p_stats->'8ball'->>'p1_break_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p1_break_runs')::int, 0) AND
        COALESCE((p_stats->'8ball'->>'p2_break_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p2_break_runs')::int, 0) AND
        COALESCE((p_stats->'8ball'->>'p1_rack_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p1_rack_runs')::int, 0) AND
        COALESCE((p_stats->'8ball'->>'p2_rack_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p2_rack_runs')::int, 0) AND
        
        -- 9-Ball Bonus Stats
        COALESCE((p_stats->'9ball'->>'p1_break_runs')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p1_break_runs')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p2_break_runs')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p2_break_runs')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p1_snaps')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p1_snaps')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p2_snaps')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p2_snaps')::int, 0)
    );
    
    IF v_stats_match THEN
        -- 6a. Stats match! Finalize the match
        UPDATE matches
        SET verification_status = 'verified'
        WHERE id = p_match_id;
        
        -- Mark all pending games as verified
        UPDATE games
        SET verification_status = 'verified'
        WHERE match_id = p_match_id;
        
        -- Call finalize for 8ball
        PERFORM finalize_match_stats(
            p_match_id,
            '8ball',
            '', -- winner_id computed server-side
            v_my_8ball_p1,
            v_my_8ball_p2,
            v_my_8ball_p2,
            v_my_8ball_p1,
            0, 0,
            COALESCE((p_stats->'8ball'->>'p1_break_runs')::int, 0),
            COALESCE((p_stats->'8ball'->>'p1_rack_runs')::int, 0),
            0, -- snaps
            0, -- early_8s
            COALESCE((p_stats->'8ball'->>'p2_break_runs')::int, 0),
            COALESCE((p_stats->'8ball'->>'p2_rack_runs')::int, 0),
            0,
            0
        );
        
        -- Call finalize for 9ball
        PERFORM finalize_match_stats(
            p_match_id,
            '9ball',
            '', -- winner_id computed server-side
            v_my_9ball_p1,
            v_my_9ball_p2,
            v_my_9ball_p2,
            v_my_9ball_p1,
            0, 0,
            COALESCE((p_stats->'9ball'->>'p1_break_runs')::int, 0),
            0, -- rack_runs
            COALESCE((p_stats->'9ball'->>'p1_snaps')::int, 0),
            0,
            COALESCE((p_stats->'9ball'->>'p2_break_runs')::int, 0),
            0,
            COALESCE((p_stats->'9ball'->>'p2_snaps')::int, 0),
            0
        );
        
        RETURN jsonb_build_object(
            'success', true, 
            'status', 'verified',
            'message', 'Both players agree! Match has been finalized.'
        );
    ELSE
        -- 6b. Stats don't match - flag as disputed and CLEAR BOTH submissions
        -- Both players must resubmit fresh to prevent one-sided corrections
        UPDATE matches
        SET verification_status = 'disputed',
            pending_p1_submission = NULL,
            pending_p2_submission = NULL,
            p1_submitted_at = NULL,
            p2_submitted_at = NULL
        WHERE id = p_match_id;
        
        RETURN jsonb_build_object(
            'success', true, 
            'status', 'disputed',
            'message', 'Score mismatch detected. Both players must review and resubmit.',
            'your_submission', p_stats,
            'opponent_submission', v_other_submission
        );
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_match_for_verification TO authenticated;

COMMENT ON FUNCTION submit_match_for_verification IS 
'Submits a player''s match scores for verification. When both players submit, 
compares stats and either finalizes the match or flags it as disputed.';
