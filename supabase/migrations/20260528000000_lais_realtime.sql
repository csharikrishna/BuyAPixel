-- Enable Realtime for Live Activity Feed tables
alter publication supabase_realtime add table public.pixel_blocks;
alter publication supabase_realtime add table public.pixel_clicks;

-- Ensure public can read basic profile info for the Live Ticker
-- Note: 'profiles_select_own' was originally restricted to authenticated users.
-- The marketplace naturally requires public visibility of spot owners.
create policy "profiles_select_public" on public.profiles
  for select using (deleted_at is null);
