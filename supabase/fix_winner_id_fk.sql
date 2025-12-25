ALTER TABLE games
DROP CONSTRAINT IF EXISTS games_winner_id_fkey;

ALTER TABLE games
ALTER COLUMN winner_id TYPE text;

ALTER TABLE games
ADD CONSTRAINT games_winner_id_fkey
FOREIGN KEY (winner_id) REFERENCES profiles(id);
