alter table public.team_matches
    add column if not exists scheduled_date timestamp with time zone,
    add column if not exists scheduled_time text,
    add column if not exists table_name text;

update public.team_matches tm
set
    scheduled_date = (
        date_trunc('day', l.start_date) +
        ((greatest(tm.week_number, 1) - 1) * interval '7 day')
    ),
    scheduled_time = coalesce(tm.scheduled_time, l.time_slots[1], '19:00'),
    table_name = coalesce(tm.table_name, l.table_names[1], 'Table 1')
from public.leagues l
where tm.league_id = l.id
  and l.is_team_league = true
  and l.start_date is not null
  and tm.scheduled_date is null;
