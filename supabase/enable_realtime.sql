-- Enable Realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

-- Verify replica identity is set to FULL (often helpful for UPDATE events)
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
