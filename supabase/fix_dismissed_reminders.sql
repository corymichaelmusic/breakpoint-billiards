-- Drop and recreate dismissed_reminders with correct types and policies
DROP TABLE IF EXISTS dismissed_reminders;

CREATE TABLE dismissed_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, 
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('3day', 'dayof')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, match_id, reminder_type)
);

-- Enable RLS
ALTER TABLE dismissed_reminders ENABLE ROW LEVEL SECURITY;

-- Policies using sub claim from JWT (Clerk ID)
CREATE POLICY "Users can insert their own dismissals" ON dismissed_reminders
    FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub'::text) = user_id);

CREATE POLICY "Users can view their own dismissals" ON dismissed_reminders
    FOR SELECT USING ((auth.jwt() ->> 'sub'::text) = user_id);
