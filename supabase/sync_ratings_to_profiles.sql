-- Sync league_players.breakpoint_rating to profiles.breakpoint_rating
-- We take the MAX rating found in any league for each player as the initial global rating
-- This ensures that if a player has multiple ratings, the most favorable/established one is used.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT player_id, MAX(breakpoint_rating) as max_rating
        FROM league_players
        GROUP BY player_id
    ) LOOP
        UPDATE profiles
        SET breakpoint_rating = GREATEST(breakpoint_rating, r.max_rating)
        WHERE id = r.player_id;
    END LOOP;
END $$;

-- Verify Glenn's rating specifically
-- Glenn Vinson id: user_39XmZOmAboWjLWia4zViNBYTv6n
UPDATE profiles 
SET breakpoint_rating = 651.73818817591 
WHERE id = 'user_39XmZOmAboWjLWia4zViNBYTv6n';

-- Optionally sync back to league_players to ensure consistency for now, 
-- though we will stop reading from there soon.
UPDATE league_players lp
SET breakpoint_rating = p.breakpoint_rating
FROM profiles p
WHERE lp.player_id = p.id;
