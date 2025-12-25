-- Create operator_applications table
create table if not exists public.operator_applications (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  location text,
  desired_league_location text,
  notes text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  admin_selected text, -- Storing the 'Admin ID' or name if selected
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.operator_applications enable row level security;

-- Policy: Everyone can insert (public application)
create policy "Anyone can submit operator application"
  on public.operator_applications for insert
  with check (true);

-- Policy: Only admins can view (assuming admin role or service role for now)
-- For now, letting public insert is key. Viewing might be restricted.
-- In this system, we don't have a strict 'admin' role in public.profiles yet, usually just 'operator' or 'player'.
-- We'll assume service role usage for dashboard or specific authorized users later.
