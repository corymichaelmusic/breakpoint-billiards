-- Add missing columns for schedule generation
ALTER TABLE leagues 
ADD COLUMN IF NOT EXISTS time_slots TEXT[] DEFAULT ARRAY['19:00'],
ADD COLUMN IF NOT EXISTS table_names TEXT[] DEFAULT ARRAY['Table 1'],
ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 1;

-- Ensure RLS allows updates
-- (Assuming existing policies cover update for operator, but good to double check if errors persist)
