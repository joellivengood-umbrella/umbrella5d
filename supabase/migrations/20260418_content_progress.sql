-- Content progress table
-- One row = one user completed one content_item.
-- Replaces the old lesson_progress (text-id) table with a polymorphic
-- UUID-keyed version that spans all course types (bss, eos, potd, machine).

create table if not exists public.content_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, content_item_id)
);

create index if not exists content_progress_user_id_idx
  on public.content_progress (user_id);

create index if not exists content_progress_content_item_id_idx
  on public.content_progress (content_item_id);

alter table public.content_progress enable row level security;

-- Users only see their own progress rows.
drop policy if exists "content_progress_select_own" on public.content_progress;
create policy "content_progress_select_own"
  on public.content_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "content_progress_insert_own" on public.content_progress;
create policy "content_progress_insert_own"
  on public.content_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "content_progress_delete_own" on public.content_progress;
create policy "content_progress_delete_own"
  on public.content_progress
  for delete
  using (auth.uid() = user_id);
