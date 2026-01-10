-- 1. Drop dependencies
DROP VIEW IF EXISTS public.v_league_players_visible;
DROP FUNCTION IF EXISTS public.get_league_players_visible(uuid);

-- 2. Drop columns
ALTER TABLE games DROP COLUMN IF EXISTS is_win_zip;
ALTER TABLE league_players DROP COLUMN IF EXISTS total_win_zip;
ALTER TABLE league_players DROP COLUMN IF EXISTS total_win_zip_8ball;
ALTER TABLE league_players DROP COLUMN IF EXISTS total_win_zip_9ball;

-- 3. Recreate View Dependency Function
CREATE OR REPLACE FUNCTION public.get_league_players_visible(_league_id uuid DEFAULT NULL)
RETURNS SETOF public.league_players
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.league_players lp
  WHERE 
    -- Filter by league_id if provided
    (_league_id IS NULL OR lp.league_id = _league_id)
    AND (
        -- Visibility Logic:
        -- 1. User sees their own membership
        lp.player_id = (select auth.uid()::text)
        OR
        -- 2. Operators see memberships in their leagues
        EXISTS (
            SELECT 1 FROM public.leagues l
            WHERE l.id = lp.league_id
            AND l.operator_id = (select auth.uid()::text)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_league_players_visible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_players_visible(uuid) TO authenticated;

-- 4. Recreate View
CREATE OR REPLACE VIEW public.v_league_players_visible AS
SELECT * FROM public.get_league_players_visible(NULL::uuid);

GRANT SELECT ON public.v_league_players_visible TO authenticated;


-- 5. Update finalize_match_stats function to remove Win-Zip parameters and logic
CREATE OR REPLACE FUNCTION finalize_match_stats(
    p_match_id uuid,
    p_game_type text,
    p_winner_id text,
    p_p1_delta numeric,
    p_p2_delta numeric,
    p_p1_racks_won int,
    p_p1_racks_lost int,
    p_p2_racks_won int,
    p_p2_racks_lost int,
    
    -- Granular Stats
    p_p1_break_runs int default 0,
    p_p1_rack_runs int default 0,
    p_p1_snaps int default 0,
    p_p1_early_8s int default 0,
    
    p_p2_break_runs int default 0,
    p_p2_rack_runs int default 0,
    p_p2_snaps int default 0,
    p_p2_early_8s int default 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player1_id text;
    v_player2_id text;
    v_league_id uuid;
    v_status_8ball text;
    v_status_9ball text;
    v_winner_8ball text;
    v_winner_9ball text;
    v_is_shutout boolean := false;
BEGIN
    -- 1. Get Match Info
    select player1_id, player2_id, league_id into v_player1_id, v_player2_id, v_league_id
    from matches
    where id = p_match_id;

    -- 2. Update Match Status
    if p_game_type = '8ball' then
        update matches 
        set status_8ball = 'finalized', 
            winner_id_8ball = p_winner_id 
        where id = p_match_id;
    else
        update matches 
        set status_9ball = 'finalized', 
            winner_id_9ball = p_winner_id 
        where id = p_match_id;
    end if;

    -- Check for Shutout Condition
    select status_8ball, status_9ball, winner_id_8ball, winner_id_9ball
    into v_status_8ball, v_status_9ball, v_winner_8ball, v_winner_9ball
    from matches
    where id = p_match_id;

    if v_status_8ball = 'finalized' and v_status_9ball = 'finalized' then
        if v_winner_8ball = v_winner_9ball then
            v_is_shutout := true;
        end if;
    end if;

    -- 3. Update Player 1 Stats
    update league_players
    set 
        breakpoint_rating = breakpoint_rating + p_p1_delta,
        breakpoint_racks_won = breakpoint_racks_won + p_p1_racks_won,
        breakpoint_racks_lost = breakpoint_racks_lost + p_p1_racks_lost,
        matches_won = matches_won + (case when v_player1_id = p_winner_id then 1 else 0 end),
        matches_lost = matches_lost + (case when v_player1_id != p_winner_id then 1 else 0 end),
        breakpoint_racks_played = breakpoint_racks_played + (p_p1_racks_won + p_p1_racks_lost),
        matches_played = matches_played + 1,
        shutouts = shutouts + (case when v_is_shutout and v_player1_id = v_winner_8ball then 1 else 0 end),
        
        -- Granular Updates
        total_break_and_runs = total_break_and_runs + p_p1_break_runs,
        total_rack_and_runs = total_rack_and_runs + p_p1_rack_runs,
        -- total_win_zip REMOVED
        total_nine_on_snap = total_nine_on_snap + p_p1_snaps,
        total_early_8 = total_early_8 + p_p1_early_8s,
        
        -- Split Updates
        total_break_and_runs_8ball = total_break_and_runs_8ball + (case when p_game_type = '8ball' then p_p1_break_runs else 0 end),
        total_break_and_runs_9ball = total_break_and_runs_9ball + (case when p_game_type = '9ball' then p_p1_break_runs else 0 end),
        total_rack_and_runs_8ball = total_rack_and_runs_8ball + (case when p_game_type = '8ball' then p_p1_rack_runs else 0 end),
        total_rack_and_runs_9ball = total_rack_and_runs_9ball + (case when p_game_type = '9ball' then p_p1_rack_runs else 0 end)
        -- total_win_zip_8ball/9ball REMOVED
        
    where league_id = v_league_id and player_id = v_player1_id;

    -- Update Global Profile Rating (Player 1)
    update profiles
    set breakpoint_rating = breakpoint_rating + p_p1_delta
    where id = v_player1_id;

    -- 4. Update Player 2 Stats
    update league_players
    set 
        breakpoint_rating = breakpoint_rating + p_p2_delta,
        breakpoint_racks_won = breakpoint_racks_won + p_p2_racks_won,
        breakpoint_racks_lost = breakpoint_racks_lost + p_p2_racks_lost,
        matches_won = matches_won + (case when v_player2_id = p_winner_id then 1 else 0 end),
        matches_lost = matches_lost + (case when v_player2_id != p_winner_id then 1 else 0 end),
        breakpoint_racks_played = breakpoint_racks_played + (p_p2_racks_won + p_p2_racks_lost),
        matches_played = matches_played + 1,
        shutouts = shutouts + (case when v_is_shutout and v_player2_id = v_winner_8ball then 1 else 0 end),
        
        -- Granular Updates
        total_break_and_runs = total_break_and_runs + p_p2_break_runs,
        total_rack_and_runs = total_rack_and_runs + p_p2_rack_runs,
        -- total_win_zip REMOVED
        total_nine_on_snap = total_nine_on_snap + p_p2_snaps,
        total_early_8 = total_early_8 + p_p2_early_8s,
        
        -- Split Updates
        total_break_and_runs_8ball = total_break_and_runs_8ball + (case when p_game_type = '8ball' then p_p2_break_runs else 0 end),
        total_break_and_runs_9ball = total_break_and_runs_9ball + (case when p_game_type = '9ball' then p_p2_break_runs else 0 end),
        total_rack_and_runs_8ball = total_rack_and_runs_8ball + (case when p_game_type = '8ball' then p_p2_rack_runs else 0 end),
        total_rack_and_runs_9ball = total_rack_and_runs_9ball + (case when p_game_type = '9ball' then p_p2_rack_runs else 0 end)
        -- total_win_zip_8ball/9ball REMOVED
        
    where league_id = v_league_id and player_id = v_player2_id;

    -- Update Global Profile Rating (Player 2)
    update profiles
    set breakpoint_rating = breakpoint_rating + p_p2_delta
    where id = v_player2_id;

END;
$$;
