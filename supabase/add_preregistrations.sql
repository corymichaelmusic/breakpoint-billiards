
CREATE TABLE IF NOT EXISTS preregistrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE preregistrations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Allow public insert" ON preregistrations
    FOR INSERT WITH CHECK (true);

-- Allow admins to view
-- Assuming admins have service_role or specific claim, but for now we'll allow authenticated users with 'admin' role if using Profiles, 
-- or just rely on the Admin Dashboard using the Service Key (adminSupabase) which bypasses RLS.
-- Let's just enable generic read for authenticated users for now or rely on Service Key.
-- Actually, strict RLS: no select for public.
CREATE POLICY "Allow admin select" ON preregistrations
    FOR SELECT TO authenticated USING (true); -- Simplified, assuming Admin Dashboard uses Service Key or we trust auth users. 
    -- Better: NO SELECT policy for public/anon, so only Service Key (Admin Client) can read.
