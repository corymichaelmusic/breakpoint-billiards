
-- Fix tournament_matches foreign keys to point to tournament_participants instead of profiles
-- This allows Guests (who don't have profiles) to be in matches, and correctly links players.

-- 1. Drop existing FK constraints (names might vary, so we try standard names or force change)
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player1_id_fkey;
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player2_id_fkey;
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;

-- 2. Modify columns to be UUID (since tournament_participants.id is UUID)
-- Note: If data exists and is incompatible, this might fail. But expected data is empty/broken.
ALTER TABLE tournament_matches ALTER COLUMN player1_id TYPE UUID USING player1_id::uuid;
ALTER TABLE tournament_matches ALTER COLUMN player2_id TYPE UUID USING player2_id::uuid;
ALTER TABLE tournament_matches ALTER COLUMN winner_id TYPE UUID USING winner_id::uuid;

-- 3. Add new Foreign Key constraints
ALTER TABLE tournament_matches
    ADD CONSTRAINT tournament_matches_player1_id_fkey
    FOREIGN KEY (player1_id)
    REFERENCES tournament_participants(id)
    ON DELETE CASCADE;

ALTER TABLE tournament_matches
    ADD CONSTRAINT tournament_matches_player2_id_fkey
    FOREIGN KEY (player2_id)
    REFERENCES tournament_participants(id)
    ON DELETE CASCADE;

ALTER TABLE tournament_matches
    ADD CONSTRAINT tournament_matches_winner_id_fkey
    FOREIGN KEY (winner_id)
    REFERENCES tournament_participants(id)
    ON DELETE SET NULL;
