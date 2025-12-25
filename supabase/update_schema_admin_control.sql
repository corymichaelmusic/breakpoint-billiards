-- Add operator_status to profiles
alter table public.profiles
add column if not exists operator_status text check (operator_status in ('pending', 'approved', 'rejected', 'none')) default 'none';

-- Add creation_fee_status to leagues (for sessions)
alter table public.leagues
add column if not exists creation_fee_status text check (creation_fee_status in ('unpaid', 'paid', 'waived')) default 'unpaid';
