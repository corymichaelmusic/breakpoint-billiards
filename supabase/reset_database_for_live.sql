-- =============================================================================
-- DATABASE RESET FOR LIVE TEST SESSION
-- =============================================================================
-- This script resets the database to a fresh state while preserving:
--   1. Pre-registrations (preregistrations table)
--   2. Admin profile: corymichaelmusic@gmail.com (stats reset to zero)
--   3. System settings (system_settings table)
--
-- CAUTION: This is DESTRUCTIVE and IRREVERSIBLE!
-- =============================================================================

DO $$
DECLARE
    admin_id TEXT;
    admin_email TEXT := 'corymichaelmusic@gmail.com';
    prereg_count_before INTEGER;
    prereg_count_after INTEGER;
BEGIN
    RAISE NOTICE '=== DATABASE RESET STARTING ===';
    RAISE NOTICE 'Timestamp: %', NOW();
    
    -- -------------------------------------------------------------------------
    -- STEP 0: Pre-flight checks
    -- -------------------------------------------------------------------------
    
    -- Get admin profile ID
    SELECT id INTO admin_id FROM public.profiles WHERE email = admin_email;
    
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'ABORT: Admin profile (%) not found in database!', admin_email;
    END IF;
    
    RAISE NOTICE 'Admin profile found: % (ID: %)', admin_email, admin_id;
    
    -- Count pre-registrations for verification
    SELECT COUNT(*) INTO prereg_count_before FROM public.preregistrations;
    RAISE NOTICE 'Pre-registrations to preserve: %', prereg_count_before;
    
    -- -------------------------------------------------------------------------
    -- STEP 1: Clear tournament data (no FK dependencies on other tables)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Clearing tournament data...';
    
    DELETE FROM public.tournament_matches;
    RAISE NOTICE '  - tournament_matches cleared';
    
    DELETE FROM public.tournament_participants;
    RAISE NOTICE '  - tournament_participants cleared';
    
    DELETE FROM public.tournaments;
    RAISE NOTICE '  - tournaments cleared';
    
    -- -------------------------------------------------------------------------
    -- STEP 2: Clear match-related data (child tables first)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Clearing match-related data...';
    
    DELETE FROM public.scorecard_entries;
    RAISE NOTICE '  - scorecard_entries cleared';
    
    DELETE FROM public.games;
    RAISE NOTICE '  - games cleared';
    
    DELETE FROM public.reschedule_requests;
    RAISE NOTICE '  - reschedule_requests cleared';
    
    DELETE FROM public.matches;
    RAISE NOTICE '  - matches cleared';
    
    -- -------------------------------------------------------------------------
    -- STEP 3: Clear league membership data
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Clearing league membership data...';
    
    DELETE FROM public.league_players;
    RAISE NOTICE '  - league_players cleared';
    
    DELETE FROM public.league_operators;
    RAISE NOTICE '  - league_operators cleared';
    
    -- -------------------------------------------------------------------------
    -- STEP 4: Clear leagues (includes sessions)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Clearing leagues and sessions...';
    
    DELETE FROM public.leagues;
    RAISE NOTICE '  - leagues cleared (includes all sessions)';
    
    -- -------------------------------------------------------------------------
    -- STEP 5: Clear deletion requests
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Clearing deletion requests...';
    
    DELETE FROM public.deletion_requests;
    RAISE NOTICE '  - deletion_requests cleared';
    
    -- -------------------------------------------------------------------------
    -- STEP 6: Clear operator applications
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Clearing operator applications...';
    
    DELETE FROM public.operator_applications;
    RAISE NOTICE '  - operator_applications cleared';
    
    -- -------------------------------------------------------------------------
    -- STEP 7: Delete all profiles EXCEPT admin
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Deleting all profiles except admin...';
    
    DELETE FROM public.profiles WHERE id != admin_id;
    RAISE NOTICE '  - All non-admin profiles deleted';
    
    -- -------------------------------------------------------------------------
    -- STEP 8: Reset admin profile stats to fresh state
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'Resetting admin profile stats...';
    
    UPDATE public.profiles
    SET
        -- Core stats (if they exist on profiles - most stats are on league_players)
        fargo_rating = 500,
        breakpoint_rating = 500,
        updated_at = NOW()
    WHERE id = admin_id;
    
    RAISE NOTICE '  - Admin profile stats reset (Fargo rating = 500)';
    
    -- -------------------------------------------------------------------------
    -- FINAL: Verification
    -- -------------------------------------------------------------------------
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICATION ===';
    
    -- Verify pre-registrations preserved
    SELECT COUNT(*) INTO prereg_count_after FROM public.preregistrations;
    IF prereg_count_before = prereg_count_after THEN
        RAISE NOTICE '✓ Pre-registrations preserved: % records', prereg_count_after;
    ELSE
        RAISE WARNING '⚠ Pre-registration count mismatch! Before: %, After: %', prereg_count_before, prereg_count_after;
    END IF;
    
    -- Verify admin profile exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_id) THEN
        RAISE NOTICE '✓ Admin profile preserved: %', admin_email;
    ELSE
        RAISE EXCEPTION 'CRITICAL: Admin profile was deleted!';
    END IF;
    
    -- Summary counts
    RAISE NOTICE '';
    RAISE NOTICE '=== DATABASE RESET COMPLETE ===';
    RAISE NOTICE 'Final state:';
    RAISE NOTICE '  - profiles: 1 (admin only)';
    RAISE NOTICE '  - preregistrations: %', prereg_count_after;
    RAISE NOTICE '  - All league/session/match data: CLEARED';
    RAISE NOTICE '';
    RAISE NOTICE 'The database is ready for live testing!';
    
END $$;

-- =============================================================================
-- VERIFICATION QUERIES (Run these after to confirm)
-- =============================================================================

-- Quick count of all tables
SELECT 'profiles' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL SELECT 'leagues', COUNT(*) FROM public.leagues
UNION ALL SELECT 'league_players', COUNT(*) FROM public.league_players
UNION ALL SELECT 'matches', COUNT(*) FROM public.matches
UNION ALL SELECT 'games', COUNT(*) FROM public.games
UNION ALL SELECT 'preregistrations', COUNT(*) FROM public.preregistrations
UNION ALL SELECT 'tournaments', COUNT(*) FROM public.tournaments
UNION ALL SELECT 'operator_applications', COUNT(*) FROM public.operator_applications
UNION ALL SELECT 'deletion_requests', COUNT(*) FROM public.deletion_requests
ORDER BY table_name;
