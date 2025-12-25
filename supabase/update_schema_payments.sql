-- Add payment tracking to league_players
alter table public.league_players 
add column if not exists payment_status text check (payment_status in ('unpaid', 'paid', 'waived')) default 'unpaid',
add column if not exists amount_paid numeric default 0;

-- Add payment tracking to matches
alter table public.matches
add column if not exists payment_status_p1 text check (payment_status_p1 in ('unpaid', 'paid_cash', 'paid_online', 'waived', 'pending')) default 'unpaid',
add column if not exists payment_status_p2 text check (payment_status_p2 in ('unpaid', 'paid_cash', 'paid_online', 'waived', 'pending')) default 'unpaid';
