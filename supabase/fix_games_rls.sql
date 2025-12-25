
-- Drop potentially conflicting or incorrect policies
drop policy if exists "Enable insert for authenticated users only" on games;
drop policy if exists "Enable insert for players" on games;
drop policy if exists "Users can insert games linked to their matches" on games;
drop policy if exists "Users can update their own games" on games;
drop policy if exists "Users can update games linked to their matches" on games;
drop policy if exists "Enable update access for match players" on games;

-- Re-create the INSERT policy
create policy "Users can insert games linked to their matches"
on games for insert
to authenticated
with check (
  exists (
    select 1 from matches
    where matches.id::uuid = games.match_id::uuid
    and (
      matches.player1_id = (select auth.jwt() ->> 'sub') 
      or 
      matches.player2_id = (select auth.jwt() ->> 'sub')
    )
  )
);

-- Ensure Select is also permissive enough for them to see what they just inserted
drop policy if exists "Enable read access for all users" on games;
create policy "Enable read access for all users"
on games for select
to authenticated
using (true);

-- Ensure Update matches similar logic (usually players can update their own games? or just scorekeeper?)
drop policy if exists "Users can update their own games" on games;
create policy "Users can update games linked to their matches"
on games for update
to authenticated
using (
  exists (
    select 1 from matches
    where matches.id::uuid = games.match_id::uuid
    and (
      matches.player1_id = (select auth.jwt() ->> 'sub') 
      or 
      matches.player2_id = (select auth.jwt() ->> 'sub')
    )
  )
);
