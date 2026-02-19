-- Add push_token column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS push_token text DEFAULT NULL;

-- Make sure RLS allows users to update their own push_token (usually covered by existing update policy, but good to verify)
-- Existing policy usually allows UPDATE on own rows, so no new policy needed unless column-specific restrictions exist.
