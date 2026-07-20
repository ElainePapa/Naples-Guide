-- ===== Naples Guest Guide — Supabase setup (run once) =====
-- Reuses your existing project. Guests read PUBLICLY (no login); only YOU can edit.

-- 1) The guide content (one JSON doc).
create table if not exists public.guide (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.guide enable row level security;

-- Anyone (even signed-out guests) can READ the guide.
drop policy if exists "guide_public_read" on public.guide;
create policy "guide_public_read" on public.guide for select to anon, authenticated using (true);

-- Only the owner (you) can WRITE it. Change the email if needed.
drop policy if exists "guide_owner_write" on public.guide;
create policy "guide_owner_write" on public.guide for all to authenticated
  using ( (auth.jwt() ->> 'email') = 'espector@harrityllp.com' )
  with check ( (auth.jwt() ->> 'email') = 'espector@harrityllp.com' );

-- 2) Photo storage bucket (public read) for pantry/bath/etc. photos.
insert into storage.buckets (id, name, public)
values ('guide', 'guide', true)
on conflict (id) do update set public = true;

-- Public can view guide photos; only the owner can upload/change them.
drop policy if exists "guide_photos_read" on storage.objects;
create policy "guide_photos_read" on storage.objects for select to anon, authenticated
  using ( bucket_id = 'guide' );

drop policy if exists "guide_photos_owner_write" on storage.objects;
create policy "guide_photos_owner_write" on storage.objects for all to authenticated
  using ( bucket_id = 'guide' and (auth.jwt() ->> 'email') = 'espector@harrityllp.com' )
  with check ( bucket_id = 'guide' and (auth.jwt() ->> 'email') = 'espector@harrityllp.com' );
