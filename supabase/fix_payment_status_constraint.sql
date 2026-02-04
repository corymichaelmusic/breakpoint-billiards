
-- Drop the existing constraint
ALTER TABLE public.league_players 
DROP CONSTRAINT IF EXISTS league_players_payment_status_check;

-- Re-add with 'paid_online' and 'unpaid', 'paid', 'waived', 'pending'
ALTER TABLE public.league_players 
ADD CONSTRAINT league_players_payment_status_check 
CHECK (payment_status IN ('unpaid', 'paid', 'paid_online', 'waived', 'pending'));
