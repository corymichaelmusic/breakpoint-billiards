CREATE OR REPLACE FUNCTION public.submit_team_match_for_verification(
    p_team_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_team_match RECORD;
    v_my_submission RECORD;
    v_other_submission RECORD;
    v_my_summary JSONB;
    v_other_summary JSONB;
    v_current_set RECORD;
    v_match_id UUID;
    v_set_id UUID;
    v_p1_racks INT;
    v_p2_racks INT;
    v_p1_break_runs INT;
    v_p2_break_runs INT;
    v_p1_rack_runs INT;
    v_p2_rack_runs INT;
    v_p1_snaps INT;
    v_p2_snaps INT;
    v_p1_early_8s INT;
    v_p2_early_8s INT;
    v_put_up_team_id UUID;
    v_set_count INT;
    v_my_set JSONB;
    v_other_set JSONB;
    v_my_games JSONB;
    v_other_games JSONB;
    v_my_game JSONB;
    v_other_game JSONB;
    v_game_index INT;
    v_set_number INT;
    v_dispute_message TEXT;
    v_8ball_wins_a INT := 0;
    v_8ball_wins_b INT := 0;
    v_9ball_wins_a INT := 0;
    v_9ball_wins_b INT := 0;
    v_overall_wins_a INT := 0;
    v_overall_wins_b INT := 0;
    v_overall_winner_name TEXT;
    v_winner_8ball_name TEXT;
    v_winner_9ball_name TEXT;
    v_verified_message TEXT;
BEGIN
    SELECT *
      INTO v_team_match
    FROM public.team_matches
    WHERE id = p_team_match_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Team match not found');
    END IF;

    SELECT tcs.*
      INTO v_my_submission
    FROM public.team_match_captain_submissions tcs
    JOIN public.teams t ON t.id = tcs.team_id
    WHERE tcs.team_match_id = p_team_match_id
      AND t.captain_id = v_user_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Only a captain in this match can submit verification');
    END IF;

    IF v_my_submission.put_up_first_team_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Record the coin flip before submitting the match');
    END IF;

    SELECT COUNT(*)
      INTO v_set_count
    FROM public.team_match_submission_sets
    WHERE captain_submission_id = v_my_submission.id
      AND status = 'completed';

    IF v_set_count <> 8 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'All 8 sets must be completed before match submission');
    END IF;

    UPDATE public.team_match_captain_submissions
    SET verification_status = 'submitted',
        submitted_for_verification_at = NOW(),
        updated_at = NOW()
    WHERE id = v_my_submission.id;

    SELECT *
      INTO v_other_submission
    FROM public.team_match_captain_submissions
    WHERE team_match_id = p_team_match_id
      AND team_id <> v_my_submission.team_id
    LIMIT 1;

    IF v_other_submission.id IS NULL OR v_other_submission.submitted_for_verification_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'waiting_for_opponent',
            'message', 'Your team match was submitted. Waiting for the other captain to verify.'
        );
    END IF;

    v_my_summary := public.team_match_submission_summary(v_my_submission.id);
    v_other_summary := public.team_match_submission_summary(v_other_submission.id);

    IF v_my_summary IS DISTINCT FROM v_other_summary THEN
        IF COALESCE(v_my_summary->>'coin_flip', '') IS DISTINCT FROM COALESCE(v_other_summary->>'coin_flip', '') THEN
            v_dispute_message := 'Coin flip does not match between captains. Review Set 1 put-up order and resubmit.';
        ELSE
            FOR v_set_number IN 1..8 LOOP
                SELECT value
                  INTO v_my_set
                FROM jsonb_array_elements(COALESCE(v_my_summary->'sets', '[]'::jsonb)) value
                WHERE (value->>'set_number')::INT = v_set_number
                LIMIT 1;

                SELECT value
                  INTO v_other_set
                FROM jsonb_array_elements(COALESCE(v_other_summary->'sets', '[]'::jsonb)) value
                WHERE (value->>'set_number')::INT = v_set_number
                LIMIT 1;

                IF v_my_set IS NULL OR v_other_set IS NULL THEN
                    v_dispute_message := format('Set %s does not match. One captain is missing that set.', v_set_number);
                    EXIT;
                END IF;

                IF COALESCE(v_my_set->>'game_type', '') IS DISTINCT FROM COALESCE(v_other_set->>'game_type', '') THEN
                    v_dispute_message := format('Set %s does not match. The game type is different between captain cards.', v_set_number);
                    EXIT;
                END IF;

                IF COALESCE(v_my_set->>'player_a_id', '') IS DISTINCT FROM COALESCE(v_other_set->>'player_a_id', '')
                   OR COALESCE(v_my_set->>'player_b_id', '') IS DISTINCT FROM COALESCE(v_other_set->>'player_b_id', '') THEN
                    v_dispute_message := format('Set %s does not match. The player matchup is different between captain cards.', v_set_number);
                    EXIT;
                END IF;

                IF COALESCE(v_my_set->>'winner_team_id', '') IS DISTINCT FROM COALESCE(v_other_set->>'winner_team_id', '') THEN
                    v_dispute_message := format('Set %s does not match. The winning team is different between captain cards.', v_set_number);
                    EXIT;
                END IF;

                v_my_games := COALESCE(v_my_set->'games', '[]'::jsonb);
                v_other_games := COALESCE(v_other_set->'games', '[]'::jsonb);

                IF jsonb_array_length(v_my_games) <> jsonb_array_length(v_other_games) THEN
                    v_dispute_message := format(
                        'Set %s does not match. Rack count differs (%s vs %s).',
                        v_set_number,
                        jsonb_array_length(v_my_games),
                        jsonb_array_length(v_other_games)
                    );
                    EXIT;
                END IF;

                IF v_my_games IS DISTINCT FROM v_other_games THEN
                    FOR v_game_index IN 0..GREATEST(jsonb_array_length(v_my_games), 1) - 1 LOOP
                        v_my_game := v_my_games -> v_game_index;
                        v_other_game := v_other_games -> v_game_index;

                        IF v_my_game IS DISTINCT FROM v_other_game THEN
                            v_dispute_message := format(
                                'Set %s does not match. Rack %s winner or rack stats are different between captain cards.',
                                v_set_number,
                                v_game_index + 1
                            );
                            EXIT;
                        END IF;
                    END LOOP;

                    IF v_dispute_message IS NOT NULL THEN
                        EXIT;
                    END IF;

                    v_dispute_message := format('Set %s does not match. Rack history is different between captain cards.', v_set_number);
                    EXIT;
                END IF;
            END LOOP;
        END IF;

        UPDATE public.team_match_captain_submissions
        SET verification_status = 'disputed',
            updated_at = NOW()
        WHERE id IN (v_my_submission.id, v_other_submission.id);

        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'disputed',
            'message', COALESCE(v_dispute_message, 'Captain submissions do not match. Review the sets and resubmit.')
        );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.team_match_sets
        WHERE team_match_id = p_team_match_id
    ) THEN
        UPDATE public.team_match_captain_submissions
        SET verification_status = 'verified',
            verified_at = NOW(),
            updated_at = NOW()
        WHERE id IN (v_my_submission.id, v_other_submission.id);

        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'verified',
            'message', 'Team match was already verified.'
        );
    END IF;

    UPDATE public.team_matches
    SET put_up_first_team_id = v_my_submission.put_up_first_team_id,
        status = 'in_progress'
    WHERE id = p_team_match_id;

    SELECT
        COUNT(*) FILTER (WHERE game_type = '8ball' AND winner_team_id = v_team_match.team_a_id),
        COUNT(*) FILTER (WHERE game_type = '8ball' AND winner_team_id = v_team_match.team_b_id),
        COUNT(*) FILTER (WHERE game_type = '9ball' AND winner_team_id = v_team_match.team_a_id),
        COUNT(*) FILTER (WHERE game_type = '9ball' AND winner_team_id = v_team_match.team_b_id),
        COUNT(*) FILTER (WHERE winner_team_id = v_team_match.team_a_id),
        COUNT(*) FILTER (WHERE winner_team_id = v_team_match.team_b_id)
    INTO
        v_8ball_wins_a,
        v_8ball_wins_b,
        v_9ball_wins_a,
        v_9ball_wins_b,
        v_overall_wins_a,
        v_overall_wins_b
    FROM public.team_match_submission_sets
    WHERE captain_submission_id = v_my_submission.id;

    UPDATE public.team_matches
    SET wins_a = COALESCE(v_overall_wins_a, 0),
        losses_a = COALESCE(v_overall_wins_b, 0),
        wins_b = COALESCE(v_overall_wins_b, 0),
        losses_b = COALESCE(v_overall_wins_a, 0)
    WHERE id = p_team_match_id;

    FOR v_current_set IN
        SELECT *
        FROM public.team_match_submission_sets
        WHERE captain_submission_id = v_my_submission.id
        ORDER BY set_number
    LOOP
        SELECT CASE
            WHEN MOD(v_current_set.set_number - 1, 2) = 0 THEN v_my_submission.put_up_first_team_id
            WHEN v_my_submission.put_up_first_team_id = v_team_match.team_a_id THEN v_team_match.team_b_id
            ELSE v_team_match.team_a_id
        END
        INTO v_put_up_team_id;

        INSERT INTO public.team_match_sets (
            team_match_id,
            set_number,
            game_type,
            player_a_id,
            player_b_id,
            put_up_team_id,
            winner_team_id
        )
        VALUES (
            p_team_match_id,
            v_current_set.set_number,
            v_current_set.game_type,
            v_current_set.player_a_id,
            v_current_set.player_b_id,
            v_put_up_team_id,
            v_current_set.winner_team_id
        )
        RETURNING id
        INTO v_set_id;

        INSERT INTO public.matches (
            league_id,
            player1_id,
            player2_id,
            week_number,
            is_team_match_set,
            status,
            verification_status,
            race_8ball_p1,
            race_8ball_p2,
            race_9ball_p1,
            race_9ball_p2
        )
        VALUES (
            v_team_match.league_id,
            v_current_set.player_a_id,
            v_current_set.player_b_id,
            v_team_match.week_number,
            TRUE,
            'in_progress',
            'verified',
            CASE WHEN v_current_set.game_type = '8ball' THEN v_current_set.race_p1 ELSE NULL END,
            CASE WHEN v_current_set.game_type = '8ball' THEN v_current_set.race_p2 ELSE NULL END,
            CASE WHEN v_current_set.game_type = '9ball' THEN v_current_set.race_p1 ELSE NULL END,
            CASE WHEN v_current_set.game_type = '9ball' THEN v_current_set.race_p2 ELSE NULL END
        )
        RETURNING id
        INTO v_match_id;

        UPDATE public.team_match_sets
        SET match_id = v_match_id
        WHERE id = v_set_id;

        SELECT
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_a_id),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_b_id),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_a_id AND COALESCE(g.is_break_and_run, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_b_id AND COALESCE(g.is_break_and_run, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_a_id AND COALESCE(g.is_rack_and_run, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_b_id AND COALESCE(g.is_rack_and_run, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_a_id AND COALESCE(g.is_9_on_snap, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_b_id AND COALESCE(g.is_9_on_snap, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_a_id AND COALESCE(g.is_early_8, FALSE)),
            COUNT(*) FILTER (WHERE g.winner_id = v_current_set.player_b_id AND COALESCE(g.is_early_8, FALSE))
        INTO
            v_p1_racks,
            v_p2_racks,
            v_p1_break_runs,
            v_p2_break_runs,
            v_p1_rack_runs,
            v_p2_rack_runs,
            v_p1_snaps,
            v_p2_snaps,
            v_p1_early_8s,
            v_p2_early_8s
        FROM public.team_match_submission_games g
        WHERE g.submission_set_id = v_current_set.id;

        INSERT INTO public.games (
            match_id,
            game_number,
            game_type,
            winner_id,
            is_break_and_run,
            is_rack_and_run,
            is_9_on_snap,
            is_early_8,
            is_scratch_8,
            scored_by,
            verification_status
        )
        SELECT
            v_match_id,
            game_number,
            v_current_set.game_type,
            winner_id,
            COALESCE(is_break_and_run, FALSE),
            COALESCE(is_rack_and_run, FALSE),
            COALESCE(is_9_on_snap, FALSE),
            COALESCE(is_early_8, FALSE),
            COALESCE(is_scratch_8, FALSE),
            v_my_submission.submitted_by,
            'verified'
        FROM public.team_match_submission_games
        WHERE submission_set_id = v_current_set.id
        ORDER BY game_number;

        PERFORM public.finalize_match_stats(
            v_match_id,
            v_current_set.game_type,
            '',
            v_p1_racks,
            v_p2_racks,
            v_p2_racks,
            v_p1_racks,
            0,
            0,
            v_p1_break_runs,
            v_p1_rack_runs,
            v_p1_snaps,
            v_p1_early_8s,
            v_p2_break_runs,
            v_p2_rack_runs,
            v_p2_snaps,
            v_p2_early_8s
        );
    END LOOP;

    UPDATE public.team_matches
    SET status = 'completed'
    WHERE id = p_team_match_id;

    SELECT
        CASE
            WHEN v_overall_wins_a > v_overall_wins_b THEN team_a.name
            WHEN v_overall_wins_b > v_overall_wins_a THEN team_b.name
            ELSE 'Tie'
        END,
        CASE
            WHEN v_8ball_wins_a > v_8ball_wins_b THEN team_a.name
            WHEN v_8ball_wins_b > v_8ball_wins_a THEN team_b.name
            ELSE 'Tie'
        END,
        CASE
            WHEN v_9ball_wins_a > v_9ball_wins_b THEN team_a.name
            WHEN v_9ball_wins_b > v_9ball_wins_a THEN team_b.name
            ELSE 'Tie'
        END
    INTO
        v_overall_winner_name,
        v_winner_8ball_name,
        v_winner_9ball_name
    FROM public.teams team_a, public.teams team_b
    WHERE team_a.id = v_team_match.team_a_id
      AND team_b.id = v_team_match.team_b_id;

    v_verified_message := format(
        'Team match verified. Overall: %s (%s-%s). 8-ball: %s (%s-%s). 9-ball: %s (%s-%s).',
        v_overall_winner_name,
        v_overall_wins_a,
        v_overall_wins_b,
        v_winner_8ball_name,
        v_8ball_wins_a,
        v_8ball_wins_b,
        v_winner_9ball_name,
        v_9ball_wins_a,
        v_9ball_wins_b
    );

    UPDATE public.team_match_captain_submissions
    SET verification_status = 'verified',
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id IN (v_my_submission.id, v_other_submission.id);

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'verified',
        'message', v_verified_message,
        'overall_wins_a', v_overall_wins_a,
        'overall_wins_b', v_overall_wins_b,
        'wins_8ball_a', v_8ball_wins_a,
        'wins_8ball_b', v_8ball_wins_b,
        'wins_9ball_a', v_9ball_wins_a,
        'wins_9ball_b', v_9ball_wins_b
    );
END;
$$;
