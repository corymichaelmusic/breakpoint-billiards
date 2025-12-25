
-- Create system_settings table for global configuration
create table if not exists public.system_settings (
  key text primary key,
  value text not null
);

-- Enable RLS
alter table public.system_settings enable row level security;

-- Everyone can read settings (needed for UI to display fee)
create policy "Everyone can read system settings"
  on public.system_settings for select
  using ( true );

-- Only Admins can update settings (we'll rely on direct DB access or admin client for now)
-- But let's add a policy just in case we build an Admin UI later
create policy "Admins can update system settings"
  on public.system_settings for all
  using ( 
    exists (select 1 from public.profiles where id = auth.uid()::text and role = 'admin')
  );

-- Seed default session fee
insert into public.system_settings (key, value)
values ('default_session_fee', '25')
on conflict (key) do nothing;
