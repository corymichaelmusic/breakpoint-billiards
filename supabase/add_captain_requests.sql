-- Captain Requests Table
-- Players can request to become team captain; operator reviews these on the session dashboard.

CREATE TABLE IF NOT EXISTS public.captain_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (league_id, player_id)
);

-- RLS
ALTER TABLE public.captain_requests ENABLE ROW LEVEL SECURITY;

-- Players can insert their own requests
CREATE POLICY "Players can request captaincy"
ON public.captain_requests FOR INSERT
WITH CHECK (auth.uid()::text = player_id);

-- Players can read their own requests
CREATE POLICY "Players can view own requests"
ON public.captain_requests FOR SELECT
USING (auth.uid()::text = player_id);

-- Operators can view all requests (via admin client, bypasses RLS)
-- No additional policy needed; admin client used server-side.
