-- Add dismissed column to reschedule_requests table
ALTER TABLE public.reschedule_requests 
ADD COLUMN IF NOT EXISTS dismissed boolean DEFAULT false;
