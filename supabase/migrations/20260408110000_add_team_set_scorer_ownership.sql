ALTER TABLE public.team_match_submission_sets
    ADD COLUMN IF NOT EXISTS scored_by_user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scoring_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_by_user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_match_submission_sets_scorer
    ON public.team_match_submission_sets(scored_by_user_id);

CREATE OR REPLACE FUNCTION public.is_team_member_or_captain(
    p_team_id UUID,
    p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.teams t
        WHERE t.id = p_team_id
          AND t.captain_id = p_user_id
    ) OR EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.team_id = p_team_id
          AND tm.player_id = p_user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_member_or_captain(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_team_captain(
    p_team_id UUID,
    p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.teams t
        WHERE t.id = p_team_id
          AND t.captain_id = p_user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_captain(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_team_match_operator_or_admin(
    p_team_match_id UUID,
    p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_user_id
          AND p.role = 'admin'
    ) OR EXISTS (
        SELECT 1
        FROM public.team_matches tm
        JOIN public.league_operators lo ON lo.league_id = tm.league_id
        WHERE tm.id = p_team_match_id
          AND lo.user_id = p_user_id
    ) OR EXISTS (
        SELECT 1
        FROM public.team_matches tm
        JOIN public.leagues l ON l.id = tm.league_id
        WHERE tm.id = p_team_match_id
          AND l.operator_id = p_user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_match_operator_or_admin(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Captains can manage their own team captain submissions" ON public.team_match_captain_submissions;
DROP POLICY IF EXISTS "Team members can manage their own team captain submissions" ON public.team_match_captain_submissions;

CREATE POLICY "Team members can manage their own team captain submissions"
  ON public.team_match_captain_submissions
  FOR ALL
  USING (
    public.is_team_member_or_captain(team_id, (auth.jwt() ->> 'sub'))
  )
  WITH CHECK (
    public.is_team_member_or_captain(team_id, (auth.jwt() ->> 'sub'))
  );

DROP POLICY IF EXISTS "Captains can manage their own team submission sets" ON public.team_match_submission_sets;
DROP POLICY IF EXISTS "Team members can manage their own team submission sets" ON public.team_match_submission_sets;

CREATE POLICY "Team members can manage their own team submission sets"
  ON public.team_match_submission_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND public.is_team_member_or_captain(tcs.team_id, (auth.jwt() ->> 'sub'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_match_captain_submissions tcs
      WHERE tcs.id = team_match_submission_sets.captain_submission_id
        AND public.is_team_member_or_captain(tcs.team_id, (auth.jwt() ->> 'sub'))
    )
  );

DROP POLICY IF EXISTS "Captains can manage their own team submission games" ON public.team_match_submission_games;
DROP POLICY IF EXISTS "Team members can manage their own team submission games" ON public.team_match_submission_games;

CREATE POLICY "Team members can manage their own team submission games"
  ON public.team_match_submission_games
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND public.is_team_member_or_captain(tcs.team_id, (auth.jwt() ->> 'sub'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_match_submission_sets tcss
      JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
      WHERE tcss.id = team_match_submission_games.submission_set_id
        AND public.is_team_member_or_captain(tcs.team_id, (auth.jwt() ->> 'sub'))
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_team_match_submission_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_team_id UUID := COALESCE(NEW.team_id, OLD.team_id);
    v_team_match_id UUID := COALESCE(NEW.team_match_id, OLD.team_match_id);
BEGIN
    IF public.is_team_match_operator_or_admin(v_team_match_id, v_user_id) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF NOT public.is_team_member_or_captain(v_team_id, v_user_id) THEN
        RAISE EXCEPTION 'You are not allowed to edit this team card.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.verification_status := 'draft';
        NEW.submitted_for_verification_at := NULL;
        NEW.verified_at := NULL;
        RETURN NEW;
    END IF;

    IF NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.team_match_id IS DISTINCT FROM OLD.team_match_id THEN
        RAISE EXCEPTION 'Team card ownership cannot be reassigned.';
    END IF;

    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       OR NEW.submitted_for_verification_at IS DISTINCT FROM OLD.submitted_for_verification_at
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
        IF NOT public.is_team_captain(v_team_id, v_user_id) THEN
            IF NEW.verification_status IS DISTINCT FROM 'draft'
               OR NEW.submitted_for_verification_at IS NOT NULL
               OR NEW.verified_at IS NOT NULL THEN
                RAISE EXCEPTION 'Only captains can change team match verification status.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_match_submission_access_guard ON public.team_match_captain_submissions;

CREATE TRIGGER team_match_submission_access_guard
BEFORE INSERT OR UPDATE
ON public.team_match_captain_submissions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_match_submission_access();

CREATE OR REPLACE FUNCTION public.enforce_team_match_set_scorer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_submission_id UUID := COALESCE(NEW.captain_submission_id, OLD.captain_submission_id);
    v_team_id UUID;
    v_team_match_id UUID;
BEGIN
    SELECT tcs.team_id, tcs.team_match_id
      INTO v_team_id, v_team_match_id
    FROM public.team_match_captain_submissions tcs
    WHERE tcs.id = v_submission_id;

    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Team card not found for this set.';
    END IF;

    IF public.is_team_match_operator_or_admin(v_team_match_id, v_user_id) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF NOT public.is_team_member_or_captain(v_team_id, v_user_id) THEN
        RAISE EXCEPTION 'You are not allowed to edit this set.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.scored_by_user_id IS DISTINCT FROM v_user_id THEN
            RAISE EXCEPTION 'Claim the set before editing it.';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.scored_by_user_id IS DISTINCT FROM v_user_id THEN
            RAISE EXCEPTION 'This set is currently owned by another scorer.';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.scored_by_user_id IS NULL THEN
        IF NEW.scored_by_user_id IS DISTINCT FROM v_user_id THEN
            RAISE EXCEPTION 'Claim the set before editing it.';
        END IF;
    ELSIF OLD.scored_by_user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'This set is currently being scored by another teammate.';
    END IF;

    IF NEW.scored_by_user_id IS NOT NULL
       AND NEW.scored_by_user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'You cannot hand this set directly to another user.';
    END IF;

    IF NEW.completed_by_user_id IS NOT NULL
       AND NEW.completed_by_user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Only the active scorer can finish this set.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_match_set_scorer_guard ON public.team_match_submission_sets;

CREATE TRIGGER team_match_set_scorer_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.team_match_submission_sets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_match_set_scorer();

CREATE OR REPLACE FUNCTION public.enforce_team_match_game_scorer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_submission_set_id UUID := COALESCE(NEW.submission_set_id, OLD.submission_set_id);
    v_team_id UUID;
    v_team_match_id UUID;
    v_scored_by_user_id TEXT;
BEGIN
    SELECT tcs.team_id, tcs.team_match_id, tcss.scored_by_user_id
      INTO v_team_id, v_team_match_id, v_scored_by_user_id
    FROM public.team_match_submission_sets tcss
    JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
    WHERE tcss.id = v_submission_set_id;

    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Team set not found.';
    END IF;

    IF public.is_team_match_operator_or_admin(v_team_match_id, v_user_id) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF NOT public.is_team_member_or_captain(v_team_id, v_user_id) THEN
        RAISE EXCEPTION 'You are not allowed to edit this set.';
    END IF;

    IF v_scored_by_user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'This set is currently being scored by another teammate.';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS team_match_game_scorer_guard ON public.team_match_submission_games;

CREATE TRIGGER team_match_game_scorer_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.team_match_submission_games
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_match_game_scorer();

CREATE OR REPLACE FUNCTION public.reset_team_match_submission_verification(
    p_captain_submission_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.team_match_captain_submissions
    SET verification_status = 'draft',
        submitted_for_verification_at = NULL,
        verified_at = NULL,
        updated_at = NOW()
    WHERE id = p_captain_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_team_match_submission_verification(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_team_match_submission_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_submission_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'team_match_captain_submissions' THEN
        IF TG_OP = 'UPDATE'
           AND (
               NEW.put_up_first_team_id IS DISTINCT FROM OLD.put_up_first_team_id
           ) THEN
            NEW.verification_status := 'draft';
            NEW.submitted_for_verification_at := NULL;
            NEW.verified_at := NULL;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'team_match_submission_sets' THEN
        v_submission_id := COALESCE(NEW.captain_submission_id, OLD.captain_submission_id);
    ELSE
        SELECT tcss.captain_submission_id
          INTO v_submission_id
        FROM public.team_match_submission_sets tcss
        WHERE tcss.id = COALESCE(NEW.submission_set_id, OLD.submission_set_id);
    END IF;

    PERFORM public.reset_team_match_submission_verification(v_submission_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS team_match_submission_verification_touch_submission ON public.team_match_captain_submissions;
DROP TRIGGER IF EXISTS team_match_submission_verification_touch_sets ON public.team_match_submission_sets;
DROP TRIGGER IF EXISTS team_match_submission_verification_touch_games ON public.team_match_submission_games;

CREATE TRIGGER team_match_submission_verification_touch_submission
BEFORE UPDATE
ON public.team_match_captain_submissions
FOR EACH ROW
EXECUTE FUNCTION public.touch_team_match_submission_verification();

CREATE TRIGGER team_match_submission_verification_touch_sets
AFTER INSERT OR UPDATE OR DELETE
ON public.team_match_submission_sets
FOR EACH ROW
EXECUTE FUNCTION public.touch_team_match_submission_verification();

CREATE TRIGGER team_match_submission_verification_touch_games
AFTER INSERT OR UPDATE OR DELETE
ON public.team_match_submission_games
FOR EACH ROW
EXECUTE FUNCTION public.touch_team_match_submission_verification();

CREATE OR REPLACE FUNCTION public.claim_team_match_submission_set(
    p_team_match_id UUID,
    p_set_number INT,
    p_game_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_team_match RECORD;
    v_team_id UUID;
    v_submission RECORD;
    v_set RECORD;
    v_scorer_name TEXT;
BEGIN
    IF p_set_number < 1 OR p_set_number > 8 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid set number');
    END IF;

    IF p_game_type NOT IN ('8ball', '9ball') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid game type');
    END IF;

    SELECT *
      INTO v_team_match
    FROM public.team_matches
    WHERE id = p_team_match_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Team match not found');
    END IF;

    IF public.is_team_member_or_captain(v_team_match.team_a_id, v_user_id) THEN
        v_team_id := v_team_match.team_a_id;
    ELSIF public.is_team_member_or_captain(v_team_match.team_b_id, v_user_id) THEN
        v_team_id := v_team_match.team_b_id;
    END IF;

    IF v_team_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'You are not on a team in this match');
    END IF;

    SELECT *
      INTO v_submission
    FROM public.team_match_captain_submissions
    WHERE team_match_id = p_team_match_id
      AND team_id = v_team_id
    LIMIT 1;

    IF v_submission.id IS NULL THEN
        INSERT INTO public.team_match_captain_submissions (
            team_match_id,
            team_id,
            submitted_by
        )
        VALUES (
            p_team_match_id,
            v_team_id,
            v_user_id
        )
        RETURNING *
        INTO v_submission;
    END IF;

    SELECT *
      INTO v_set
    FROM public.team_match_submission_sets
    WHERE captain_submission_id = v_submission.id
      AND set_number = p_set_number
    LIMIT 1;

    IF v_set.id IS NULL THEN
        INSERT INTO public.team_match_submission_sets (
            captain_submission_id,
            set_number,
            game_type,
            status,
            scored_by_user_id,
            scoring_claimed_at
        )
        VALUES (
            v_submission.id,
            p_set_number,
            p_game_type,
            'pending',
            v_user_id,
            NOW()
        )
        RETURNING *
        INTO v_set;
    ELSIF v_set.scored_by_user_id IS NULL OR v_set.scored_by_user_id = v_user_id THEN
        UPDATE public.team_match_submission_sets
        SET scored_by_user_id = v_user_id,
            scoring_claimed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_set.id
        RETURNING *
        INTO v_set;
    ELSE
        SELECT COALESCE(p.nickname, p.full_name, 'Another teammate')
          INTO v_scorer_name
        FROM public.profiles p
        WHERE p.id = v_set.scored_by_user_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'owned_by_other',
            'submission_id', v_submission.id,
            'submission_set_id', v_set.id,
            'scored_by_user_id', v_set.scored_by_user_id,
            'scored_by_name', COALESCE(v_scorer_name, 'Another teammate')
        );
    END IF;

    SELECT COALESCE(p.nickname, p.full_name, 'You')
      INTO v_scorer_name
    FROM public.profiles p
    WHERE p.id = v_set.scored_by_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'claimed',
        'team_id', v_team_id,
        'submission_id', v_submission.id,
        'submission_set_id', v_set.id,
        'set_status', v_set.status,
        'scored_by_user_id', v_set.scored_by_user_id,
        'scored_by_name', COALESCE(v_scorer_name, 'You')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_team_match_submission_set(UUID, INT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_team_match_submission_set(
    p_submission_set_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_set RECORD;
BEGIN
    SELECT tcss.*, tcs.team_id, tcs.team_match_id
      INTO v_set
    FROM public.team_match_submission_sets tcss
    JOIN public.team_match_captain_submissions tcs ON tcs.id = tcss.captain_submission_id
    WHERE tcss.id = p_submission_set_id;

    IF v_set.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Set not found');
    END IF;

    IF NOT public.is_team_member_or_captain(v_set.team_id, v_user_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'You are not on this team');
    END IF;

    IF v_set.scored_by_user_id IS DISTINCT FROM v_user_id
       AND NOT public.is_team_match_operator_or_admin(v_set.team_match_id, v_user_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Only the active scorer can hand off this set');
    END IF;

    UPDATE public.team_match_submission_sets
    SET scored_by_user_id = NULL,
        scoring_claimed_at = NULL,
        updated_at = NOW()
    WHERE id = p_submission_set_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_team_match_submission_set(UUID) TO authenticated;
