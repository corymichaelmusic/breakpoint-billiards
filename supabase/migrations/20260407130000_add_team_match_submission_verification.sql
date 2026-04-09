CREATE TABLE IF NOT EXISTS public.team_match_captain_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_match_id UUID NOT NULL REFERENCES public.team_matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    submitted_by TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    put_up_first_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (verification_status IN ('draft', 'submitted', 'disputed', 'verified')),
    submitted_for_verification_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_match_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.team_match_submission_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    captain_submission_id UUID NOT NULL REFERENCES public.team_match_captain_submissions(id) ON DELETE CASCADE,
    set_number INT NOT NULL CHECK (set_number >= 1 AND set_number <= 8),
    game_type TEXT NOT NULL CHECK (game_type IN ('8ball', '9ball')),
    player_a_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    player_b_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    race_p1 INT,
    race_p2 INT,
    winner_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(captain_submission_id, set_number)
);

CREATE TABLE IF NOT EXISTS public.team_match_submission_games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_set_id UUID NOT NULL REFERENCES public.team_match_submission_sets(id) ON DELETE CASCADE,
    game_number INT NOT NULL,
    winner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_break_and_run BOOLEAN NOT NULL DEFAULT FALSE,
    is_rack_and_run BOOLEAN NOT NULL DEFAULT FALSE,
    is_9_on_snap BOOLEAN NOT NULL DEFAULT FALSE,
    is_early_8 BOOLEAN NOT NULL DEFAULT FALSE,
    is_scratch_8 BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(submission_set_id, game_number)
);

CREATE INDEX IF NOT EXISTS idx_team_match_captain_submissions_match
    ON public.team_match_captain_submissions(team_match_id);

CREATE INDEX IF NOT EXISTS idx_team_match_submission_sets_submission
    ON public.team_match_submission_sets(captain_submission_id, set_number);

CREATE INDEX IF NOT EXISTS idx_team_match_submission_games_set
    ON public.team_match_submission_games(submission_set_id, game_number);

ALTER TABLE public.team_match_captain_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_submission_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_submission_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all team captain submissions" ON public.team_match_captain_submissions;
DROP POLICY IF EXISTS "Operators can manage team captain submissions in their leagues" ON public.team_match_captain_submissions;
DROP POLICY IF EXISTS "Captains can manage their own team captain submissions" ON public.team_match_captain_submissions;

CREATE POLICY "Admins can manage all team captain submissions"
  ON public.team_match_captain_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  );

CREATE POLICY "Operators can manage team captain submissions in their leagues"
  ON public.team_match_captain_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.league_operators lo ON lo.league_id = tm.league_id
      WHERE tm.id = team_match_captain_submissions.team_match_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tm.id = team_match_captain_submissions.team_match_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.league_operators lo ON lo.league_id = tm.league_id
      WHERE tm.id = team_match_captain_submissions.team_match_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tm.id = team_match_captain_submissions.team_match_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Captains can manage their own team captain submissions"
  ON public.team_match_captain_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_match_captain_submissions.team_id
        AND t.captain_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_match_captain_submissions.team_id
        AND t.captain_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "Admins can manage all team submission sets" ON public.team_match_submission_sets;
DROP POLICY IF EXISTS "Operators can manage team submission sets in their leagues" ON public.team_match_submission_sets;
DROP POLICY IF EXISTS "Captains can manage their own team submission sets" ON public.team_match_submission_sets;

CREATE POLICY "Admins can manage all team submission sets"
  ON public.team_match_submission_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  );

CREATE POLICY "Operators can manage team submission sets in their leagues"
  ON public.team_match_submission_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.league_operators lo ON lo.league_id = tm.league_id
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.league_operators lo ON lo.league_id = tm.league_id
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Captains can manage their own team submission sets"
  ON public.team_match_submission_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      JOIN public.teams t ON t.id = tcs.team_id
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND t.captain_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      JOIN public.teams t ON t.id = tcs.team_id
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND t.captain_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "Admins can manage all team submission games" ON public.team_match_submission_games;
DROP POLICY IF EXISTS "Operators can manage team submission games in their leagues" ON public.team_match_submission_games;
DROP POLICY IF EXISTS "Captains can manage their own team submission games" ON public.team_match_submission_games;

CREATE POLICY "Admins can manage all team submission games"
  ON public.team_match_submission_games
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  );

CREATE POLICY "Operators can manage team submission games in their leagues"
  ON public.team_match_submission_games
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.league_operators lo ON lo.league_id = tm.league_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.league_operators lo ON lo.league_id = tm.league_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      JOIN public.team_matches tm ON tm.id = tcs.team_match_id
      JOIN public.leagues l ON l.id = tm.league_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Captains can manage their own team submission games"
  ON public.team_match_submission_games
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      JOIN public.teams t ON t.id = tcs.team_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND t.captain_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      JOIN public.teams t ON t.id = tcs.team_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND t.captain_id = (auth.jwt() ->> 'sub')
    )
  );

DROP FUNCTION IF EXISTS public.team_match_submission_summary(UUID);

