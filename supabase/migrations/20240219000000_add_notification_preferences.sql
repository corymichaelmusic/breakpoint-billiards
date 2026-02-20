-- Add notification preference columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notify_mentions boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_match_day boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_league boolean DEFAULT true;
