ALTER TABLE games
ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES auth.users(id);
