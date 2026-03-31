create or replace function public.set_primary_session(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text := auth.jwt() ->> 'sub';
begin
    if v_user_id is null then
        raise exception 'Unauthorized';
    end if;

    if not exists (
        select 1
        from public.league_players lp
        join public.leagues l on l.id = lp.league_id
        where lp.player_id = v_user_id
          and lp.league_id = p_league_id
          and l.type = 'session'
          and l.status in ('active', 'setup')
    ) then
        raise exception 'Session membership not found';
    end if;

    perform pg_advisory_xact_lock(hashtext(v_user_id));

    update public.league_players
    set is_primary = false
    where player_id = v_user_id
      and is_primary = true;

    update public.league_players
    set is_primary = true
    where player_id = v_user_id
      and league_id = p_league_id;
end;
$$;

grant execute on function public.set_primary_session(uuid) to authenticated;