CREATE OR REPLACE FUNCTION public.team_match_submission_summary(
    p_captain_submission_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT jsonb_build_object(
        'coin_flip', tcs.put_up_first_team_id,
        'sets',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'set_number', tcss.set_number,
                        'game_type', tcss.game_type,
                        'player_a_id', tcss.player_a_id,
                        'player_b_id', tcss.player_b_id,
                        'winner_team_id', tcss.winner_team_id,
                        'games', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'game_number', g.game_number,
                                        'winner_id', g.winner_id,
                                        'is_break_and_run', COALESCE(g.is_break_and_run, FALSE),
                                        'is_rack_and_run', COALESCE(g.is_rack_and_run, FALSE),
                                        'is_9_on_snap', COALESCE(g.is_9_on_snap, FALSE),
                                        'is_early_8', COALESCE(g.is_early_8, FALSE),
                                        'is_scratch_8', COALESCE(g.is_scratch_8, FALSE)
                                    )
                                    ORDER BY g.game_number
                                )
                                FROM public.team_match_submission_games g
                                WHERE g.submission_set_id = tcss.id
                            ),
                            '[]'::jsonb
                        )
                    )
                    ORDER BY tcss.set_number
                )
                FROM public.team_match_submission_sets tcss
                WHERE tcss.captain_submission_id = tcs.id
            ),
            '[]'::jsonb
        )
    )
    FROM public.team_match_captain_submissions tcs
    WHERE tcs.id = p_captain_submission_id;
$$;

GRANT EXECUTE ON FUNCTION public.team_match_submission_summary(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.submit_team_match_for_verification(UUID);

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
    v_races_8 JSONB;
    v_races_9 JSONB;
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
        UPDATE public.team_match_captain_submissions
        SET verification_status = 'disputed',
            updated_at = NOW()
        WHERE id IN (v_my_submission.id, v_other_submission.id);

        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'disputed',
            'message', 'Captain submissions do not match. Review the sets and resubmit.'
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

    FOR v_current_set IN
        SELECT *
        FROM public.team_match_submission_sets
        WHERE captain_submission_id = v_my_submission.id
        ORDER BY set_number
    LOOP
        SELECT get_race_target(
            COALESCE((SELECT breakpoint_rating FROM public.profiles WHERE id = v_current_set.player_a_id), 500),
            COALESCE((SELECT breakpoint_rating FROM public.profiles WHERE id = v_current_set.player_b_id), 500),
            '8ball'
        )
        INTO v_races_8;

        SELECT get_race_target(
            COALESCE((SELECT breakpoint_rating FROM public.profiles WHERE id = v_current_set.player_a_id), 500),
            COALESCE((SELECT breakpoint_rating FROM public.profiles WHERE id = v_current_set.player_b_id), 500),
            '9ball'
        )
        INTO v_races_9;

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
            (v_races_8->>'p1')::INT,
            (v_races_8->>'p2')::INT,
            (v_races_9->>'p1')::INT,
            (v_races_9->>'p2')::INT
        )
        RETURNING id INTO v_match_id;

        v_put_up_team_id := CASE
            WHEN MOD(v_current_set.set_number - 1, 2) = 0 THEN v_my_submission.put_up_first_team_id
            WHEN v_my_submission.put_up_first_team_id = v_team_match.team_a_id THEN v_team_match.team_b_id
            ELSE v_team_match.team_a_id
        END;

        INSERT INTO public.team_match_sets (
            team_match_id,
            set_number,
            game_type,
            player_a_id,
            player_b_id,
            put_up_team_id,
            match_id
        )
        VALUES (
            p_team_match_id,
            v_current_set.set_number,
            v_current_set.game_type,
            v_current_set.player_a_id,
            v_current_set.player_b_id,
            v_put_up_team_id,
            v_match_id
        )
        RETURNING id INTO v_set_id;

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
            g.game_number,
            v_current_set.game_type,
            g.winner_id,
            g.is_break_and_run,
            g.is_rack_and_run,
            g.is_9_on_snap,
            g.is_early_8,
            g.is_scratch_8,
            v_my_submission.submitted_by,
            'verified'
        FROM public.team_match_submission_games g
        WHERE g.submission_set_id = v_current_set.id
        ORDER BY g.game_number;

        SELECT COUNT(*) FILTER (WHERE winner_id = v_current_set.player_a_id),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_b_id),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_a_id AND is_break_and_run),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_b_id AND is_break_and_run),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_a_id AND is_rack_and_run),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_b_id AND is_rack_and_run),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_a_id AND is_9_on_snap),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_b_id AND is_9_on_snap),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_a_id AND is_early_8),
               COUNT(*) FILTER (WHERE winner_id = v_current_set.player_b_id AND is_early_8)
          INTO v_p1_racks,
               v_p2_racks,
               v_p1_break_runs,
               v_p2_break_runs,
               v_p1_rack_runs,
               v_p2_rack_runs,
               v_p1_snaps,
               v_p2_snaps,
               v_p1_early_8s,
               v_p2_early_8s
        FROM public.team_match_submission_games
        WHERE submission_set_id = v_current_set.id;

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

    UPDATE public.team_match_captain_submissions
    SET verification_status = 'verified',
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id IN (v_my_submission.id, v_other_submission.id);

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'verified',
        'message', 'Team match verified and logged.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_team_match_for_verification(UUID) TO authenticated;
