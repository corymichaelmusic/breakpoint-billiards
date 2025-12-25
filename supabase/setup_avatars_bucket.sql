-- Enable Storage Extension (if not already)
-- create extension if not exists "storage" schema "extensions";

-- Create the 'avatars' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up RLS Policies for the bucket

-- 1. Everyone can view avatars (Public Read)
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- 2. Authenticated users can upload their own avatar
-- Restrict folder structure to: avatars/{user_id}/*
create policy "Authenticated users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Authenticated users can update/delete their own avatar
create policy "Authenticated users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
