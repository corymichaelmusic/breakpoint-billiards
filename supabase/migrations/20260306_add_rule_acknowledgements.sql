-- Add agreement columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN bylaws_agreed boolean DEFAULT false,
ADD COLUMN bis_rules_agreed boolean DEFAULT false;
