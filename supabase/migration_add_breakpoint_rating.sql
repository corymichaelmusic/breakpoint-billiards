-- Add breakpoint_rating column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS breakpoint_rating INTEGER DEFAULT 500;

-- Backfill with existing fargo_rating
UPDATE profiles 
SET breakpoint_rating = fargo_rating;
