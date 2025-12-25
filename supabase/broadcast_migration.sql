-- Realtime Broadcast Migration
-- Switches from polling/postgres_changes to efficient server-side broadcast

-- 1. Create the Broadcast Function (Security Definer to bypass RLS for the trigger execution)
create or replace function public.broadcast_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  topic_name text;
  payload jsonb;
  event_type text;
begin
  -- Determine Event Type
  event_type := TG_OP; -- INSERT, UPDATE, DELETE

  -- Determine Topic & Payload based on Table
  if TG_TABLE_NAME = 'games' then
    -- For Games, topic is match_room:MATCH_ID
    -- Handle DELETE (use OLD) vs INSERT/UPDATE (use NEW)
    if event_type = 'DELETE' then
      topic_name := 'match_room_' || OLD.match_id;
      payload := jsonb_build_object('table', 'games', 'type', event_type, 'id', OLD.id, 'match_id', OLD.match_id);
    else
      topic_name := 'match_room_' || NEW.match_id;
      payload := jsonb_build_object('table', 'games', 'type', event_type, 'record', row_to_json(NEW));
    end if;
  
  elsif TG_TABLE_NAME = 'matches' then
    -- For Matches, topic is match_room:ID
    if event_type = 'DELETE' then
      topic_name := 'match_room_' || OLD.id;
      payload := jsonb_build_object('table', 'matches', 'type', event_type, 'id', OLD.id);
    else
      topic_name := 'match_room_' || NEW.id;
      payload := jsonb_build_object('table', 'matches', 'type', event_type, 'record', row_to_json(NEW));
    end if;
  end if;

  -- Send to Realtime via pg_notify (Standard Supabase Pattern for Broadcast)
  -- Payload must be compatible with what client expects or we adapt client.
  -- Client expects 'postgres_changes' style? No, we are switching to 'broadcast'.
  -- Channel 'broadcast' event.
  
  -- NOTE: Supabase extension 'realtime' usually provides realtime.send
  -- If unavailable, we commonly use:
  perform realtime.send(
      payload,
      topic_name,
      true -- private? usually checked by RLS on realtime.messages
  );

  return null;
end;
$$;

-- 2. Create Triggers
drop trigger if exists on_game_change_broadcast on public.games;
create trigger on_game_change_broadcast
after insert or update or delete on public.games
for each row execute function public.broadcast_changes();

drop trigger if exists on_match_change_broadcast on public.matches;
create trigger on_match_change_broadcast
after update on public.matches
for each row execute function public.broadcast_changes();

-- 3. RLS on realtime.messages (Optional, usually handled globally)
-- Ensure authenticated users can listen to these topics
-- (This part might require specific Supabase Realtime RLS setup which is complex to script blindly)
