-- Create league_operators junction table
DROP TABLE IF EXISTS league_operators CASCADE;

CREATE TABLE IF NOT EXISTS league_operators (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_id, user_id)
);

-- Enable RLS
ALTER TABLE league_operators ENABLE ROW LEVEL SECURITY;

-- Backfill existing operators
INSERT INTO league_operators (league_id, user_id)
SELECT id, operator_id FROM leagues 
WHERE operator_id IS NOT NULL
ON CONFLICT (league_id, user_id) DO NOTHING;

-- RLS Policies for league_operators
-- Admins can do everything
CREATE POLICY "Admins can manage league_operators" ON league_operators
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid()::text
            AND profiles.role = 'admin'
        )
    );

-- Operators can view their own assignments
CREATE POLICY "Operators can view own assignments" ON league_operators
    FOR SELECT
    USING (user_id = auth.uid()::text);

-- Update Leagues RLS to allow access via league_operators
CREATE POLICY "Operators can view leagues they are assigned to" ON leagues
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM league_operators 
            WHERE league_operators.league_id = leagues.id 
            AND league_operators.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Operators can update leagues they are assigned to" ON leagues
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM league_operators 
            WHERE league_operators.league_id = leagues.id 
            AND league_operators.user_id = auth.uid()::text
        )
    );
