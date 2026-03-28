require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const sql = `
CREATE OR REPLACE FUNCTION submit_match_for_verification(
    p_match_id uuid,
    p_player_id text,
    p_stats jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player1_id text;
    v_player2_id text;
    v_league_id uuid;
    v_is_player1 boolean;
    v_other_submission jsonb;
    v_verification_result text;
    v_stats_match boolean;
    v_auto_deadline timestamptz;
    v_current_status text;
    
    v_match_race_8_p1 int;
    v_p1_rating_bbrs numeric;
    v_p2_rating_bbrs numeric;
    v_p1_rating_fargo int;
    v_p2_rating_fargo int;
    v_p1_effective_rating numeric;
    v_p2_effective_rating numeric;
    v_race_8_targets jsonb;
    v_race_9_targets jsonb;
    
    v_my_8ball_p1 int;
    v_my_8ball_p2 int;
    v_my_9ball_p1 int;
    v_my_9ball_p2 int;
    v_other_8ball_p1 int;
    v_other_8ball_p2 int;
    v_other_9ball_p1 int;
    v_other_9ball_p2 int;
BEGIN
    SELECT player1_id, player2_id, league_id, verification_status
    INTO v_player1_id, v_player2_id, v_league_id, v_current_status
    FROM matches
    WHERE id = p_match_id;
    
    IF v_player1_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Match not found'); END IF;
    IF v_current_status = 'verified' THEN RETURN jsonb_build_object('success', false, 'error', 'Match already verified'); END IF;
    
    v_is_player1 := (p_player_id = v_player1_id);
    IF NOT v_is_player1 AND p_player_id != v_player2_id THEN RETURN jsonb_build_object('success', false, 'error', 'Player not part of this match'); END IF;
    
    v_auto_deadline := NOW() + INTERVAL '24 hours';
    IF v_is_player1 THEN
        UPDATE matches SET pending_p1_submission = p_stats, p1_submitted_at = NOW(),
            verification_status = 'pending_verification', auto_submit_deadline = COALESCE(auto_submit_deadline, v_auto_deadline) WHERE id = p_match_id;
        SELECT pending_p2_submission INTO v_other_submission FROM matches WHERE id = p_match_id;
    ELSE
        UPDATE matches SET pending_p2_submission = p_stats, p2_submitted_at = NOW(),
            verification_status = 'pending_verification', auto_submit_deadline = COALESCE(auto_submit_deadline, v_auto_deadline) WHERE id = p_match_id;
        SELECT pending_p1_submission INTO v_other_submission FROM matches WHERE id = p_match_id;
    END IF;
    
    IF v_other_submission IS NULL THEN
        RETURN jsonb_build_object('success', true, 'status', 'waiting_for_opponent', 'message', 'Your scores have been submitted. Waiting for opponent to submit.', 'auto_submit_deadline', v_auto_deadline);
    END IF;
    
    v_my_8ball_p1 := (p_stats->'8ball'->>'p1_racks')::int;
    v_my_8ball_p2 := (p_stats->'8ball'->>'p2_racks')::int;
    v_my_9ball_p1 := (p_stats->'9ball'->>'p1_racks')::int;
    v_my_9ball_p2 := (p_stats->'9ball'->>'p2_racks')::int;
    v_other_8ball_p1 := (v_other_submission->'8ball'->>'p1_racks')::int;
    v_other_8ball_p2 := (v_other_submission->'8ball'->>'p2_racks')::int;
    v_other_9ball_p1 := (v_other_submission->'9ball'->>'p1_racks')::int;
    v_other_9ball_p2 := (v_other_submission->'9ball'->>'p2_racks')::int;
    
    v_stats_match := (
        v_my_8ball_p1 = v_other_8ball_p1 AND v_my_8ball_p2 = v_other_8ball_p2 AND
        v_my_9ball_p1 = v_other_9ball_p1 AND v_my_9ball_p2 = v_other_9ball_p2 AND
        COALESCE((p_stats->'8ball'->>'p1_break_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p1_break_runs')::int, 0) AND
        COALESCE((p_stats->'8ball'->>'p2_break_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p2_break_runs')::int, 0) AND
        COALESCE((p_stats->'8ball'->>'p1_rack_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p1_rack_runs')::int, 0) AND
        COALESCE((p_stats->'8ball'->>'p2_rack_runs')::int, 0) = COALESCE((v_other_submission->'8ball'->>'p2_rack_runs')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p1_break_runs')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p1_break_runs')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p2_break_runs')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p2_break_runs')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p1_snaps')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p1_snaps')::int, 0) AND
        COALESCE((p_stats->'9ball'->>'p2_snaps')::int, 0) = COALESCE((v_other_submission->'9ball'->>'p2_snaps')::int, 0)
    );
    
    IF v_stats_match THEN
        -- Snapshot Races BEFORE finalizing
        SELECT race_8ball_p1 INTO v_match_race_8_p1 FROM matches WHERE id = p_match_id;
        IF v_match_race_8_p1 IS NULL THEN
            SELECT breakpoint_rating INTO v_p1_rating_bbrs FROM league_players WHERE league_id = v_league_id AND player_id = v_player1_id;
            SELECT breakpoint_rating INTO v_p2_rating_bbrs FROM league_players WHERE league_id = v_league_id AND player_id = v_player2_id;
            SELECT fargo_rating INTO v_p1_rating_fargo FROM profiles WHERE id = v_player1_id;
            SELECT fargo_rating INTO v_p2_rating_fargo FROM profiles WHERE id = v_player2_id;
            
            v_p1_effective_rating := COALESCE(v_p1_rating_bbrs, v_p1_rating_fargo, 500);
            v_p2_effective_rating := COALESCE(v_p2_rating_bbrs, v_p2_rating_fargo, 500);
            
            v_race_8_targets := get_race_target(v_p1_effective_rating, v_p2_effective_rating, '8ball');
            v_race_9_targets := get_race_target(v_p1_effective_rating, v_p2_effective_rating, '9ball');
            
            UPDATE matches SET
                race_8ball_p1 = (v_race_8_targets->>'p1')::int,
                race_8ball_p2 = (v_race_8_targets->>'p2')::int,
                race_9ball_p1 = (v_race_9_targets->>'p1')::int,
                race_9ball_p2 = (v_race_9_targets->>'p2')::int
            WHERE id = p_match_id;
        END IF;

        UPDATE matches SET verification_status = 'verified' WHERE id = p_match_id;
        UPDATE games SET verification_status = 'verified' WHERE match_id = p_match_id;
        
        PERFORM finalize_match_stats(
            p_match_id, '8ball', '', v_my_8ball_p1, v_my_8ball_p2, v_my_8ball_p2, v_my_8ball_p1, 0, 0,
            COALESCE((p_stats->'8ball'->>'p1_break_runs')::int, 0), COALESCE((p_stats->'8ball'->>'p1_rack_runs')::int, 0), 0, 0,
            COALESCE((p_stats->'8ball'->>'p2_break_runs')::int, 0), COALESCE((p_stats->'8ball'->>'p2_rack_runs')::int, 0), 0, 0
        );
        PERFORM finalize_match_stats(
            p_match_id, '9ball', '', v_my_9ball_p1, v_my_9ball_p2, v_my_9ball_p2, v_my_9ball_p1, 0, 0,
            COALESCE((p_stats->'9ball'->>'p1_break_runs')::int, 0), 0, COALESCE((p_stats->'9ball'->>'p1_snaps')::int, 0), 0,
            COALESCE((p_stats->'9ball'->>'p2_break_runs')::int, 0), 0, COALESCE((p_stats->'9ball'->>'p2_snaps')::int, 0), 0
        );
        RETURN jsonb_build_object('success', true, 'status', 'verified', 'message', 'Both players agree! Match has been finalized.');
    ELSE
        UPDATE matches SET verification_status = 'disputed', pending_p1_submission = NULL, pending_p2_submission = NULL, p1_submitted_at = NULL, p2_submitted_at = NULL WHERE id = p_match_id;
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Score mismatch detected. Both players must review and resubmit.', 'your_submission', p_stats, 'opponent_submission', v_other_submission);
    END IF;
END;
$$;
`;

async function deploy() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        await client.query(sql);
        console.log("SUCCESS: submit_match_for_verification RPC deployed to production via pg driver.");
    } catch (e) {
        console.error("FAILED deploying SQL:", e);
    } finally {
        await client.end();
    }
}

deploy();
