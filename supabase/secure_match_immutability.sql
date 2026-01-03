-- Secure Match Updates
-- Prevents players from modifying structural fields (ID, Players, League)
-- They should only be able to update scores, stats, and status.

CREATE OR REPLACE FUNCTION public.check_match_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow Admins/Service Role to do anything
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Check if current user is an Operator for this league
    -- (We can skip this checks if we trust RLS "Operators can manage matches", 
    -- but for immutability it's safer to enforce globally or generically).
    -- ideally, we just want to block PLAYERS from changing these. 
    -- If the user is an operator, they might legitimately need to swap a player.
    
    -- SIMPLE CHECK: If the user is NOT the operator of the league, enforce immutability.
    IF EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE id = OLD.league_id 
        AND operator_id = auth.uid()::text
    ) THEN
        RETURN NEW; -- Operator logic, let them pass
    END IF;

    -- Otherwise, assume it's a Player (or random user passing RLS)
    -- Enforce Immutability on Structural Columns
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Cannot modify match ID';
    END IF;

    IF NEW.league_id <> OLD.league_id THEN
        RAISE EXCEPTION 'Cannot modify match League';
    END IF;

    IF NEW.player1_id <> OLD.player1_id OR NEW.player2_id <> OLD.player2_id THEN
        RAISE EXCEPTION 'Cannot modify match Players';
    END IF;

    IF NEW.week_number <> OLD.week_number THEN
        RAISE EXCEPTION 'Cannot modify match Week Number';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists to allow idempotency
DROP TRIGGER IF EXISTS trigger_match_immutability ON public.matches;

-- Attach Trigger to Matches Table
CREATE TRIGGER trigger_match_immutability
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.check_match_immutability();
