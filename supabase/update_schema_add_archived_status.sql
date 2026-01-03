-- Drop the existing check constraint
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_status_check;

-- Add the new check constraint with all valid statuses including 'setup' and 'archived'
ALTER TABLE public.leagues ADD CONSTRAINT leagues_status_check 
CHECK (status IN ('active', 'inactive', 'completed', 'setup', 'archived'));
