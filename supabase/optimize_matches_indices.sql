-- Optimize Matches Table Indices
-- Purpose: Support high-frequency queries filtering by player participation
-- Current State: Only league_id is indexed.
-- Problem: 'WHERE (player1_id = ? OR player2_id = ?)' causes seq scan or inefficient filtering.

-- 1. Index Player 1
CREATE INDEX IF NOT EXISTS idx_matches_player1 
ON public.matches (player1_id);

-- 2. Index Player 2
CREATE INDEX IF NOT EXISTS idx_matches_player2 
ON public.matches (player2_id);

-- 3. Composite Index for Submitted By (Lookups for "My Submissions")
CREATE INDEX IF NOT EXISTS idx_matches_submitted_by 
ON public.matches (submitted_by);

-- 4. Ensure Games user foreign keys potentially indexed if we ever query "games by winner"
-- (Optional but good practice)
-- create index if not exists idx_games_winner on public.games(winner_id);
