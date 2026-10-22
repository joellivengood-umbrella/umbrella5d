-- Consent capture: the Terms / Privacy acceptance ledger goes live, and a
-- member's "usage analytics" choice is enforced by the database itself.
--
-- 1. user_consent becomes a true append-only ledger. The original
--    unique (user_id, document, policy_version) allowed only ONE row per
--    document version, so a member couldn't switch analytics off and back
--    on under the same notice version. Every acceptance or change is now a
--    new row; the latest row per (user, document) is the current state.
--    Clients may insert only (user_id, document, policy_version, choices)
--    — never backdate consented_at — and may never update or delete.
--
-- 2. analytics_allowed(): true unless the member's latest data_notice row
--    says {"usage_analytics": false}. Analytics is ON by default (disclosed
--    on the consent screen; switchable in Settings).
--
-- 3. analytics_events' insert policy now also requires analytics_allowed(),
--    so once a member opts out, their events are refused server-side no
--    matter what the client sends (track() already swallows the error).
--
-- Idempotent: safe to re-run.

-- ── 1. Ledger shape + column grants ────────────────────────────────
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.user_consent'::regclass
       and con.contype = 'u'
  loop
    execute format('alter table public.user_consent drop constraint %I', c.conname);
  end loop;
end $$;

-- Stamp each row with the real clock time, not the transaction's start
-- (now()), so two changes in one transaction still order correctly.
alter table public.user_consent alter column consented_at set default clock_timestamp();

-- "Latest row per (user, document)" lookups.
create index if not exists user_consent_user_doc_time_idx
  on public.user_consent (user_id, document, consented_at desc);
drop index if exists public.user_consent_user_id_idx;

-- A column-level REVOKE does nothing under a table-level grant, so revoke
-- the table privileges and grant back only the writable columns.
revoke insert, update, delete on public.user_consent from anon, authenticated;
grant insert (user_id, document, policy_version, choices)
  on public.user_consent to authenticated;

-- choices stays small (it holds a few booleans).
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.user_consent'::regclass
       and conname = 'user_consent_choices_size'
  ) then
    alter table public.user_consent
      add constraint user_consent_choices_size
      check (pg_column_size(choices) <= 1024);
  end if;
end $$;

-- ── 2. analytics_allowed() ─────────────────────────────────────────
-- SECURITY INVOKER: it runs as the member, whose own consent rows are
-- readable through user_consent_select_own. Used inside an RLS policy, so
-- it stays executable by authenticated (and harmlessly by anon).
create or replace function public.analytics_allowed()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    -- Compared as text (not cast), so an odd value can't make the policy
    -- error: only an explicit false opts out.
    (select (uc.choices ->> 'usage_analytics') is distinct from 'false'
       from public.user_consent uc
      where uc.user_id = (select auth.uid())
        and uc.document = 'data_notice'
        and uc.choices ? 'usage_analytics'
      order by uc.consented_at desc, uc.id desc
      limit 1),
    true);
$$;

-- ── 3. Enforce the choice on every analytics insert ────────────────
drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  with check ((select auth.uid()) = user_id and public.analytics_allowed());
