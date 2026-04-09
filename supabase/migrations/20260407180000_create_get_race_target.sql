CREATE OR REPLACE FUNCTION public.get_race_target(
    p_rating1 numeric,
    p_rating2 numeric,
    p_game_type text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_r1 int := COALESCE(p_rating1, 500);
    v_r2 int := COALESCE(p_rating2, 500);
    v_idx1 int;
    v_idx2 int;
    v_matrix int[][][];
BEGIN
    SELECT CASE
        WHEN v_r1 <= 344 THEN 0
        WHEN v_r1 <= 436 THEN 1
        WHEN v_r1 <= 499 THEN 2
        WHEN v_r1 <= 561 THEN 3
        WHEN v_r1 <= 624 THEN 4
        WHEN v_r1 <= 686 THEN 5
        WHEN v_r1 <= 749 THEN 6
        WHEN v_r1 <= 875 THEN 7
        ELSE 8
    END INTO v_idx1;

    SELECT CASE
        WHEN v_r2 <= 344 THEN 0
        WHEN v_r2 <= 436 THEN 1
        WHEN v_r2 <= 499 THEN 2
        WHEN v_r2 <= 561 THEN 3
        WHEN v_r2 <= 624 THEN 4
        WHEN v_r2 <= 686 THEN 5
        WHEN v_r2 <= 749 THEN 6
        WHEN v_r2 <= 875 THEN 7
        ELSE 8
    END INTO v_idx2;

    -- BIS Short Race Matrices
    IF p_game_type = '9ball' THEN
        v_matrix := ARRAY[
            [[2, 2], [2, 3], [2, 3], [2, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 6]],
            [[3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 6], [3, 6]],
            [[3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 6], [3, 6]],
            [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 4], [4, 5], [4, 6], [3, 6]],
            [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 4], [4, 5], [4, 6], [3, 6]],
            [[4, 2], [4, 3], [4, 4], [4, 4], [4, 4], [4, 4], [4, 5], [4, 6], [4, 6]],
            [[5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [4, 4], [4, 6], [4, 6]],
            [[6, 2], [6, 3], [5, 3], [6, 4], [6, 4], [6, 4], [6, 4], [5, 5], [5, 6]],
            [[6, 2], [6, 3], [6, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 6]]
        ];
    ELSE
        v_matrix := ARRAY[
            [[2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 5], [2, 5]],
            [[3, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 5]],
            [[3, 2], [3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 5]],
            [[4, 2], [3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 5]],
            [[4, 2], [4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [3, 5]],
            [[4, 2], [4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 5]],
            [[5, 2], [4, 2], [4, 3], [4, 3], [5, 4], [5, 4], [4, 4], [4, 5], [4, 5]],
            [[5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 5], [4, 5]],
            [[5, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 5]]
        ];
    END IF;

    RETURN jsonb_build_object(
        'p1', v_matrix[v_idx1 + 1][v_idx2 + 1][1],
        'p2', v_matrix[v_idx1 + 1][v_idx2 + 1][2]
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_race_target(numeric, numeric, text) TO authenticated;
