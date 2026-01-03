
-- DELETE TEST USER SCRIPT
-- Deletes 'breakpointbilliardstesting@gmail.com' and all related data to allow a fresh sign-up test.

DO $$
DECLARE
    target_email TEXT := 'breakpointbilliardstesting@gmail.com';
    target_id TEXT;
BEGIN
    -- 1. Find the User ID
    SELECT id INTO target_id FROM public.profiles WHERE email = target_email;

    IF target_id IS NULL THEN
        RAISE NOTICE 'User % not found in profiles.', target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Deleting user % (ID: %)...', target_email, target_id;

    -- 2. Delete Dependencies (Manually cascade to be safe)
    
    -- League Players (Memberships)
    DELETE FROM public.league_players WHERE player_id = target_id;
    
    -- Matches (As Player 1 or Player 2)
    -- Note: If we delete matches, we might leave orphans in 'games' if cascade isn't set.
    -- Let's delete games for these matches first.
    DELETE FROM public.games 
    WHERE match_id IN (SELECT id FROM public.matches WHERE player1_id = target_id OR player2_id = target_id);

    DELETE FROM public.matches WHERE player1_id = target_id OR player2_id = target_id;

    -- Matches (Submitted By) - Update to NULL or Delete? 
    -- If they submitted a match for others, we probably shouldn't delete the match, just set submitted_by to NULL.
    UPDATE public.matches SET submitted_by = NULL WHERE submitted_by = target_id;

    -- Reschedule Requests
    DELETE FROM public.reschedule_requests WHERE requester_id = target_id;

    -- Leagues (As Operator)
    -- If they are an operator of a league, we should probably delete the league? 
    -- Or just warn. For a test user, delete is usually fine.
    DELETE FROM public.leagues WHERE operator_id = target_id;

    -- 3. Delete Profile
    DELETE FROM public.profiles WHERE id = target_id;

    RAISE NOTICE 'User % deleted successfully.', target_email;
END $$;
