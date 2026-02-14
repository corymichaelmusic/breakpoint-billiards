-- Create chat_read_status table to track last read message per league
CREATE TABLE IF NOT EXISTS public.chat_read_status (
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, league_id)
);

-- Enable RLS
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own read status" ON public.chat_read_status;

-- Users can only read/update their own status
CREATE POLICY "Users can manage their own read status" ON public.chat_read_status
    FOR ALL USING (auth.uid()::text = user_id);
