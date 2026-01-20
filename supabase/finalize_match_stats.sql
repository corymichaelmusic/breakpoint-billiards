-- Finalize Match Stats - SERVER SIDE WINNER + BONUS POINT DISPLAY FIX
-- This version ensures the App displays the correct winner even without an update
-- by artificially inflating the winner's POINTS (not SCORE) if needed.

CREATE OR REPLACE FUNCTION finalize_match_stats(
    p_match_id uuid,
    p_game_type text,
    p_winner_id text, -- Ignored

    p_p1_racks_won int,
    p_p1_racks_lost int,
    p_p2_racks_won int,
    p_p2_racks_lost int,
    
    p_p1_delta numeric DEFAULT 0,
    p_p2_delta numeric DEFAULT 0,
    
    -- Granular Stats
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
    
    -- Ratings
    v_p1_rating_bbrs numeric;
    v_p2_rating_bbrs numeric;
    v_p1_rating_fargo int;
    v_p2_rating_fargo int;
    v_p1_effective_rating numeric;
    v_p2_effective_rating numeric;

    v_p1_racks_played int;
    v_p2_racks_played int;
    v_p1_delta numeric;
    v_p2_delta numeric;
    
    -- Winner Determination
    v_race_targets jsonb;
    v_race_p1 int;
    v_race_p2 int;
    v_final_winner_id text;
    
    -- Display Points (Calculated to force Client Display)
    v_points_p1 int;
    v_points_p2 int;
    
    -- Shutout Logic
    v_existing_status text;
    v_other_winner_id text;
    v_was_shutout boolean := false;
    v_shutout_winner_id text;

BEGIN
    -- 1. Get Match Info
    SELECT player1_id, player2_id, league_id INTO v_player1_id, v_player2_id, v_league_id
    FROM matches
    WHERE id = p_match_id;

    -- 2. Get Player Ratings (BBRS) and Racks Played
    SELECT breakpoint_rating, breakpoint_racks_played 
    INTO v_p1_rating_bbrs, v_p1_racks_played
    FROM league_players 
    WHERE league_id = v_league_id AND player_id = v_player1_id;
    
    SELECT breakpoint_rating, breakpoint_racks_played 
    INTO v_p2_rating_bbrs, v_p2_racks_played
    FROM league_players 
    WHERE league_id = v_league_id AND player_id = v_player2_id;
    
    -- Get Fargo Ratings from Profiles
    SELECT fargo_rating INTO v_p1_rating_fargo FROM profiles WHERE id = v_player1_id;
    SELECT fargo_rating INTO v_p2_rating_fargo FROM profiles WHERE id = v_player2_id;

    -- Determine Effective Rating (Fargo Priority)
    v_p1_effective_rating := COALESCE(v_p1_rating_fargo, v_p1_rating_bbrs, 500);
    v_p2_effective_rating := COALESCE(v_p2_rating_fargo, v_p2_rating_bbrs, 500);

    -- Defaults
    v_p1_rating_bbrs := COALESCE(v_p1_rating_bbrs, 500);
    v_p2_rating_bbrs := COALESCE(v_p2_rating_bbrs, 500);
    v_p1_racks_played := COALESCE(v_p1_racks_played, 0);
    v_p2_racks_played := COALESCE(v_p2_racks_played, 0);


    -- 3. SERVER-SIDE WINNER DETERMINATION
    -- Get Race Targets
    v_race_targets := get_race_target(v_p1_effective_rating, v_p2_effective_rating, p_game_type);
    v_race_p1 := (v_race_targets->>'p1')::int;
    v_race_p2 := (v_race_targets->>'p2')::int;
    
    -- Logic: Who hit their race target?
    IF p_p1_racks_won >= v_race_p1 THEN
        v_final_winner_id := v_player1_id;
    ELSIF p_p2_racks_won >= v_race_p2 THEN
        v_final_winner_id := v_player2_id;
    ELSE
        -- Fallback
        IF p_p1_racks_won > p_p2_racks_won THEN
            v_final_winner_id := v_player1_id;
        ELSE
            v_final_winner_id := v_player2_id;
        END IF;
    END IF;
    
    -- 3.5 BONUS POINT LOGIC (Display Fix)
    -- If Winner has fewer or equal points, boost them to Loser + 1
    v_points_p1 := p_p1_racks_won;
    v_points_p2 := p_p2_racks_won;
    
    IF v_final_winner_id = v_player1_id THEN
        IF v_points_p1 <= v_points_p2 THEN
            v_points_p1 := v_points_p2 + 1;
        END IF;
    ELSE 
        -- Winner is P2
        IF v_points_p2 <= v_points_p1 THEN
            v_points_p2 := v_points_p1 + 1;
        END IF;
    END IF;


    -- 4. Calculate BBRS Deltas (Using BBRS ratings)
    v_p1_delta := calculate_bbrs_delta(
        v_p1_rating_bbrs, v_p2_rating_bbrs,
        p_p1_racks_won, p_p1_racks_lost,
        v_p1_racks_played, TRUE
    );
    
    v_p2_delta := calculate_bbrs_delta(
        v_p2_rating_bbrs, v_p1_rating_bbrs,
        p_p2_racks_won, p_p2_racks_lost,
        v_p2_racks_played, TRUE
    );

    -- 5. Update Match Status (Using Adjusted POINTS, but Real SCORE)
    IF p_game_type = '8ball' THEN
        UPDATE matches 
        SET status_8ball = 'finalized', 
            winner_id_8ball = v_final_winner_id,
            submitted_at = NOW(),
            delta_8ball_p1 = v_p1_delta,
            delta_8ball_p2 = v_p2_delta,
            score_8ball_p1 = p_p1_racks_won, -- REAL SCORE
            score_8ball_p2 = p_p2_racks_won, -- REAL SCORE
            points_8ball_p1 = v_points_p1,   -- DISPLAY SCORE
            points_8ball_p2 = v_points_p2,   -- DISPLAY SCORE
            p1_break_run_8ball = (p_p1_break_runs > 0),
            p2_break_run_8ball = (p_p2_break_runs > 0),
            p1_rack_run_8ball = (p_p1_rack_runs > 0),
            p2_rack_run_8ball = (p_p2_rack_runs > 0)
        WHERE id = p_match_id;

        -- Check for Shutout (Global)
        SELECT status_9ball, winner_id_9ball INTO v_existing_status, v_other_winner_id
        FROM matches WHERE id = p_match_id;
        
        IF v_existing_status = 'finalized' AND v_other_winner_id = v_final_winner_id THEN
            v_was_shutout := true;
            v_shutout_winner_id := v_final_winner_id;
        END IF;

    ELSE
        UPDATE matches 
        SET status_9ball = 'finalized', 
            winner_id_9ball = v_final_winner_id,
            submitted_at = NOW(),
            delta_9ball_p1 = v_p1_delta,
            delta_9ball_p2 = v_p2_delta,
            score_9ball_p1 = p_p1_racks_won, -- REAL SCORE
            score_9ball_p2 = p_p2_racks_won, -- REAL SCORE
            points_9ball_p1 = v_points_p1,   -- DISPLAY SCORE
            points_9ball_p2 = v_points_p2,   -- DISPLAY SCORE
            p1_break_run_9ball = (p_p1_break_runs > 0),
            p2_break_run_9ball = (p_p2_break_runs > 0),
            p1_nine_on_snap = (p_p1_snaps > 0),
            p2_nine_on_snap = (p_p2_snaps > 0)
        WHERE id = p_match_id;
        
        -- Check for Shutout (Global)
        SELECT status_8ball, winner_id_8ball INTO v_existing_status, v_other_winner_id
        FROM matches WHERE id = p_match_id;

        IF v_existing_status = 'finalized' AND v_other_winner_id = v_final_winner_id THEN
            v_was_shutout := true;
            v_shutout_winner_id := v_final_winner_id;
        END IF;
    END IF;

    -- 6. Update Player Stats (Player 1)
    UPDATE league_players
    SET 
        breakpoint_rating = breakpoint_rating + v_p1_delta,
        breakpoint_racks_won = breakpoint_racks_won + p_p1_racks_won,
        breakpoint_racks_lost = breakpoint_racks_lost + p_p1_racks_lost,
        breakpoint_racks_played = breakpoint_racks_played + (p_p1_racks_won + p_p1_racks_lost),
        matches_played = matches_played + 1,
        matches_won = matches_won + (CASE WHEN v_player1_id = v_final_winner_id THEN 1 ELSE 0 END),
        matches_lost = matches_lost + (CASE WHEN v_player1_id != v_final_winner_id THEN 1 ELSE 0 END),
        shutouts = shutouts + (CASE WHEN v_was_shutout AND v_player1_id = v_final_winner_id THEN 1 ELSE 0 END),
        total_break_and_runs = total_break_and_runs + p_p1_break_runs,
        total_rack_and_runs = total_rack_and_runs + p_p1_rack_runs,
        total_nine_on_snap = total_nine_on_snap + p_p1_snaps,
        total_early_8 = total_early_8 + p_p1_early_8s,
        
        total_break_and_runs_8ball = total_break_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p1_break_runs ELSE 0 END),
        total_rack_and_runs_8ball = total_rack_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p1_rack_runs ELSE 0 END),
        total_break_and_runs_9ball = total_break_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p1_break_runs ELSE 0 END)
        
    WHERE league_id = v_league_id AND player_id = v_player1_id;

    -- 7. Update Player Stats (Player 2)
    UPDATE league_players
    SET 
        breakpoint_rating = breakpoint_rating + v_p2_delta,
        breakpoint_racks_won = breakpoint_racks_won + p_p2_racks_won,
        breakpoint_racks_lost = breakpoint_racks_lost + p_p2_racks_lost,
        breakpoint_racks_played = breakpoint_racks_played + (p_p2_racks_won + p_p2_racks_lost),
        matches_played = matches_played + 1,
        matches_won = matches_won + (CASE WHEN v_player2_id = v_final_winner_id THEN 1 ELSE 0 END),
        matches_lost = matches_lost + (CASE WHEN v_player2_id != v_final_winner_id THEN 1 ELSE 0 END),
        shutouts = shutouts + (CASE WHEN v_was_shutout AND v_player2_id = v_final_winner_id THEN 1 ELSE 0 END),
        total_break_and_runs = total_break_and_runs + p_p2_break_runs,
        total_rack_and_runs = total_rack_and_runs + p_p2_rack_runs,
        total_nine_on_snap = total_nine_on_snap + p_p2_snaps,
        total_early_8 = total_early_8 + p_p2_early_8s,
        
        total_break_and_runs_8ball = total_break_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p2_break_runs ELSE 0 END),
        total_rack_and_runs_8ball = total_rack_and_runs_8ball + (CASE WHEN p_game_type = '8ball' THEN p_p2_rack_runs ELSE 0 END),
        total_break_and_runs_9ball = total_break_and_runs_9ball + (CASE WHEN p_game_type = '9ball' THEN p_p2_break_runs ELSE 0 END)
        
    WHERE league_id = v_league_id AND player_id = v_player2_id;

    -- 8. Global Profile Ratings
    UPDATE profiles SET breakpoint_rating = breakpoint_rating + v_p1_delta WHERE id = v_player1_id;
    UPDATE profiles SET breakpoint_rating = breakpoint_rating + v_p2_delta WHERE id = v_player2_id;

END;
$$;

GRANT EXECUTE ON FUNCTION finalize_match_stats TO authenticated;
