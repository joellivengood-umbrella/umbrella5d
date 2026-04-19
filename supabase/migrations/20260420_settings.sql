-- Settings support: profile preference columns + avatars storage bucket.
-- Safe to re-run.

-- ── Preference columns on profiles ─────────────────────────────────
alter table public.profiles
  add column if not exists show_completed_items boolean not null default true,
  add column if not exists timezone text not null default 'America/Chicago';

-- Ensure users can update their own profile (no-op if policy exists).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- ── Avatars storage bucket ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read (bucket is public but make it explicit for RLS).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload to a folder named after their user id,
-- e.g. avatars/{user_id}/avatar_{timestamp}.png
drop policy if exists "avatars_user_upload" on storage.objects;
create policy "avatars_user_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_user_delete" on storage.objects;
create policy "avatars_user_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
