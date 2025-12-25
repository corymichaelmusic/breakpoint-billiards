-- Fix reschedule_requests.requester_id type (should be text for Clerk IDs)
-- It seems it was created as UUID originally or by default, but profiles.id is text.
-- We must cast to text.
ALTER TABLE public.reschedule_requests
  ALTER COLUMN requester_id TYPE text;
