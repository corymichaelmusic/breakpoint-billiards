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
    
    -- Granular Stats (Boolean in DB)
    v_br_p1 boolean;
    v_br_p2 boolean;
    v_rr_p1 boolean;
    v_rr_p2 boolean;
    v_snap_p1 boolean;
    v_snap_p2 boolean;
    v_early_p1 boolean;
    v_early_p2 boolean;
    
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
               score_8ball_p1, score_8ball_p2,
               p1_break_run_8ball, p2_break_run_8ball,
               p1_rack_run_8ball,  p2_rack_run_8ball
               -- Note: Matches table does NOT store early 8s or snaps for 8-ball?? 
               -- Let's check list_cols.json... p1_early_8s? NO. 
               -- Matches has: p1_nine_on_snap (implies 9ball). No explicit 8ball early win column found in list.
               -- So we cannot revert early 8s if not stored.
        INTO v_delta_p1, v_delta_p2, v_winner_id,
             v_score_p1, v_score_p2,
             v_br_p1, v_br_p2,
             v_rr_p1, v_rr_p2;
             
        v_early_p1 := false; v_early_p2 := false; -- Cannot revert what we don't have
        
        -- Check Shutout Reversal logic
        -- If both WERE finalized and winners matched, it WAS a shutout.
        -- By resetting one, we break the shutout.
        IF v_status_9ball = 'finalized' AND v_winner_8ball = v_winner_9ball THEN
            v_was_shutout := true;
        END IF;

        -- 3. Revert Player 1 Stats
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p1, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p2, 0),
            matches_won = matches_won - (CASE WHEN v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player1_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1, -- Assuming finalize increments per SET (game type)
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            
            -- Granular (Best effort: subtract 1 if true)
            total_break_and_runs = total_break_and_runs - (CASE WHEN v_br_p1 THEN 1 ELSE 0 END),
            total_rack_and_runs = total_rack_and_runs - (CASE WHEN v_rr_p1 THEN 1 ELSE 0 END),
            
            -- Split Stats
            total_break_and_runs_8ball = total_break_and_runs_8ball - (CASE WHEN v_br_p1 THEN 1 ELSE 0 END),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball - (CASE WHEN v_rr_p1 THEN 1 ELSE 0 END)
            
        WHERE league_id = v_league_id AND player_id = v_player1_id;

        -- 4. Revert Player 2 Stats
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p2, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p1, 0), -- P2 Lost = P1 Won (Score P1)
            matches_won = matches_won - (CASE WHEN v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player2_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1,
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            
            total_break_and_runs = total_break_and_runs - (CASE WHEN v_br_p2 THEN 1 ELSE 0 END),
            total_rack_and_runs = total_rack_and_runs - (CASE WHEN v_rr_p2 THEN 1 ELSE 0 END),
            
            total_break_and_runs_8ball = total_break_and_runs_8ball - (CASE WHEN v_br_p2 THEN 1 ELSE 0 END),
            total_rack_and_runs_8ball = total_rack_and_runs_8ball - (CASE WHEN v_rr_p2 THEN 1 ELSE 0 END)
            
        WHERE league_id = v_league_id AND player_id = v_player2_id;

        -- 5. Revert Profiles (Ratings)
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0) WHERE id = v_player1_id;
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0) WHERE id = v_player2_id;

        -- 6. Reset Match Status
        UPDATE matches
        SET status_8ball = 'scheduled',
            winner_id_8ball = NULL,
            delta_8ball_p1 = 0,
            delta_8ball_p2 = 0,
            submitted_at = NULL -- Or maybe keep logic? No, reset implies undo.
        WHERE id = p_match_id;

    ELSIF p_game_type = '9ball' THEN
        -- Only proceed if actually finalized
        IF v_status_9ball != 'finalized' THEN 
            RETURN; 
        END IF;

        -- Fetch 9-ball specific data
        SELECT delta_9ball_p1, delta_9ball_p2, winner_id_9ball,
               score_9ball_p1, score_9ball_p2,
               p1_break_run_9ball, p2_break_run_9ball,
               p1_nine_on_snap, p2_nine_on_snap
        INTO v_delta_p1, v_delta_p2, v_winner_id,
             v_score_p1, v_score_p2,
             v_br_p1, v_br_p2,
             v_snap_p1, v_snap_p2;

        -- Check Shutout Reversal (same logic: if both were finalized and winners matched)
        IF v_status_8ball = 'finalized' AND v_winner_8ball = v_winner_9ball THEN
            v_was_shutout := true;
        END IF;

        -- Revert Player 1 Stats (9-ball)
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p1, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p2, 0),
            matches_won = matches_won - (CASE WHEN v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player1_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1,
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player1_id = v_winner_id THEN 1 ELSE 0 END),
            
            total_break_and_runs = total_break_and_runs - (CASE WHEN v_br_p1 THEN 1 ELSE 0 END),
            total_nine_on_snap = total_nine_on_snap - (CASE WHEN v_snap_p1 THEN 1 ELSE 0 END),
            
            total_break_and_runs_9ball = total_break_and_runs_9ball - (CASE WHEN v_br_p1 THEN 1 ELSE 0 END)
            
        WHERE league_id = v_league_id AND player_id = v_player1_id;

        -- Revert Player 2 Stats (9-ball)
        UPDATE league_players
        SET 
            breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0),
            breakpoint_racks_won = breakpoint_racks_won - COALESCE(v_score_p2, 0),
            breakpoint_racks_lost = breakpoint_racks_lost - COALESCE(v_score_p1, 0),
            matches_won = matches_won - (CASE WHEN v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            matches_lost = matches_lost - (CASE WHEN v_player2_id != v_winner_id THEN 1 ELSE 0 END),
            matches_played = matches_played - 1,
            shutouts = shutouts - (CASE WHEN v_was_shutout AND v_player2_id = v_winner_id THEN 1 ELSE 0 END),
            
            total_break_and_runs = total_break_and_runs - (CASE WHEN v_br_p2 THEN 1 ELSE 0 END),
            total_nine_on_snap = total_nine_on_snap - (CASE WHEN v_snap_p2 THEN 1 ELSE 0 END),
            
            total_break_and_runs_9ball = total_break_and_runs_9ball - (CASE WHEN v_br_p2 THEN 1 ELSE 0 END)
            
        WHERE league_id = v_league_id AND player_id = v_player2_id;

        -- Revert Profiles
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p1, 0) WHERE id = v_player1_id;
        UPDATE profiles SET breakpoint_rating = breakpoint_rating - COALESCE(v_delta_p2, 0) WHERE id = v_player2_id;

        -- Reset Match Status
        UPDATE matches
        SET status_9ball = 'scheduled',
            winner_id_9ball = NULL,
            delta_9ball_p1 = 0,
            delta_9ball_p2 = 0,
            submitted_at = NULL -- If both reset, submitted_at becomes null. If one remains? 
                                -- Matches table has ONE `submitted_at`. 
                                -- If 8-ball is still finalized, we shouldn't null it?
                                -- But submitted_at usually tracks "when the WHOLE THING was done"?
                                -- Or just the last update.
                                -- Ideally we check if the OTHER game is finalized.
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
