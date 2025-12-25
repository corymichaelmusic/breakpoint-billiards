
-- Add session configuration columns to leagues table
alter table public.leagues
add column if not exists session_fee numeric default 0,
add column if not exists start_date date,
add column if not exists end_date date;
