-- Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    captain_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    tid TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disbanded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    player_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, player_id)
);

-- Team Matches
CREATE TABLE IF NOT EXISTS public.team_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
    team_a_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    team_b_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    put_up_first_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    wins_a INT DEFAULT 0,
    losses_a INT DEFAULT 0,
    wins_b INT DEFAULT 0,
    losses_b INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Match Sets
CREATE TABLE IF NOT EXISTS public.team_match_sets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_match_id UUID REFERENCES public.team_matches(id) ON DELETE CASCADE,
    set_number INT NOT NULL CHECK (set_number >= 1 AND set_number <= 8),
    game_type TEXT NOT NULL CHECK (game_type IN ('8ball', '9ball')),
    player_a_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    player_b_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    put_up_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    winner_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL, -- link to the single match container
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_sets ENABLE ROW LEVEL SECURITY;

-- Basic Select Policies for Authenticated Users (Read-all)
-- Drop existing first if re-running
DROP POLICY IF EXISTS "Enable read access for all users" ON public.teams;
CREATE POLICY "Enable read access for all users" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_members;
CREATE POLICY "Enable read access for all users" ON public.team_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_matches;
CREATE POLICY "Enable read access for all users" ON public.team_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_match_sets;
CREATE POLICY "Enable read access for all users" ON public.team_match_sets FOR SELECT USING (true);

-- Drop existing complex policies if re-running
DROP POLICY IF EXISTS "Admins and Operators can ALL on teams" ON public.teams;
DROP POLICY IF EXISTS "Admins and Operators can ALL on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins and Operators can ALL on team_matches" ON public.team_matches;
DROP POLICY IF EXISTS "Admins and Operators can ALL on team_match_sets" ON public.team_match_sets;

-- Insert/Update Policies (Simplified initially, leaning on backend logic via supabase admin client or role=admin/operator)
CREATE POLICY "Admins and Operators can ALL on teams" ON public.teams FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('admin')) OR
    EXISTS (SELECT 1 FROM public.league_operators WHERE user_id = auth.uid()::text AND league_id = teams.league_id)
);
CREATE POLICY "Admins and Operators can ALL on team_members" ON public.team_members FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('admin')) OR
    EXISTS (SELECT 1 FROM public.teams t JOIN public.league_operators lo ON t.league_id = lo.league_id WHERE t.id = team_members.team_id AND lo.user_id = auth.uid()::text)
);
CREATE POLICY "Admins and Operators can ALL on team_matches" ON public.team_matches FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('admin')) OR
    EXISTS (SELECT 1 FROM public.league_operators WHERE user_id = auth.uid()::text AND league_id = team_matches.league_id)
);
CREATE POLICY "Admins and Operators can ALL on team_match_sets" ON public.team_match_sets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role IN ('admin')) OR
    EXISTS (SELECT 1 FROM public.team_matches tm JOIN public.league_operators lo ON tm.league_id = lo.league_id WHERE tm.id = team_match_sets.team_match_id AND lo.user_id = auth.uid()::text)
);
