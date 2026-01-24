CREATE OR REPLACE FUNCTION get_race_target(
    p_rating1 numeric,
    p_rating2 numeric,
    p_game_type text -- '8ball' or '9ball'
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
    v_race int[];
    v_matrix int[][][]; -- 3D array: [row][col][p1, p2]
BEGIN
    -- 1. Helper Index Logic
    -- 0: <= 344 (was 275)
    -- 1: <= 436 (was 349)
    -- 2: <= 499 (was 399)
    -- 3: <= 561 (was 449)
    -- 4: <= 624 (was 499)
    -- 5: <= 686 (was 549)
    -- 6: <= 749 (was 599)
    -- 7: <= 875 (was 700)
    -- 8: > 875 (was > 700)
    
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

    -- 2. Define Matrix
    IF p_game_type = '9ball' THEN
        v_matrix := ARRAY[
            -- Row 0 (0-344)
            [[3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 8], [2, 8]],
            -- Row 1 (345-436)
            [[4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
            -- Row 2 (437-499)
            [[4, 3], [5, 4], [4, 4], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
            -- Row 3 (500-561)
            [[5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
            -- Row 4 (562-624)
            [[5, 3], [6, 4], [6, 4], [6, 5], [6, 6], [5, 6], [5, 7], [5, 8], [4, 8]], 
            -- Row 5 (625-686)
            [[6, 3], [6, 5], [6, 5], [6, 5], [6, 5], [6, 6], [6, 7], [5, 8], [5, 8]],
            -- Row 6 (687-749)
            [[6, 3], [7, 4], [7, 5], [7, 5], [7, 5], [7, 6], [6, 6], [6, 8], [5, 8]],
            -- Row 7 (750-875)
            [[8, 3], [8, 3], [7, 4], [8, 5], [8, 5], [8, 6], [8, 6], [7, 7], [7, 8]],
            -- Row 8 (876+)
            [[8, 2], [8, 3], [8, 3], [8, 3], [8, 4], [8, 5], [8, 5], [8, 7], [9, 9]]
        ];
    ELSE
        -- 8-Ball Matrix
        v_matrix := ARRAY[
            -- Row 0 (0-344)
            [[3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 7], [3, 7], [2, 7]],
            -- Row 1 (345-436)
            [[4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [3, 6], [3, 6], [3, 7]],
            -- Row 2 (437-499)
            [[5, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6], [3, 7]],
            -- Row 3 (500-561)
            [[5, 3], [5, 4], [5, 4], [5, 5], [5, 5], [4, 6], [4, 6], [4, 6], [3, 7]],
            -- Row 4 (562-624)
            [[6, 3], [5, 4], [5, 4], [5, 5], [5, 5], [5, 6], [4, 6], [4, 6], [4, 7]],
            -- Row 5 (625-686)
            [[6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 6], [4, 7]],
            -- Row 6 (687-749)
            [[7, 3], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 7]],
            -- Row 7 (750-875)
            [[7, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 7]],
            -- Row 8 (876+)
            [[7, 2], [7, 3], [7, 3], [7, 3], [7, 4], [7, 4], [7, 5], [7, 6], [7, 7]]
        ];
    END IF;

    -- 3. Lookup
    -- Access 1-based index for PL/pgSQL arrays
    -- v_matrix is 3D: [row][col][p1/p2]
    
    RETURN jsonb_build_object(
        'p1', v_matrix[v_idx1 + 1][v_idx2 + 1][1],
        'p2', v_matrix[v_idx1 + 1][v_idx2 + 1][2]
    );
END;
$$;
