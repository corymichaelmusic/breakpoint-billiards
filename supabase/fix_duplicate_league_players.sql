-- Fix Duplicate League Players and Add Unique Constraint

-- 1. Create a function to merge duplicates
CREATE OR REPLACE FUNCTION merge_duplicate_league_players()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    dest_id uuid;
    dups RECORD;
BEGIN
    -- Iterate over player/league pairs that have > 1 entry
    FOR r IN 
        SELECT league_id, player_id, COUNT(*)
        FROM league_players
        GROUP BY league_id, player_id
        HAVING COUNT(*) > 1
    LOOP
        -- Get the ID of the record we want to KEEP (e.g. the oldest or one with most data? Let's pick max ID)
        -- Actually, we should pick one and sum the others into it.
        SELECT id INTO dest_id FROM league_players WHERE league_id = r.league_id AND player_id = r.player_id ORDER BY created_at ASC LIMIT 1;
        
        -- Iterate over the OTHER records (the duplicates)
        FOR dups IN SELECT * FROM league_players WHERE league_id = r.league_id AND player_id = r.player_id AND id != dest_id LOOP
            -- Return stats to the main record
            UPDATE league_players
            SET 
                breakpoint_racks_won = breakpoint_racks_won + dups.breakpoint_racks_won,
                breakpoint_racks_lost = breakpoint_racks_lost + dups.breakpoint_racks_lost,
                breakpoint_racks_played = breakpoint_racks_played + dups.breakpoint_racks_played,
                matches_won = matches_won + dups.matches_won,
                matches_lost = matches_lost + dups.matches_lost,
                matches_played = matches_played + dups.matches_played,
                shutouts = shutouts + dups.shutouts,
                total_break_and_runs = total_break_and_runs + dups.total_break_and_runs,
                total_rack_and_runs = total_rack_and_runs + dups.total_rack_and_runs,
                total_nine_on_snap = total_nine_on_snap + dups.total_nine_on_snap,
                total_early_8 = total_early_8 + dups.total_early_8,
                total_break_and_runs_8ball = total_break_and_runs_8ball + dups.total_break_and_runs_8ball,
                total_rack_and_runs_8ball = total_rack_and_runs_8ball + dups.total_rack_and_runs_8ball,
                total_break_and_runs_9ball = total_break_and_runs_9ball + dups.total_break_and_runs_9ball,
                total_rack_and_runs_9ball = total_rack_and_runs_9ball + dups.total_rack_and_runs_9ball
                -- Rating is tricky. We shouldn't sum ratings. We should probably stick with the rating from the record we keep, 
                -- or average them? Or assume the latest one is correct?
                -- If we keep 'created_at ASC', we keep the oldest.
                -- Maybe we should just use the rating from the record with the most recent activity?
                -- For simplicity, we assume rating on the Keep record is sufficient, or we could take the max.
                -- Let's NOT sum ratings.
            WHERE id = dest_id;
            
            -- DELETE the duplicate
            DELETE FROM league_players WHERE id = dups.id;
        END LOOP;
    END LOOP;
END;
$$;

-- 2. Execute the merge
SELECT merge_duplicate_league_players();

-- 3. Drop the function
DROP FUNCTION merge_duplicate_league_players();

-- 4. Add Unique Constraint
ALTER TABLE league_players
ADD CONSTRAINT league_players_unique_membership UNIQUE (league_id, player_id);

-- 5. Force update of Global Profiles to match Aggregated Stats (Optional but good)
-- (We can't easily sync global rating from this, but we can ensure integrity)
