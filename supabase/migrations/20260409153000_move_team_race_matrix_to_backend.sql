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
    v_pair INT[];
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

    v_pair := v_matrix[v_idx1][v_idx2];

    RETURN jsonb_build_object(
        'p1', v_pair[1],
        'p2', v_pair[2]
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_race_target(NUMERIC, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_team_match_submission_set_race()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_player_a_rating NUMERIC;
    v_player_b_rating NUMERIC;
    v_race JSONB;
BEGIN
    IF NEW.player_a_id IS NULL OR NEW.player_b_id IS NULL OR NEW.game_type IS NULL THEN
        NEW.race_p1 := NULL;
        NEW.race_p2 := NULL;
        RETURN NEW;
    END IF;

    SELECT breakpoint_rating
      INTO v_player_a_rating
    FROM public.profiles
    WHERE id = NEW.player_a_id;

    SELECT breakpoint_rating
      INTO v_player_b_rating
    FROM public.profiles
    WHERE id = NEW.player_b_id;

    v_race := public.get_team_race_target(
        COALESCE(v_player_a_rating, 500),
        COALESCE(v_player_b_rating, 500),
        NEW.game_type
    );

    NEW.race_p1 := (v_race->>'p1')::INT;
    NEW.race_p2 := (v_race->>'p2')::INT;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_match_submission_set_race_sync ON public.team_match_submission_sets;

CREATE TRIGGER team_match_submission_set_race_sync
BEFORE INSERT OR UPDATE
ON public.team_match_submission_sets
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_match_submission_set_race();
