-- Create table for tracking dismissed reminders
CREATE TABLE IF NOT EXISTS dismissed_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    match_id UUID REFERENCES matches(id) NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('3day', 'dayof')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, match_id, reminder_type)
);

-- Enable RLS
ALTER TABLE dismissed_reminders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own dismissals" ON dismissed_reminders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own dismissals" ON dismissed_reminders
    FOR SELECT USING (auth.uid() = user_id);
