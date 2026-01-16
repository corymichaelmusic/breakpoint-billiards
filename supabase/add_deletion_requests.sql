-- Deletion Requests Table for Account Deletion Flow
-- Players can request account deletion, admins can process them

CREATE TABLE IF NOT EXISTS public.deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES public.profiles(id) NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'processed', 'cancelled')) DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by TEXT REFERENCES public.profiles(id)
);

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON public.deletion_requests(user_id);

-- Enable RLS
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Players can insert their own deletion requests
CREATE POLICY "Users can request own deletion"
    ON public.deletion_requests FOR INSERT
    WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

-- Players can view their own requests
CREATE POLICY "Users can view own deletion requests"
    ON public.deletion_requests FOR SELECT
    USING ((auth.jwt() ->> 'sub') = user_id);

-- Admins can view and update all deletion requests
CREATE POLICY "Admins can manage deletion requests"
    ON public.deletion_requests FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (auth.jwt() ->> 'sub') AND role = 'admin'));

-- Add deleted_at column to profiles for tracking deleted accounts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
