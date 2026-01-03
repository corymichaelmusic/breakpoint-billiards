-- Disabling Realtime Replication for matches and games
-- The client is NOT using CDC (postgres_changes), so monitoring the WAL is wasted resources (436k checks).
-- We remove them from the publication to stop 'realtime.list_changes' activity.

-- Safely remove tables from publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.matches;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Table matches was not in publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.games;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Table games was not in publication';
    END;
END $$;

-- Note: This does NOT stop the app from working. 
-- The app listens to 'broadcast' channels (which don't use the WAL).
-- However, since no one is sending broadcasts, the app is likely relying on manual refresh anyway.
