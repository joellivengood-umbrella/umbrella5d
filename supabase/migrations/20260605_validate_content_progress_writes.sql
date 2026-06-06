-- Integrity: only allow marking PUBLISHED content complete.
--
-- content_progress_insert_own previously checked only
-- (auth.uid() = user_id), so a user could write progress rows for ANY
-- content_item_id — including unpublished/draft items admins are still
-- staging. That produces garbage / inflated completion data, and it
-- surfaces (fetchCompletedItemIds doesn't filter on publish status).
--
-- Fix: gate the write on the item being published, via a SECURITY
-- DEFINER helper used in the policy's WITH CHECK. No client changes —
-- the existing upserts in MarkCompleteButton and the POTD player now
-- simply must satisfy the tighter check (legit completes always do,
-- since the app only ever surfaces published items).
--
-- Also adds the previously-missing UPDATE policy so the upserts'
-- on-conflict path is sound (was relying on rows never conflicting).
--
-- Idempotent: create-or-replace function, drop-then-create policies.

create or replace function public.is_item_published(_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.content_items
     where id = _item_id and is_published = true
  );
$$;

revoke execute on function public.is_item_published(uuid) from public;
grant  execute on function public.is_item_published(uuid) to authenticated;

-- INSERT: own row + the item must be published.
drop policy if exists "content_progress_insert_own" on public.content_progress;
create policy "content_progress_insert_own"
  on public.content_progress
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_item_published(content_item_id)
  );

-- UPDATE: own row, same publish guard (makes upsert's on-conflict path
-- valid; there was no UPDATE policy before).
drop policy if exists "content_progress_update_own" on public.content_progress;
create policy "content_progress_update_own"
  on public.content_progress
  for update
  to authenticated
  using ( auth.uid() = user_id )
  with check (
    auth.uid() = user_id
    and public.is_item_published(content_item_id)
  );
