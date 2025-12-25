-- Fix for Clerk Integration: Allow non-UUID user IDs in storage.objects.owner
ALTER TABLE storage.objects ALTER COLUMN owner TYPE text;
