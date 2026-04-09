ALTER TABLE public.team_match_submission_sets
    ADD COLUMN IF NOT EXISTS handoff_code_hash TEXT,
    ADD COLUMN IF NOT EXISTS handoff_code_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMPTZ;

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
    v_claim_override_set_id TEXT := current_setting('app.team_match_claim_override_set_id', true);
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
        IF v_claim_override_set_id IS DISTINCT FROM OLD.id::TEXT THEN
            RAISE EXCEPTION 'This set is currently being scored by another teammate.';
        END IF;
    END IF;

    IF NEW.scored_by_user_id IS NOT NULL
       AND NEW.scored_by_user_id IS DISTINCT FROM v_user_id
       AND v_claim_override_set_id IS DISTINCT FROM OLD.id::TEXT THEN
        RAISE EXCEPTION 'You cannot hand this set directly to another user.';
    END IF;

    IF NEW.completed_by_user_id IS NOT NULL
       AND NEW.completed_by_user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Only the active scorer can finish this set.';
    END IF;

    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.release_team_match_submission_set(UUID);

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
        handoff_code_hash = NULL,
        handoff_code_expires_at = NULL,
        handoff_requested_at = NULL,
        updated_at = NOW()
    WHERE id = p_submission_set_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_team_match_submission_set(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.create_team_match_set_handoff_code(UUID);

CREATE OR REPLACE FUNCTION public.create_team_match_set_handoff_code(
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
    v_code TEXT;
    v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '5 minutes';
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

    IF v_set.status = 'completed' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Completed sets cannot be handed off.');
    END IF;

    IF v_set.scored_by_user_id IS DISTINCT FROM v_user_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Only the active scorer can generate a handoff code');
    END IF;

    v_code := LPAD(FLOOR(RANDOM() * 10000)::INT::TEXT, 4, '0');

    UPDATE public.team_match_submission_sets
    SET handoff_code_hash = md5(v_code || ':' || id::TEXT),
        handoff_code_expires_at = v_expires_at,
        handoff_requested_at = NOW(),
        updated_at = NOW()
    WHERE id = p_submission_set_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'handoff_code', v_code,
        'expires_at', v_expires_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_match_set_handoff_code(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.claim_team_match_submission_set_with_code(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.claim_team_match_submission_set_with_code(
    p_submission_set_id UUID,
    p_handoff_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id TEXT := (auth.jwt() ->> 'sub');
    v_set RECORD;
    v_scorer_name TEXT;
BEGIN
    SELECT tcss.*, tcs.team_id, tcs.id as submission_id
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

    IF v_set.status = 'completed' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Completed sets cannot be claimed.');
    END IF;

    IF v_set.scored_by_user_id = v_user_id THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'claimed',
            'submission_id', v_set.submission_id,
            'submission_set_id', v_set.id,
            'scored_by_user_id', v_set.scored_by_user_id
        );
    END IF;

    IF v_set.handoff_code_hash IS NULL
       OR v_set.handoff_code_expires_at IS NULL
       OR v_set.handoff_code_expires_at < NOW() THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'That handoff code has expired. Ask for a new code.');
    END IF;

    IF md5(COALESCE(TRIM(p_handoff_code), '') || ':' || v_set.id::TEXT) IS DISTINCT FROM v_set.handoff_code_hash THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid handoff code.');
    END IF;

    PERFORM set_config('app.team_match_claim_override_set_id', p_submission_set_id::TEXT, true);

    UPDATE public.team_match_submission_sets
    SET scored_by_user_id = v_user_id,
        scoring_claimed_at = NOW(),
        handoff_code_hash = NULL,
        handoff_code_expires_at = NULL,
        handoff_requested_at = NULL,
        updated_at = NOW()
    WHERE id = p_submission_set_id;

    SELECT COALESCE(p.nickname, p.full_name, 'You')
      INTO v_scorer_name
    FROM public.profiles p
    WHERE p.id = v_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'claimed',
        'submission_id', v_set.submission_id,
        'submission_set_id', v_set.id,
        'set_status', v_set.status,
        'scored_by_user_id', v_user_id,
        'scored_by_name', COALESCE(v_scorer_name, 'You')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_team_match_submission_set_with_code(UUID, TEXT) TO authenticated;
