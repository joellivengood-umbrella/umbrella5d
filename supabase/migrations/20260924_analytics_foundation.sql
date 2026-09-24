-- Analytics foundation: first-party product events + consent ledger
--
-- Two tables:
--   analytics_events — one row per product event (a completion, a POTD play,
--     a machine step checked, …). Pseudonymous by design: keyed to user_id
--     with event-specific context in `properties`. Never store names, emails,
--     or the free text a user typed here — only ids, counts, and slugs. When a
--     report needs identity it joins to profiles. This keeps the engagement
--     dataset clean, minimal, and portable (the asset an acquirer diligences).
--   user_consent — an append-only ledger of a user's acceptance of a versioned
--     legal document (privacy policy / terms / data notice). Withdrawing or
--     re-accepting is a NEW row, never an update, so the history is auditable.
--     No writer is wired yet; the acceptance UI lands with the policy pages.
--
-- RLS mirrors content_progress: a user may INSERT only their own rows; normal
-- users cannot read analytics_events at all; platform admins may read it for
-- dashboards. auth.uid() is wrapped as (select auth.uid()) so Postgres
-- evaluates it once per statement instead of once per row (cheap scale win).

-- ── analytics_events ──────────────────────────────────────────────
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_name  text not null check (char_length(event_name) between 1 and 64),
  properties  jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);
create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at desc);
create index if not exists analytics_events_time_idx
  on public.analytics_events (occurred_at desc);

alter table public.analytics_events enable row level security;

-- Users may record only their own events.
drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  with check ((select auth.uid()) = user_id);

-- Only platform admins can read the event stream (for dashboards). Normal
-- users get no select policy, so the table is invisible to them.
drop policy if exists "analytics_events_select_admin" on public.analytics_events;
create policy "analytics_events_select_admin"
  on public.analytics_events
  for select
  using (public.is_platform_admin());

-- ── user_consent ──────────────────────────────────────────────────
create table if not exists public.user_consent (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  document       text not null check (document in ('privacy', 'terms', 'data_notice')),
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  choices        jsonb not null default '{}'::jsonb,
  consented_at   timestamptz not null default now(),
  unique (user_id, document, policy_version)
);

create index if not exists user_consent_user_id_idx
  on public.user_consent (user_id);

alter table public.user_consent enable row level security;

-- Users may record and read their own consent history.
drop policy if exists "user_consent_insert_own" on public.user_consent;
create policy "user_consent_insert_own"
  on public.user_consent
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_consent_select_own" on public.user_consent;
create policy "user_consent_select_own"
  on public.user_consent
  for select
  using ((select auth.uid()) = user_id);

-- Platform admins may read all consent rows (compliance audit). Multiple
-- permissive SELECT policies are OR'd, so this widens the own-row policy.
drop policy if exists "user_consent_select_admin" on public.user_consent;
create policy "user_consent_select_admin"
  on public.user_consent
  for select
  using (public.is_platform_admin());
