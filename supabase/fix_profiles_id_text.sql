-- FIX PROFILES UUID TO TEXT MIGRATION
-- V2: Updated to DROP POLICIES first to avoid dependency errors.

BEGIN;

-- 1. DROP EXISTING POLICIES (Required before altering columns)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
-- Drop system_settings policies that reference profiles
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Everyone can read system settings" ON public.system_settings;

-- Drop other potential policies just in case
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- 2. DROP RELYING FOREIGN KEYS
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_operator_id_fkey;
ALTER TABLE public.league_players DROP CONSTRAINT IF EXISTS league_players_player_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_submitted_by_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;
ALTER TABLE public.reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_requester_id_fkey;

-- 3. ALTER PROFILES TABLE (The Root Cause)
-- Convert id from UUID to TEXT to store Clerk IDs (e.g., 'user_2xyz...')
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;

-- 4. ENSURE CHILD COLUMNS ARE TEXT
-- (These might already be text from previous fixes, but running it again is safe/idempotent)
ALTER TABLE public.leagues ALTER COLUMN operator_id TYPE text;
ALTER TABLE public.league_players ALTER COLUMN player_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player1_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player2_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN submitted_by TYPE text;
ALTER TABLE public.games ALTER COLUMN winner_id TYPE text;
ALTER TABLE public.reschedule_requests ALTER COLUMN requester_id TYPE text;

-- 5. RE-ADD FOREIGN KEYS
ALTER TABLE public.leagues ADD CONSTRAINT leagues_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.profiles(id);
ALTER TABLE public.league_players ADD CONSTRAINT league_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);
ALTER TABLE public.games ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);
ALTER TABLE public.reschedule_requests ADD CONSTRAINT reschedule_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id);

-- 6. RECREATE PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING ((SELECT auth.uid())::text = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK ((SELECT auth.uid())::text = id);

-- 7. RECREATE SYSTEM SETTINGS POLICIES
CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update system settings" ON public.system_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid())::text AND role = 'admin'));

COMMIT;
