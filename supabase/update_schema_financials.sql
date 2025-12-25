
-- Add creation_fee column to leagues table to track the fee charged at creation time
alter table public.leagues 
add column if not exists creation_fee numeric default 0;

-- Seed default creation fee in system_settings
insert into public.system_settings (key, value)
values ('default_creation_fee', '100')
on conflict (key) do nothing;
