-- Add Session Configuration columns to leagues
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS time_slots jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS table_names jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS table_count int DEFAULT 0;

-- Add Match Assignment columns to matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS scheduled_time text,
ADD COLUMN IF NOT EXISTS table_name text;

-- Comment on columns
COMMENT ON COLUMN public.leagues.time_slots IS 'List of available time slots for matches (e.g. ["19:00", "20:30"])';
COMMENT ON COLUMN public.leagues.table_names IS 'List of available table names (e.g. ["Table 1", "Table 2"])';
COMMENT ON COLUMN public.matches.scheduled_time IS 'Assigned time for the match (e.g. "19:00")';
COMMENT ON COLUMN public.matches.table_name IS 'Assigned table for the match (e.g. "Table 1")';
