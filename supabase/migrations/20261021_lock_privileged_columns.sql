-- Security: make the "locked" columns actually locked (column grants)
--
-- Earlier migrations protected sensitive columns with a column-level
-- REVOKE, e.g. `revoke update (is_platform_admin) on public.profiles from
-- authenticated`. Postgres ignores a column-level revoke while the role still
-- holds the same privilege on the WHOLE table — and Supabase's default
-- privileges give anon/authenticated table-level INSERT/UPDATE on every
-- public table. Confirmed in production on 2026-10-21, so these columns were
-- writable wherever row-level security allowed the row:
--   profiles.is_platform_admin   any signed-in member could make themselves
--                                a platform admin (20260424_platform_admin)
--   organizations.partner_id     an organization's owner could attach it to
--                                any partner (20260616_partners)
--   partners.invite_code,        a partner's owner could change its invite
--   partners.owner_id            code or hand off ownership (20260616)
--   partners.bumper_url          a partner's owner could set their own audio
--                                pre-roll, bypassing admin control
--                                (20260620_partner_audio_bumper)
--
-- Fix: remove the table-level INSERT/UPDATE grants and grant back ONLY the
-- columns the app writes directly (call sites listed below). Everything
-- written server-side — SECURITY DEFINER functions (handle_new_user,
-- create_organization, join_organization, set_partner_bumper, ...) and the
-- service-role key — is unaffected. SELECT and DELETE are unchanged.
--
-- Rule going forward: protect a column by granting the OTHER columns, never
-- by revoking it — a column revoke does nothing under a table-level grant.
--
-- Idempotent: safe to re-run (the table-level revoke also clears column
-- grants, which are then re-granted).

-- ── profiles ──────────────────────────────────────────────────────
-- Nothing inserts directly (handle_new_user creates the row). Writers:
--   full_name, role_title                  src/app/(app)/settings/ProfileSection.tsx
--   avatar_url                             src/app/(app)/settings/ProfileSection.tsx
--   show_completed_items, timezone         src/app/(app)/settings/PreferencesSection.tsx
--   org_id, organization_name, role_title  src/components/auth/OnboardingWizard.tsx
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, role_title, avatar_url, org_id, organization_name,
              show_completed_items, timezone)
  on public.profiles to authenticated;

-- ── organizations ─────────────────────────────────────────────────
-- The app never writes this table directly: create_organization and
-- join_organization (SECURITY DEFINER) do it server-side.
revoke insert, update on public.organizations from anon, authenticated;

-- ── partners ──────────────────────────────────────────────────────
-- Partners are created by an admin script; bumper_url changes only through
-- set_partner_bumper() (admin-gated). Writers:
--   name, description, avatar_url          src/app/(app)/partner/PartnerProfileEditor.tsx
revoke insert, update on public.partners from anon, authenticated;
grant update (name, description, avatar_url)
  on public.partners to authenticated;
