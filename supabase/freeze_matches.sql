-- Add rating columns to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS player1_rating numeric,
ADD COLUMN IF NOT EXISTS player2_rating numeric;

-- Function to freeze ratings when a match starts
CREATE OR REPLACE FUNCTION public.freeze_match_stats()
RETURNS TRIGGER AS $$
DECLARE
    current_p1_rating numeric;
    current_p2_rating numeric;
BEGIN
    -- Only run if started_at is being set (and wasn't before) OR if it's a new match with started_at
    IF (NEW.started_at IS NOT NULL AND (OLD.started_at IS NULL OR OLD.started_at IS DISTINCT FROM NEW.started_at)) THEN
        
        -- Fetch current ratings from profiles
        SELECT breakpoint_rating INTO current_p1_rating FROM public.profiles WHERE id = NEW.player1_id;
        SELECT breakpoint_rating INTO current_p2_rating FROM public.profiles WHERE id = NEW.player2_id;

        -- Set ratings if they are not already set on the match
        -- (This allows manual override if needed, but defaults to current profile rating)
        IF NEW.player1_rating IS NULL THEN
            NEW.player1_rating := current_p1_rating;
        END IF;

        IF NEW.player2_rating IS NULL THEN
            NEW.player2_rating := current_p2_rating;
        END IF;
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the freeze function
DROP TRIGGER IF EXISTS trigger_freeze_match_stats ON public.matches;

CREATE TRIGGER trigger_freeze_match_stats
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.freeze_match_stats();

-- Also handle INSERTs if a match is created as "started" directly
CREATE TRIGGER trigger_freeze_match_stats_insert
BEFORE INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.freeze_match_stats();


-- SECONDARY SAFEGUARD: Mobile App often just inserts a GAME without updating match.started_at first.
-- We need a trigger on GAMES to "start" the match if it isn't started yet.

CREATE OR REPLACE FUNCTION public.auto_start_match_on_game()
RETURNS TRIGGER AS $$
DECLARE
    match_record record;
BEGIN
    SELECT * INTO match_record FROM public.matches WHERE id = NEW.match_id;
    
    -- If match is not started, start it (which will trigger freeze_match_stats via UPDATE on matches)
    IF match_record.started_at IS NULL THEN
        UPDATE public.matches 
        SET started_at = NOW() 
        WHERE id = NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_start_match ON public.games;

CREATE TRIGGER trigger_auto_start_match
AFTER INSERT ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.auto_start_match_on_game();
