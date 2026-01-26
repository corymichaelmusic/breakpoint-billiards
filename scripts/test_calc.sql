DO $$
DECLARE
    v_p1_rating numeric := 810.0;
    v_p2_rating numeric := 480.0;
    
    v_p1_delta_1 numeric;
    v_p2_delta_1 numeric;
    
    v_p1_delta_2 numeric;
    v_p2_delta_2 numeric;
    
    v_k_racks int := 200; -- Established (K=20)
BEGIN
    RAISE NOTICE '--- INITIAL STATE ---';
    RAISE NOTICE 'Player 1: %', v_p1_rating;
    RAISE NOTICE 'Player 2: %', v_p2_rating;
    RAISE NOTICE '';

    -- SET 1: 8-Ball
    -- Race: 6-3
    -- Score: 3-1 (P2 wins)
    
    -- Calculate P1 Delta (Lost)
    v_p1_delta_1 := calculate_bbrs_delta(
        v_p1_rating, v_p2_rating, 
        1, 3, -- Scores: P1=1, P2=3
        v_k_racks, 
        TRUE, -- League
        FALSE, -- P1 Lost
        6, 3   -- Handicap
    );
    
    -- Calculate P2 Delta (Won)
    v_p2_delta_1 := calculate_bbrs_delta(
        v_p2_rating, v_p1_rating, 
        3, 1, -- Scores: P2=3, P1=1
        v_k_racks, 
        TRUE, -- League
        TRUE, -- P2 Won
        3, 6   -- Handicap (Opponent race is 6)
    );
    
    RAISE NOTICE '--- SET 1 (8-Ball) ---';
    RAISE NOTICE 'Match: P1(6) vs P2(3). Score 1-3. P2 Wins.';
    RAISE NOTICE 'P1 Delta: %', v_p1_delta_1;
    RAISE NOTICE 'P2 Delta: %', v_p2_delta_1;
    
    -- Update Ratings
    v_p1_rating := v_p1_rating + v_p1_delta_1;
    v_p2_rating := v_p2_rating + v_p2_delta_1;
    
    RAISE NOTICE 'New P1: %', v_p1_rating;
    RAISE NOTICE 'New P2: %', v_p2_rating;
    RAISE NOTICE '';
    
    -- SET 2: 9-Ball
    -- Race: 8-3
    -- Score: 8-2 (P1 wins)
    
    -- Calculate P1 Delta (Won)
    v_p1_delta_2 := calculate_bbrs_delta(
        v_p1_rating, v_p2_rating, 
        8, 2, -- Scores: P1=8, P2=2
        v_k_racks, 
        TRUE, 
        TRUE, -- P1 Won
        8, 3
    );
    
    -- Calculate P2 Delta (Lost)
    v_p2_delta_2 := calculate_bbrs_delta(
        v_p2_rating, v_p1_rating, 
        2, 8, -- Scores: P2=2, P1=8
        v_k_racks, 
        TRUE, 
        FALSE, -- P2 Lost
        3, 8
    );
    
    RAISE NOTICE '--- SET 2 (9-Ball) ---';
    RAISE NOTICE 'Match: P1(8) vs P2(3). Score 8-2. P1 Wins.';
    RAISE NOTICE 'P1 Delta: %', v_p1_delta_2;
    RAISE NOTICE 'P2 Delta: %', v_p2_delta_2;
    
    -- Final Ratings
    v_p1_rating := v_p1_rating + v_p1_delta_2;
    v_p2_rating := v_p2_rating + v_p2_delta_2;
    
    RAISE NOTICE '';
    RAISE NOTICE '--- FINAL STANDINGS ---';
    RAISE NOTICE 'Player 1: % (Display: %)', v_p1_rating, floor(v_p1_rating/10.0)/10.0;
    RAISE NOTICE 'Player 2: % (Display: %)', v_p2_rating, floor(v_p2_rating/10.0)/10.0;
END $$;
