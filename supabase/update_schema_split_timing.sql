ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS started_at_8ball timestamptz,
ADD COLUMN IF NOT EXISTS ended_at_8ball timestamptz,
ADD COLUMN IF NOT EXISTS started_at_9ball timestamptz,
ADD COLUMN IF NOT EXISTS ended_at_9ball timestamptz;
