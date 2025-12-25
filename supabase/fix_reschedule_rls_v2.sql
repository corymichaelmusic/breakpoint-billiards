
-- Drop existing policies to ensure clean state
drop policy if exists "Reschedule requests viewable by everyone" on reschedule_requests;
drop policy if exists "Enable read access for all users" on reschedule_requests;
drop policy if exists "Authenticated can view all requests" on reschedule_requests;

-- Create explicit SELECT policy for authenticated users
create policy "Authenticated can view all requests"
on reschedule_requests
for select
to authenticated
using (true);

-- Ensure Insert/Update policies are also sane (optional but good practice)
-- (Assuming existing ones are fine, but let's re-verify)
