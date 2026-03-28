
-- Add agreement columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bylaws_agreed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bis_rules_agreed boolean DEFAULT false;
  