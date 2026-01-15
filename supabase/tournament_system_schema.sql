-- Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    organizer_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed')),
    game_type TEXT NOT NULL CHECK (game_type IN ('8ball', '9ball')),
    table_config JSONB DEFAULT '[]'::jsonb, -- Array of table names
    bracket_metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for Tournaments
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments are viewable by everyone" 
ON tournaments FOR SELECT 
USING (true);

CREATE POLICY "Organizers can insert their own tournaments" 
ON tournaments FOR INSERT 
WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their own tournaments" 
ON tournaments FOR UPDATE 
USING (auth.uid() = organizer_id);

-- Tournament Participants Table
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id TEXT REFERENCES profiles(id),
    fargo_rating_snapshot INTEGER,
    seed INTEGER,
    eliminated BOOLEAN DEFAULT FALSE,
    UNIQUE(tournament_id, player_id)
);

-- Enable RLS for Participants
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone" 
ON tournament_participants FOR SELECT 
USING (true);

CREATE POLICY "Organizers can manage participants" 
ON tournament_participants FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM tournaments 
        WHERE id = tournament_participants.tournament_id 
        AND organizer_id = auth.uid()
    )
);

-- Tournament Matches Table
CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    player1_id TEXT REFERENCES profiles(id), -- Can be null if TBD
    player2_id TEXT REFERENCES profiles(id), -- Can be null if TBD
    winner_id TEXT REFERENCES profiles(id),
    round_label TEXT, -- e.g. "Winners Round 1"
    match_position_code TEXT, -- e.g. "WB-1.1" indicating bracket position
    table_assigned TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'completed')),
    score1 INTEGER DEFAULT 0,
    score2 INTEGER DEFAULT 0,
    handicap_races JSONB DEFAULT '{}'::jsonb, -- e.g. {"player1": 5, "player2": 3}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Matches
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone" 
ON tournament_matches FOR SELECT 
USING (true);

CREATE POLICY "Organizers can manage matches" 
ON tournament_matches FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM tournaments 
        WHERE id = tournament_matches.tournament_id 
        AND organizer_id = auth.uid()
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer ON tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON tournament_matches(tournament_id);
