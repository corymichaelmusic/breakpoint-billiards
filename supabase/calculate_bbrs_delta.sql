-- BBRS (Breakpoint Billiards Rating System) Calculation
-- This function contains the proprietary rating algorithm
-- It runs entirely server-side and is never exposed to clients
-- SECURITY DEFINER ensures it runs with elevated privileges

-- Drop old signature to prevent ambiguity
DROP FUNCTION IF EXISTS calculate_bbrs_delta(numeric, numeric, int, int, int, boolean);

-- Core calculation function
CREATE OR REPLACE FUNCTION calculate_bbrs_delta(
    p_player_rating NUMERIC,
    p_opponent_rating NUMERIC,
    p_player_score INT,
    p_opponent_score INT,
    p_player_racks_played INT,
    p_is_league BOOLEAN DEFAULT TRUE,
    p_did_win BOOLEAN DEFAULT NULL -- Explicit win status for handicaps
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expected_win_prob NUMERIC;
    v_k_factor NUMERIC;
    v_actual_outcome INT;
    v_base_delta NUMERIC;
    v_opponent_scaling NUMERIC;
    v_total_racks INT;
    v_expected_score_player NUMERIC;
    v_expected_score_opponent NUMERIC;
    v_expected_diff NUMERIC;
    v_actual_diff NUMERIC;
    v_match_modifier NUMERIC;
    v_event_weight NUMERIC;
    v_final_delta NUMERIC;
BEGIN
    -- 1. Calculate Expected Win Probability (Elo-derived)
    v_expected_win_prob := 1.0 / (1.0 + POWER(10, (p_opponent_rating - p_player_rating) / 400.0));
    
    -- 2. Determine K-Factor based on experience (racks played)
    IF p_player_racks_played < 100 THEN
        v_k_factor := 28;  -- Provisional
    ELSIF p_player_racks_played < 300 THEN
        v_k_factor := 20;  -- Established
    ELSE
        v_k_factor := 14;  -- Stable
    END IF;
    
    -- 3. Determine Outcome (1 for win, 0 for loss)
    -- Priority: Explicit p_did_win (for handicaps) > Score Comparison
    IF p_did_win IS NOT NULL THEN
        IF p_did_win THEN
            v_actual_outcome := 1;
        ELSE
            v_actual_outcome := 0;
        END IF;
    ELSIF p_player_score > p_opponent_score THEN
        v_actual_outcome := 1;
    ELSE
        v_actual_outcome := 0;
    END IF;
    
    -- 4. Calculate Base Delta
    v_base_delta := v_k_factor * (v_actual_outcome - v_expected_win_prob);
    
    -- 5. Apply Opponent Strength Scaling
    -- Cap scaling between 0.85 (beating much weaker) and 1.15 (beating much stronger)
    v_opponent_scaling := 1.0 + ((p_opponent_rating - p_player_rating) / 1000.0);
    v_opponent_scaling := GREATEST(0.85, LEAST(1.15, v_opponent_scaling));
    
    v_final_delta := v_base_delta * v_opponent_scaling;
    
    -- 6. Apply Match Modifier (Margin of Victory)
    -- M = 1 + min(0.10, (ActualRackDiff - ExpectedRackDiff) / 20)
    v_total_racks := p_player_score + p_opponent_score;
    v_expected_score_player := v_total_racks * v_expected_win_prob;
    v_expected_score_opponent := v_total_racks * (1.0 - v_expected_win_prob);
    v_expected_diff := v_expected_score_player - v_expected_score_opponent;
    v_actual_diff := p_player_score - p_opponent_score;
    
    -- Calculate bonus/penalty capped at +/- 10%
    v_match_modifier := 1.0 + GREATEST(-0.10, LEAST(0.10, (v_actual_diff - v_expected_diff) / 20.0));
    v_final_delta := v_final_delta * v_match_modifier;
    
    -- 7. Apply Event Weight
    IF p_is_league THEN
        v_event_weight := 1.0;    -- League matches
    ELSE
        v_event_weight := 1.08;   -- Tournament matches
    END IF;
    v_final_delta := v_final_delta * v_event_weight;
    
    RETURN v_final_delta;
END;
$$;

-- Grant execute permission to authenticated users (they can call it via RPC)
-- but the algorithm itself remains hidden
GRANT EXECUTE ON FUNCTION calculate_bbrs_delta TO authenticated;

COMMENT ON FUNCTION calculate_bbrs_delta IS 'Proprietary BBRS rating calculation. Runs server-side only.';
