-- Add Breakpoint Rating columns if they don't exist
ALTER TABLE league_players
ADD COLUMN IF NOT EXISTS breakpoint_rating float8 DEFAULT 500.0,
ADD COLUMN IF NOT EXISTS breakpoint_confidence float8 DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS breakpoint_racks_played int4 DEFAULT 0;

-- Ensure matches table has room for snapshotting if needed (already added bbrs_ start columns to games)
