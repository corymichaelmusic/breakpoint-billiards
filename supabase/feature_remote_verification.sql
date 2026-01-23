
-- 1. Add verification columns (safe if exists)
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS p1_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS p2_verified boolean DEFAULT false;

-- 2. Update Finalize Function to be Idempotent
-- This prevents double-counting if both users trigger the RPC simultaneously
CREATE OR REPLACE FUNCTION finalize_match_stats_v2(
    p_match_id uuid,
    p_game_type text,
    p_winner_id text,
    p_p1_racks_won int,
    p_p1_racks_lost int,
    p_p2_racks_won int,
    p_p2_racks_lost int,
    p_p1_break_runs int default 0,
    p_p1_rack_runs int default 0,
    p_p1_snaps int default 0,
    p_p1_early_8s int default 0,
    p_p2_break_runs int default 0,
    p_p2_rack_runs int default 0,
    p_p2_snaps int default 0,
    p_p2_early_8s int default 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player1_id text;
    v_player2_id text;
    v_league_id uuid;
    v_p1_rating numeric;
    v_p2_rating numeric;
    v_p1_racks_played int;
    v_p2_racks_played int;
    v_p1_delta numeric;
    v_p2_delta numeric;
    v_current_status text;
    v_already_finalized boolean;
BEGIN
    -- 0. Idempotency Check
    -- Check if this specific game type is ALREADY finalized
    SELECT 
        CASE 
            WHEN p_game_type = '8ball' THEN status_8ball
            WHEN p_game_type = '9ball' THEN status_9ball
        END INTO v_current_status
    FROM matches
    WHERE id = p_match_id;

    IF v_current_status = 'finalized' THEN
        -- If already finalized, do nothing (exit silently)
        RETURN;
    END IF;

    -- 1. Get Match Info
    SELECT player1_id, player2_id, league_id INTO v_player1_id, v_player2_id, v_league_id
    FROM matches
    WHERE id = p_match_id;

    -- 2. Get Player Ratings from league_players
    SELECT breakpoint_rating, breakpoint_racks_played 
    INTO v_p1_rating, v_p1_racks_played
    FROM league_players 
    WHERE league_id = v_league_id AND player_id = v_player1_id;
    
    SELECT breakpoint_rating, breakpoint_racks_played 
    INTO v_p2_rating, v_p2_racks_played
    FROM league_players 
    WHERE league_id = v_league_id AND player_id = v_player2_id;
    
    -- Defaults
    v_p1_rating := COALESCE(v_p1_rating, 500);
    v_p2_rating := COALESCE(v_p2_rating, 500);
    v_p1_racks_played := COALESCE(v_p1_racks_played, 0);
    v_p2_racks_played := COALESCE(v_p2_racks_played, 0);

    -- 3. Calculate Deltas
    v_p1_delta := calculate_bbrs_delta(
        v_p1_rating, v_p2_rating, p_p1_racks_won, p_p1_racks_lost, v_p1_racks_played, TRUE,
        (v_player1_id = p_winner_id) -- p_did_win
    );
    
    v_p2_delta := calculate_bbrs_delta(
        v_p2_rating, v_p1_rating, p_p2_racks_won, p_p2_racks_lost, v_p2_racks_played, TRUE,
        (v_player2_id = p_winner_id) -- p_did_win
    );

    -- 4. Update Match Status & Reset Verification Flags (Cleanup)
    IF p_game_type = '8ball' THEN
        UPDATE matches 
        SET status_8ball = 'finalized', 
            winner_id_8ball = p_winner_id,
            submitted_at = NOW(),
            p1_verified = true, -- Ensure marked true for history
            p2_verified = true
        WHERE id = p_match_id;
    ELSE
        UPDATE matches 
        SET status_9ball = 'finalized', 
            winner_id_9ball = p_winner_id,
            submitted_at = NOW(),
            p1_verified = true,
            p2_verified = true
        WHERE id = p_match_id;
    END IF;

    -- Check for Shutout
    DECLARE
        v_status_8ball text;
        v_status_9ball text;
        v_winner_8ball text;
        v_winner_9ball text;
        v_is_shutout boolean := false;
    BEGIN
        SELECT status_8ball, status_9ball, winner_id_8ball, winner_id_9ball
        INTO v_status_8ball, v_status_9ball, v_winner_8ball, v_winner_9ball
        FROM matches
        WHERE id = p_match_id;

        IF v_status_8ball = 'finalized' AND v_status_9ball = 'finalized' THEN
            IF v_winner_8ball = v_winner_9ball THEN
                v_is_shutout := true;
            END IF;
        END IF;

        -- 5. Update Stats (Player 1)
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating + v_p1_delta,
            breakpoint_racks_won = breakpoint_racks_won + p_p1_racks_won,
            breakpoint_racks_lost = breakpoint_racks_lost + p_p1_racks_lost,
            matches_won = matches_won + (CASE WHEN v_player1_id = p_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost + (CASE WHEN v_player1_id != p_winner_id THEN 1 ELSE 0 END),
            breakpoint_racks_played = breakpoint_racks_played + (p_p1_racks_won + p_p1_racks_lost),
            matches_played = matches_played + 1,
            shutouts = shutouts + (CASE WHEN v_is_shutout AND v_player1_id = v_winner_8ball THEN 1 ELSE 0 END),
            total_break_and_runs = total_break_and_runs + p_p1_break_runs,
            total_rack_and_runs = total_rack_and_runs + p_p1_rack_runs,
            total_nine_on_snap = total_nine_on_snap + p_p1_snaps,
            total_early_8 = total_early_8 + p_p1_early_8s,
            total_break_and_runs_8ball = total_break_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p1_break_runs ELSE 0 END),
            total_break_and_runs_9ball = total_break_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p1_break_runs ELSE 0 END),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p1_rack_runs ELSE 0 END),
            total_rack_and_runs_9ball = total_rack_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p1_rack_runs ELSE 0 END)
        WHERE league_id = v_league_id AND player_id = v_player1_id;

        -- Update Global Profile Rating
        UPDATE profiles SET breakpoint_rating = breakpoint_rating + v_p1_delta WHERE id = v_player1_id;

        -- 6. Update Stats (Player 2)
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating + v_p2_delta,
            breakpoint_racks_won = breakpoint_racks_won + p_p2_racks_won,
            breakpoint_racks_lost = breakpoint_racks_lost + p_p2_racks_lost,
            matches_won = matches_won + (CASE WHEN v_player2_id = p_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost + (CASE WHEN v_player2_id != p_winner_id THEN 1 ELSE 0 END),
            breakpoint_racks_played = breakpoint_racks_played + (p_p2_racks_won + p_p2_racks_lost),
            matches_played = matches_played + 1,
            shutouts = shutouts + (CASE WHEN v_is_shutout AND v_player2_id = v_winner_8ball THEN 1 ELSE 0 END),
            total_break_and_runs = total_break_and_runs + p_p2_break_runs,
            total_rack_and_runs = total_rack_and_runs + p_p2_rack_runs,
            total_nine_on_snap = total_nine_on_snap + p_p2_snaps,
            total_early_8 = total_early_8 + p_p2_early_8s,
            total_break_and_runs_8ball = total_break_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p2_break_runs ELSE 0 END),
            total_break_and_runs_9ball = total_break_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p2_break_runs ELSE 0 END),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p2_rack_runs ELSE 0 END),
            total_rack_and_runs_9ball = total_rack_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p2_rack_runs ELSE 0 END)
        WHERE league_id = v_league_id AND player_id = v_player2_id;

        -- Update Global Profile Rating
        UPDATE profiles SET breakpoint_rating = breakpoint_rating + v_p2_delta WHERE id = v_player2_id;
    END;
END;
$$;
