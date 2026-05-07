-- content_assignments — managers tagging specific content_items as
-- assigned to specific team members.
--
-- This is the "manager has assigned specific segments" model the
-- dashboard subtext has been hinting at since day one. Per-item,
-- per-member, no deadlines. The member-facing UI ships separately
-- (this migration backs the manager-side infrastructure only).
--
-- Idempotent: create-if-not-exists on table, drop-then-create on
-- policies.

-- ── 1. Table ───────────────────────────────────────────────────────
create table if not exists public.content_assignments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id)            on delete cascade,
  content_item_id uuid not null references public.content_items(id)  on delete cascade,
  assigned_by     uuid references auth.users(id)                     on delete set null,
  assigned_at     timestamptz not null default now(),
  -- One row per (member, item). Re-assigning the same item to the
  -- same member is a no-op.
  constraint content_assignments_user_item_key unique (user_id, content_item_id)
);

-- Lookup paths the queries actually use.
create index if not exists content_assignments_user_id_idx
  on public.content_assignments (user_id);
create index if not exists content_assignments_org_id_idx
  on public.content_assignments (org_id);

-- ── 2. Row Level Security ──────────────────────────────────────────
alter table public.content_assignments enable row level security;

-- SELECT: an assignee can see what's assigned to them. Members will
-- need this for the dashboard surface in PR 2.
drop policy if exists "users read own assignments" on public.content_assignments;
create policy "users read own assignments"
  on public.content_assignments
  for select
  to authenticated
  using ( user_id = auth.uid() );

-- SELECT: a manager of the org can see all assignments in their org.
drop policy if exists "managers read team assignments" on public.content_assignments;
create policy "managers read team assignments"
  on public.content_assignments
  for select
  to authenticated
  using ( public.is_org_manager(org_id) );

-- INSERT: only managers, only for members of their own org, and they
-- can't impersonate the assigning manager (assigned_by must be them).
-- The org_members existence check prevents managers from assigning
-- content to users who aren't actually on their team.
drop policy if exists "managers insert assignments" on public.content_assignments;
create policy "managers insert assignments"
  on public.content_assignments
  for insert
  to authenticated
  with check (
    public.is_org_manager(org_id)
    and assigned_by = auth.uid()
    and exists (
      select 1 from public.org_members
       where org_id  = content_assignments.org_id
         and user_id = content_assignments.user_id
    )
  );

-- DELETE: any manager of the org can rescind an assignment. We don't
-- restrict to "the manager who originally assigned it" — managers
-- act collectively on behalf of the org.
drop policy if exists "managers delete assignments" on public.content_assignments;
create policy "managers delete assignments"
  on public.content_assignments
  for delete
  to authenticated
  using ( public.is_org_manager(org_id) );

-- (No UPDATE policy by design — there's nothing to mutate. To change
--  what's assigned, delete + re-insert.)
