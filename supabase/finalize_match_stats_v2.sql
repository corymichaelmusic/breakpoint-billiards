-- Finalize Match Stats V2 - SECURE VERSION
-- Created to resolve function signature ambiguity/caching issues with v1
-- This version calculates BBRS deltas SERVER-SIDE using calculate_bbrs_delta()

DROP FUNCTION IF EXISTS public.finalize_match_stats_v2(uuid, text, text, int, int, int, int, int, int, int, int, int, int, int, int);

CREATE OR REPLACE FUNCTION finalize_match_stats_v2(
    p_match_id uuid,
    p_game_type text,
    p_winner_id text,
    -- REMOVED: p_p1_delta and p_p2_delta - now calculated server-side
    p_p1_racks_won int,
    p_p1_racks_lost int,
    p_p2_racks_won int,
    p_p2_racks_lost int,
    
    -- Granular Stats (win_zips removed - columns dropped from DB)
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
BEGIN
    -- 1. Get Match Info
    SELECT player1_id, player2_id, league_id INTO v_player1_id, v_player2_id, v_league_id
    FROM matches
    WHERE id = p_match_id;

    -- 2. Get Player Ratings and Racks Played from league_players
    SELECT breakpoint_rating, breakpoint_racks_played 
    INTO v_p1_rating, v_p1_racks_played
    FROM league_players 
    WHERE league_id = v_league_id AND player_id = v_player1_id;
    
    SELECT breakpoint_rating, breakpoint_racks_played 
    INTO v_p2_rating, v_p2_racks_played
    FROM league_players 
    WHERE league_id = v_league_id AND player_id = v_player2_id;
    
    -- Default to 500 if not found
    v_p1_rating := COALESCE(v_p1_rating, 500);
    v_p2_rating := COALESCE(v_p2_rating, 500);
    v_p1_racks_played := COALESCE(v_p1_racks_played, 0);
    v_p2_racks_played := COALESCE(v_p2_racks_played, 0);

    -- 3. Calculate BBRS Deltas SERVER-SIDE (the secret sauce!)
    v_p1_delta := calculate_bbrs_delta(
        v_p1_rating,           -- p_player_rating
        v_p2_rating,           -- p_opponent_rating
        p_p1_racks_won,        -- p_player_score
        p_p1_racks_lost,       -- p_opponent_score
        v_p1_racks_played,     -- p_player_racks_played
        TRUE                   -- p_is_league
    );
    
    v_p2_delta := calculate_bbrs_delta(
        v_p2_rating,           -- p_player_rating
        v_p1_rating,           -- p_opponent_rating
        p_p2_racks_won,        -- p_player_score
        p_p2_racks_lost,       -- p_opponent_score
        v_p2_racks_played,     -- p_player_racks_played
        TRUE                   -- p_is_league
    );

    -- 4. Update Match Status & Scoped Verification Flags
    UPDATE public.matches
    SET 
        status_8ball = CASE WHEN p_game_type = '8ball' THEN 'finalized' ELSE status_8ball END,
        winner_id_8ball = CASE WHEN p_game_type = '8ball' THEN p_winner_id ELSE winner_id_8ball END,
        p1_verified_8ball = CASE WHEN p_game_type = '8ball' THEN TRUE ELSE p1_verified_8ball END,
        p2_verified_8ball = CASE WHEN p_game_type = '8ball' THEN TRUE ELSE p2_verified_8ball END,
        
        status_9ball = CASE WHEN p_game_type = '9ball' THEN 'finalized' ELSE status_9ball END,
        winner_id_9ball = CASE WHEN p_game_type = '9ball' THEN p_winner_id ELSE winner_id_9ball END,
        p1_verified_9ball = CASE WHEN p_game_type = '9ball' THEN TRUE ELSE p1_verified_9ball END,
        p2_verified_9ball = CASE WHEN p_game_type = '9ball' THEN TRUE ELSE p2_verified_9ball END,
        submitted_at = NOW()
    WHERE id = p_match_id;

    -- Check for Shutout Condition (Both sets finalized and won by same player)
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

        -- 5. Update Player 1 Stats
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
            
            -- Granular Updates
            total_break_and_runs = total_break_and_runs + p_p1_break_runs,
            total_rack_and_runs = total_rack_and_runs + p_p1_rack_runs,
            total_nine_on_snap = total_nine_on_snap + p_p1_snaps,
            total_early_8 = total_early_8 + p_p1_early_8s,
            
            -- Split Updates
            total_break_and_runs_8ball = total_break_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p1_break_runs ELSE 0 END),
            total_break_and_runs_9ball = total_break_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p1_break_runs ELSE 0 END),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p1_rack_runs ELSE 0 END),
            total_rack_and_runs_9ball = total_rack_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p1_rack_runs ELSE 0 END)
            
        WHERE league_id = v_league_id AND player_id = v_player1_id;

        -- Update Global Profile Rating (Player 1)
        UPDATE profiles
        SET breakpoint_rating = breakpoint_rating + v_p1_delta
        WHERE id = v_player1_id;

        -- 6. Update Player 2 Stats
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
            
            -- Granular Updates
            total_break_and_runs = total_break_and_runs + p_p2_break_runs,
            total_rack_and_runs = total_rack_and_runs + p_p2_rack_runs,
            total_nine_on_snap = total_nine_on_snap + p_p2_snaps,
            total_early_8 = total_early_8 + p_p2_early_8s,
            
            -- Split Updates
            total_break_and_runs_8ball = total_break_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p2_break_runs ELSE 0 END),
            total_break_and_runs_9ball = total_break_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p2_break_runs ELSE 0 END),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p2_rack_runs ELSE 0 END),
            total_rack_and_runs_9ball = total_rack_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p2_rack_runs ELSE 0 END)
            
        WHERE league_id = v_league_id AND player_id = v_player2_id;
    END;

    -- Update Global Profile Rating (Player 2)
    UPDATE profiles
    SET breakpoint_rating = breakpoint_rating + v_p2_delta
    WHERE id = v_player2_id;

END;
$$;

COMMENT ON FUNCTION finalize_match_stats_v2 IS 'Finalizes match with server-side BBRS calculation V2.';

GRANT EXECUTE ON FUNCTION finalize_match_stats_v2 TO authenticated;
