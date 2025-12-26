-- Matches -> topic "match:{id}:changes"
CREATE OR REPLACE FUNCTION public.match_broadcast_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'match:' || COALESCE(NEW.id, OLD.id)::text || ':changes',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS matches_broadcast ON public.matches;
CREATE TRIGGER matches_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.match_broadcast_trigger();

-- Games -> topic "match:{match_id}:changes"
CREATE OR REPLACE FUNCTION public.game_broadcast_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t_match_id uuid;
BEGIN
  t_match_id := COALESCE(NEW.match_id, OLD.match_id);
  IF t_match_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM realtime.broadcast_changes(
    'match:' || t_match_id::text || ':changes',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS games_broadcast ON public.games;
CREATE TRIGGER games_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.game_broadcast_trigger();
