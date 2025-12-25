-- Drop existing check constraint
alter table public.profiles drop constraint profiles_role_check;

-- Add new check constraint including 'admin'
alter table public.profiles add constraint profiles_role_check 
  check (role in ('operator', 'player', 'admin'));
