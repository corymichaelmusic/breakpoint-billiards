DROP FUNCTION IF EXISTS reset_match_stats(uuid, text);

CREATE OR REPLACE FUNCTION reset_match_stats(
    p_match_id uuid,
    p_game_type text -- '8ball' or '9ball'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_league_id uuid;
    v_player1_id text;
    v_player2_id text;
    v_winner_id text;
    
    -- Deltas stored in matches table
    v_delta_p1 numeric;
    v_delta_p2 numeric;
    
    -- Scores stored in matches table (implies Racks Won)
    v_score_p1 int;
    v_score_p2 int;
    
    -- Granular Stats (Computed from GAMES table for accuracy)
    v_br_p1 int;
    v_br_p2 int;
    v_rr_p1 int;
    v_rr_p2 int;
    v_snap_p1 int;
    v_snap_p2 int;
    v_early_p1 int;
    v_early_p2 int;
    
    -- Shutout check
    v_status_8ball text;
    v_status_9ball text;
    v_winner_8ball text;
    v_winner_9ball text;
    v_was_shutout boolean := false;
BEGIN
    -- 1. Get Match Details
    SELECT league_id, player1_id, player2_id, 
           status_8ball, status_9ball, winner_id_8ball, winner_id_9ball
    INTO v_league_id, v_player1_id, v_player2_id,
         v_status_8ball, v_status_9ball, v_winner_8ball, v_winner_9ball
    FROM matches WHERE id = p_match_id;

    -- 2. Determine Logic based on Game Type
    IF p_game_type = '8ball' THEN
        -- Only proceed if actually finalized
        IF v_status_8ball != 'finalized' THEN 
            RETURN; 
        END IF;

        -- Fetch 8-ball specific data stored in matches
        SELECT delta_8ball_p1, delta_8ball_p2, winner_id_8ball,
               score_8ball_p1, score_8ball_p2
        INTO v_delta_p1, v_delta_p2, v_winner_id,
             v_score_p1, v_score_p2
        FROM matches WHERE id = p_match_id;
        
        -- COMPUTING GRANULAR STATS FROM GAMES TABLE (Before Deletion)
        SELECT 
            COUNT(*) FILTER (WHERE winner_id = v_player1_id AND is_break_and_run) as br1,
            COUNT(*) FILTER (WHERE winner_id = v_player2_id AND is_break_and_run) as br2,
            COUNT(*) FILTER (WHERE winner_id = v_player1_id AND is_rack_and_run) as rr1,
            COUNT(*) FILTER (WHERE winner_id = v_player2_id AND is_rack_and_run) as rr2,
            COUNT(*) FILTER (WHERE winner_id = v_player1_id AND is_early_8) as early1,
            COUNT(*) FILTER (WHERE winner_id = v_player2_id AND is_early_8) as early2
        INTO v_br_p1, v_br_p2, v_rr_p1, v_rr_p2, v_early_p1, v_early_p2
        FROM games WHERE match_id = p_match_id AND game_type = '8ball';

        -- Check Shutout Reversal logic
        IF v_status_9ball = 'finalized' AND v_winner_8ball = v_winner_9ball THEN
            v_was_shutout := true;
        END IF;

        -- DELETE GAMES RECORDS (After Computing Stats)
        DELETE FROM games WHERE match_id = p_match_id AND game_type = '8ball';

        -- 3. Revert Player 1 Stats
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p1, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p2, 0),
            breakpoint_racks_played = breakpoint_racks_played - (COALESCE(v_score_p1, 0) + COALESCE(v_score_p2, 0)),
            matches_won = matches_won - (CASE WHEN v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player1_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1, 
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            
            -- Granular (Exact Counts)
            total_break_and_runs = total_break_and_runs - COALESCE(v_br_p1, 0),
            total_rack_and_runs = total_rack_and_runs - COALESCE(v_rr_p1, 0),
            total_early_8 = total_early_8 - COALESCE(v_early_p1, 0),
            
            -- Split Stats
            total_break_and_runs_8ball = total_break_and_runs_8ball - COALESCE(v_br_p1, 0),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball - COALESCE(v_rr_p1, 0)
            
        WHERE league_id = v_league_id AND player_id = v_player1_id;

        -- 4. Revert Player 2 Stats
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p2, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p1, 0), 
            breakpoint_racks_played = breakpoint_racks_played - (COALESCE(v_score_p1, 0) + COALESCE(v_score_p2, 0)),
            matches_won = matches_won - (CASE WHEN v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player2_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1,
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            
            total_break_and_runs = total_break_and_runs - COALESCE(v_br_p2, 0),
            total_rack_and_runs = total_rack_and_runs - COALESCE(v_rr_p2, 0),
            total_early_8 = total_early_8 - COALESCE(v_early_p2, 0),
            
            total_break_and_runs_8ball = total_break_and_runs_8ball - COALESCE(v_br_p2, 0),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball - COALESCE(v_rr_p2, 0)
            
        WHERE league_id = v_league_id AND player_id = v_player2_id;

        -- 5. Revert Profiles (Ratings)
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0) WHERE id = v_player1_id;
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0) WHERE id = v_player2_id;

        -- Reset Match Status AND Scores/Stats to prevent immediate re-finalization
        UPDATE matches
        SET status_8ball = 'scheduled',
            winner_id_8ball = NULL,
            delta_8ball_p1 = 0,
            delta_8ball_p2 = 0,
            submitted_at = NULL,
            score_8ball_p1 = 0,
            score_8ball_p2 = 0,
            p1_break_run_8ball = false,
            p2_break_run_8ball = false,
            p1_rack_run_8ball = false,
            p2_rack_run_8ball = false
        WHERE id = p_match_id;

    ELSIF p_game_type = '9ball' THEN
        -- Only proceed if actually finalized
        IF v_status_9ball != 'finalized' THEN 
            RETURN; 
        END IF;

        -- Fetch 9-ball specific data
        SELECT delta_9ball_p1, delta_9ball_p2, winner_id_9ball,
               score_9ball_p1, score_9ball_p2
        INTO v_delta_p1, v_delta_p2, v_winner_id,
             v_score_p1, v_score_p2
        FROM matches WHERE id = p_match_id;
        
        -- COMPUTING GRANULAR STATS FROM GAMES TABLE (Before Deletion)
        SELECT 
            COUNT(*) FILTER (WHERE winner_id = v_player1_id AND is_break_and_run) as br1,
            COUNT(*) FILTER (WHERE winner_id = v_player2_id AND is_break_and_run) as br2,
            COUNT(*) FILTER (WHERE winner_id = v_player1_id AND is_rack_and_run) as rr1,
            COUNT(*) FILTER (WHERE winner_id = v_player2_id AND is_rack_and_run) as rr2,
            COUNT(*) FILTER (WHERE winner_id = v_player1_id AND is_9_on_snap) as snap1,
            COUNT(*) FILTER (WHERE winner_id = v_player2_id AND is_9_on_snap) as snap2
        INTO v_br_p1, v_br_p2, v_rr_p1, v_rr_p2, v_snap_p1, v_snap_p2
        FROM games WHERE match_id = p_match_id AND game_type = '9ball';

        -- Check Shutout Reversal (same logic: if both were finalized and winners matched)
        IF v_status_8ball = 'finalized' AND v_winner_8ball = v_winner_9ball THEN
            v_was_shutout := true;
        END IF;

        -- DELETE GAMES RECORDS
        DELETE FROM games WHERE match_id = p_match_id AND game_type = '9ball';

        -- Revert Player 1 Stats (9-ball)
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p1, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p2, 0),
            breakpoint_racks_played = breakpoint_racks_played - (COALESCE(v_score_p1, 0) + COALESCE(v_score_p2, 0)),
            matches_won = matches_won - (CASE WHEN v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player1_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1,
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            
            total_break_and_runs = total_break_and_runs - COALESCE(v_br_p1, 0),
            total_nine_on_snap = total_nine_on_snap - COALESCE(v_snap_p1, 0),
            
            total_break_and_runs_9ball = total_break_and_runs_9ball - COALESCE(v_br_p1, 0)
            
        WHERE league_id = v_league_id AND player_id = v_player1_id;

        -- Revert Player 2 Stats (9-ball)
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p2, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p1, 0),
            breakpoint_racks_played = breakpoint_racks_played - (COALESCE(v_score_p1, 0) + COALESCE(v_score_p2, 0)),
            matches_won = matches_won - (CASE WHEN v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player2_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1,
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            
            total_break_and_runs = total_break_and_runs - COALESCE(v_br_p2, 0),
            total_nine_on_snap = total_nine_on_snap - COALESCE(v_snap_p2, 0),
            
            total_break_and_runs_9ball = total_break_and_runs_9ball - COALESCE(v_br_p2, 0)
            
        WHERE league_id = v_league_id AND player_id = v_player2_id;

        -- Revert Profiles
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0) WHERE id = v_player1_id;
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0) WHERE id = v_player2_id;

        -- Reset Match Status AND Scores/Stats
        UPDATE matches
        SET status_9ball = 'scheduled',
            winner_id_9ball = NULL,
            delta_9ball_p1 = 0,
            delta_9ball_p2 = 0,
            submitted_at = NULL,
            score_9ball_p1 = 0,
            score_9ball_p2 = 0,
            p1_break_run_9ball = false,
            p2_break_run_9ball = false,
            p1_nine_on_snap = false,
            p2_nine_on_snap = false
        WHERE id = p_match_id;
        
        -- Fix submitted_at only if valid
        IF v_status_8ball = 'finalized' THEN
            -- Leave it (it reflects the 8ball finalization time roughly)
        ELSE
            -- Both are now NOT formalized (since we just reset 9ball and 8ball wasn't)
            UPDATE matches SET submitted_at = NULL WHERE id = p_match_id;
        END IF;

    END IF;
    
    -- Special logic for submitted_at cleanup in 8ball block
    IF p_game_type = '8ball' THEN
         IF v_status_9ball != 'finalized' THEN
             UPDATE matches SET submitted_at = NULL WHERE id = p_match_id;
         END IF;
    END IF;

END;
$$;
GRANT EXECUTE ON FUNCTION reset_match_stats TO authenticated;
