-- Drop the specific ambiguous overload that has the win_zips parameters
-- The error message provided the exact signature to target.
-- Old signature had p_p1_win_zips and p_p2_win_zips.

DROP FUNCTION IF EXISTS public.finalize_match_stats(
  p_match_id uuid, 
  p_game_type text, 
  p_winner_id text, 
  p_p1_delta numeric, 
  p_p2_delta numeric, 
  p_p1_racks_won integer, 
  p_p1_racks_lost integer, 
  p_p2_racks_won integer, 
  p_p2_racks_lost integer, 
  p_p1_break_runs integer, 
  p_p1_rack_runs integer, 
  p_p1_snaps integer, 
  p_p1_win_zips integer,  -- The culprit
  p_p1_early_8s integer, 
  p_p2_break_runs integer, 
  p_p2_rack_runs integer, 
  p_p2_snaps integer, 
  p_p2_win_zips integer,  -- The culprit
  p_p2_early_8s integer
);
