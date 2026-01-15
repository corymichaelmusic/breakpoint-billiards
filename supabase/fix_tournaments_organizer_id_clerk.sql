-- Fix Tournament Organizer ID Type Mismatch (Clerk IDs are TEXT, column is UUID)
-- REVISED: Drop policies FIRST to avoid dependency errors during column alter.

BEGIN;

-- 1. DROP DEPENDENT POLICIES FIRST
DROP POLICY IF EXISTS "Organizers can insert their own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can update their own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can manage participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "Organizers can manage matches" ON public.tournament_matches;

-- 2. ALTER TOURNAMENTS TABLE
-- Remove the foreign key constraint
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_organizer_id_fkey;

-- Remove the default value which uses auth.uid() (UUID)
ALTER TABLE public.tournaments ALTER COLUMN organizer_id DROP DEFAULT;

-- Change the column type to TEXT
ALTER TABLE public.tournaments ALTER COLUMN organizer_id TYPE TEXT;

-- 3. RECREATE POLICIES (using auth.jwt() ->> 'sub')

-- Tournaments
CREATE POLICY "Organizers can insert their own tournaments" 
ON public.tournaments FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'sub') = organizer_id);

CREATE POLICY "Organizers can update their own tournaments" 
ON public.tournaments FOR UPDATE 
USING ((auth.jwt() ->> 'sub') = organizer_id);

-- Participants
CREATE POLICY "Organizers can manage participants" 
ON public.tournament_participants FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.tournaments 
        WHERE id = tournament_participants.tournament_id 
        AND organizer_id = (auth.jwt() ->> 'sub')
    )
);

-- Matches
CREATE POLICY "Organizers can manage matches" 
ON public.tournament_matches FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.tournaments 
        WHERE id = tournament_matches.tournament_id 
        AND organizer_id = (auth.jwt() ->> 'sub')
    )
);

COMMIT;
