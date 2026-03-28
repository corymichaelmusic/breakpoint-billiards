-- Function to handle when a team match set (which is a standard 'matches' row with is_team_match_set = true) is finalized.
-- It updates the corresponding team_match_sets row and increments the wins/losses on the team_matches table.

CREATE OR REPLACE FUNCTION public.handle_team_match_set_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_team_match_set RECORD;
    v_winner_team_id UUID;
    v_game_type TEXT;
    v_team_a_id UUID;
    v_team_b_id UUID;
BEGIN
    -- Only proceed if the match is a team match set
    IF NEW.is_team_match_set = true THEN
        
        -- Get the team match set
        SELECT * INTO v_team_match_set FROM public.team_match_sets WHERE match_id = NEW.id;
        
        IF FOUND AND v_team_match_set.winner_team_id IS NULL THEN
            v_game_type := v_team_match_set.game_type;
            
            -- Determine match winner based on game type
            IF v_game_type = '8ball' AND NEW.status_8ball = 'finalized' AND OLD.status_8ball IS DISTINCT FROM 'finalized' THEN
                -- Check who won
                IF NEW.winner_id_8ball = v_team_match_set.player_a_id THEN
                    v_winner_team_id := (SELECT team_a_id FROM public.team_matches WHERE id = v_team_match_set.team_match_id);
                ELSIF NEW.winner_id_8ball = v_team_match_set.player_b_id THEN
                    v_winner_team_id := (SELECT team_b_id FROM public.team_matches WHERE id = v_team_match_set.team_match_id);
                END IF;
            ELSIF v_game_type = '9ball' AND NEW.status_9ball = 'finalized' AND OLD.status_9ball IS DISTINCT FROM 'finalized' THEN
                IF NEW.winner_id_9ball = v_team_match_set.player_a_id THEN
                    v_winner_team_id := (SELECT team_a_id FROM public.team_matches WHERE id = v_team_match_set.team_match_id);
                ELSIF NEW.winner_id_9ball = v_team_match_set.player_b_id THEN
                    v_winner_team_id := (SELECT team_b_id FROM public.team_matches WHERE id = v_team_match_set.team_match_id);
                END IF;
            END IF;

            -- If we found a winning team, update the team_match_sets and team_matches
            IF v_winner_team_id IS NOT NULL THEN
                -- 1. Update team_match_sets
                UPDATE public.team_match_sets 
                SET winner_team_id = v_winner_team_id
                WHERE id = v_team_match_set.id;

                -- 2. Update team_matches score
                SELECT team_a_id, team_b_id INTO v_team_a_id, v_team_b_id 
                FROM public.team_matches 
                WHERE id = v_team_match_set.team_match_id;

                IF v_winner_team_id = v_team_a_id THEN
                    UPDATE public.team_matches 
                    SET wins_a = COALESCE(wins_a, 0) + 1, losses_b = COALESCE(losses_b, 0) + 1
                    WHERE id = v_team_match_set.team_match_id;
                ELSIF v_winner_team_id = v_team_b_id THEN
                    UPDATE public.team_matches 
                    SET wins_b = COALESCE(wins_b, 0) + 1, losses_a = COALESCE(losses_a, 0) + 1
                    WHERE id = v_team_match_set.team_match_id;
                END IF;
                
                -- Check if match is complete (wins_a + wins_b = 8)
                -- (Can be handled here or separately. For now, we just update the scores.)
                -- Optional: If wins_a + wins_b >= 8, set status to 'completed'
                UPDATE public.team_matches
                SET status = 'completed'
                WHERE id = v_team_match_set.team_match_id
                AND (COALESCE(wins_a, 0) + COALESCE(wins_b, 0) >= 8);
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_match_finalized_for_teams ON public.matches;

-- Create the trigger
CREATE TRIGGER on_match_finalized_for_teams
AFTER UPDATE ON public.matches
FOR EACH ROW
WHEN (NEW.is_team_match_set = true)
EXECUTE FUNCTION public.handle_team_match_set_completion();
