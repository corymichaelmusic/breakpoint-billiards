CREATE OR REPLACE FUNCTION public.get_team_race_target(
    p_rating1 NUMERIC,
    p_rating2 NUMERIC,
    p_game_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_r1 NUMERIC := COALESCE(p_rating1, 500);
    v_r2 NUMERIC := COALESCE(p_rating2, 500);
    v_idx1 INT;
    v_idx2 INT;
    v_matrix INT[][][];
BEGIN
    v_idx1 := CASE
        WHEN v_r1 <= 344 THEN 1
        WHEN v_r1 <= 436 THEN 2
        WHEN v_r1 <= 499 THEN 3
        WHEN v_r1 <= 561 THEN 4
        WHEN v_r1 <= 624 THEN 5
        WHEN v_r1 <= 686 THEN 6
        WHEN v_r1 <= 749 THEN 7
        WHEN v_r1 <= 875 THEN 8
        ELSE 9
    END;

    v_idx2 := CASE
        WHEN v_r2 <= 344 THEN 1
        WHEN v_r2 <= 436 THEN 2
        WHEN v_r2 <= 499 THEN 3
        WHEN v_r2 <= 561 THEN 4
        WHEN v_r2 <= 624 THEN 5
        WHEN v_r2 <= 686 THEN 6
        WHEN v_r2 <= 749 THEN 7
        WHEN v_r2 <= 875 THEN 8
        ELSE 9
    END;

    IF p_game_type = '9ball' THEN
        v_matrix := ARRAY[
            [[3, 3], [3, 4], [3, 4], [2, 5], [2, 5], [2, 5], [2, 5], [2, 6], [2, 6]],
            [[4, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 6], [2, 6]],
            [[4, 3], [4, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 6], [2, 6]],
            [[4, 3], [4, 3], [4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6]],
            [[4, 3], [5, 3], [5, 3], [5, 4], [5, 5], [4, 5], [4, 6], [4, 6], [3, 6]],
            [[5, 2], [5, 4], [5, 4], [5, 4], [5, 4], [5, 5], [5, 6], [4, 6], [4, 6]],
            [[5, 2], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [4, 6]],
            [[6, 2], [6, 2], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 6]],
            [[6, 2], [6, 2], [6, 2], [6, 2], [6, 3], [6, 4], [6, 4], [6, 6], [6, 6]]
        ];
    ELSE
        v_matrix := ARRAY[
            [[3, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 5], [2, 5], [2, 5], [2, 5]],
            [[3, 3], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [2, 5], [2, 5], [2, 5]],
            [[4, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [2, 5], [2, 5]],
            [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [3, 5], [3, 5], [3, 5], [2, 5]],
            [[5, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [3, 5], [3, 5], [3, 5]],
            [[5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5], [3, 5]],
            [[5, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5]],
            [[5, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 5]],
            [[5, 2], [5, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 5], [5, 5]]
        ];
    END IF;

    RETURN jsonb_build_object(
        'p1', v_matrix[v_idx1][v_idx2][1],
        'p2', v_matrix[v_idx1][v_idx2][2]
    );
END;
$$;

ALTER TABLE public.team_match_submission_sets
    DISABLE TRIGGER team_match_set_scorer_guard,
    DISABLE TRIGGER team_match_submission_verification_touch_sets;

UPDATE public.team_match_submission_sets tcss
SET
    race_p1 = (public.get_team_race_target(
        COALESCE(pa.breakpoint_rating, 500)::NUMERIC,
        COALESCE(pb.breakpoint_rating, 500)::NUMERIC,
        tcss.game_type
    )->>'p1')::INT,
    race_p2 = (public.get_team_race_target(
        COALESCE(pa.breakpoint_rating, 500)::NUMERIC,
        COALESCE(pb.breakpoint_rating, 500)::NUMERIC,
        tcss.game_type
    )->>'p2')::INT,
    updated_at = NOW()
FROM public.profiles pa, public.profiles pb
WHERE pa.id = tcss.player_a_id
  AND pb.id = tcss.player_b_id
  AND tcss.game_type IS NOT NULL;

ALTER TABLE public.team_match_submission_sets
    ENABLE TRIGGER team_match_set_scorer_guard,
    ENABLE TRIGGER team_match_submission_verification_touch_sets;
