-- Add columns to track explicit winners for 8-ball and 9-ball sub-matches
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS winner_id_8ball uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS winner_id_9ball uuid REFERENCES auth.users(id);
