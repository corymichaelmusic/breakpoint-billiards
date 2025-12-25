
-- Enable RLS on leagues if not already
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflict (or use IF NOT EXISTS if supported for policies, but standard SQL doesn't always support it easily)
DROP POLICY IF EXISTS "Enable read access for all users" ON leagues;

-- Create policy to allow everyone to read leagues
CREATE POLICY "Enable read access for all users" ON leagues
FOR SELECT
TO public
USING (true);
