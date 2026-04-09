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
    v_is_match_captain BOOLEAN := FALSE;
    v_is_verification_only_update BOOLEAN := FALSE;
BEGIN
    IF public.is_team_match_operator_or_admin(v_team_match_id, v_user_id) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.team_matches tm
        JOIN public.teams team_a ON team_a.id = tm.team_a_id
        JOIN public.teams team_b ON team_b.id = tm.team_b_id
        WHERE tm.id = v_team_match_id
          AND (team_a.captain_id = v_user_id OR team_b.captain_id = v_user_id)
    )
    INTO v_is_match_captain;

    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_team_member_or_captain(v_team_id, v_user_id) THEN
            RAISE EXCEPTION 'You are not allowed to edit this team card.';
        END IF;

        NEW.verification_status := 'draft';
        NEW.submitted_for_verification_at := NULL;
        NEW.verified_at := NULL;
        RETURN NEW;
    END IF;

    IF NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.team_match_id IS DISTINCT FROM OLD.team_match_id THEN
        RAISE EXCEPTION 'Team card ownership cannot be reassigned.';
    END IF;

    v_is_verification_only_update :=
        NEW.team_id IS NOT DISTINCT FROM OLD.team_id
        AND NEW.team_match_id IS NOT DISTINCT FROM OLD.team_match_id
        AND NEW.submitted_by IS NOT DISTINCT FROM OLD.submitted_by
        AND NEW.put_up_first_team_id IS NOT DISTINCT FROM OLD.put_up_first_team_id
        AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at;

    IF v_is_verification_only_update
       AND (
            NEW.verification_status IS DISTINCT FROM OLD.verification_status
            OR NEW.submitted_for_verification_at IS DISTINCT FROM OLD.submitted_for_verification_at
            OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       ) THEN
        IF NOT v_is_match_captain THEN
            RAISE EXCEPTION 'Only captains can change team match verification status.';
        END IF;

        RETURN NEW;
    END IF;

    IF NOT public.is_team_member_or_captain(v_team_id, v_user_id) THEN
        RAISE EXCEPTION 'You are not allowed to edit this team card.';
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
