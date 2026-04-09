CREATE OR REPLACE FUNCTION public.prevent_duplicate_team_member_per_league()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    new_league_id uuid;
BEGIN
    SELECT league_id
    INTO new_league_id
    FROM public.teams
    WHERE id = NEW.team_id;

    IF new_league_id IS NULL THEN
        RAISE EXCEPTION 'Team % does not exist.', NEW.team_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.team_members tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.player_id = NEW.player_id
          AND t.league_id = new_league_id
          AND tm.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'Player already belongs to another team in this league.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_team_member_per_league_trigger ON public.team_members;

CREATE TRIGGER prevent_duplicate_team_member_per_league_trigger
BEFORE INSERT OR UPDATE OF team_id, player_id
ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_team_member_per_league();
