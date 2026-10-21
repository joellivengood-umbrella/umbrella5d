-- Security: logged-out visitors (anon) can no longer call our RPCs
--
-- Supabase's default privileges grant EXECUTE on every new function in
-- public to anon, authenticated and service_role EXPLICITLY. Our migrations'
-- house style (`revoke execute ... from public`) only removes the implicit
-- PUBLIC grant, so these SECURITY DEFINER RPCs stayed callable by anyone
-- holding the public anon key, without signing in:
--   lookup_invite_code       returned the organization / partner NAME for any
--                            invite code — an unauthenticated code-guessing
--                            oracle (org codes are 8 characters)
--   content_counts_by_course published lesson counts per course
--   get_partner_impact, list_partner_orgs, get_my_partner_branding,
--   create_organization, join_organization, set_partner_bumper
--                            return nothing / raise for a logged-out caller,
--                            but have no reason to be callable by one
-- The app calls every one of these only from signed-in pages (signup itself
-- runs server-side with the service-role key), so behaviour for signed-in
-- members is unchanged: authenticated and service_role keep explicit grants.
--
-- Deliberately left alone:
--   * RLS helpers — is_platform_admin, is_org_member, is_org_manager,
--     is_managed_team_member, is_lesson_published. They run INSIDE row-level
--     security policies (some of which apply to every role), so the querying
--     role must be able to execute them; for a logged-out caller they just
--     return false, so nothing leaks.
--   * Trigger functions — handle_new_user, handle_org_member_removed,
--     prevent_last_manager_removal, tg_set_updated_at,
--     tg_teams_org_id_immutable. Postgres refuses to call these outside a
--     trigger, so they expose nothing; handle_new_user runs on every signup.
--
-- Going forward, functions created in public no longer get an automatic anon
-- grant (the ALTER DEFAULT PRIVILEGES at the end). Keep the house style
-- (`revoke ... from public; grant ... to authenticated`) and grant anon
-- explicitly only for a function logged-out visitors genuinely need.
--
-- Idempotent: safe to re-run.

-- ── Remove anon (and PUBLIC) access ───────────────────────────────
revoke execute on function public.lookup_invite_code(text)                from public, anon;
revoke execute on function public.content_counts_by_course()              from public, anon;
revoke execute on function public.get_partner_impact()                    from public, anon;
revoke execute on function public.list_partner_orgs()                     from public, anon;
revoke execute on function public.get_my_partner_branding()               from public, anon;
revoke execute on function public.create_organization(text, text)         from public, anon;
revoke execute on function public.join_organization(text)                 from public, anon;
revoke execute on function public.set_partner_bumper(uuid, text)          from public, anon;

-- ── Keep signed-in + server access explicit ───────────────────────
-- (So nothing that previously relied on the PUBLIC grant loses access.)
grant execute on function public.lookup_invite_code(text)        to authenticated, service_role;
grant execute on function public.content_counts_by_course()      to authenticated, service_role;
grant execute on function public.get_partner_impact()            to authenticated, service_role;
grant execute on function public.list_partner_orgs()             to authenticated, service_role;
grant execute on function public.get_my_partner_branding()       to authenticated, service_role;
grant execute on function public.create_organization(text, text) to authenticated, service_role;
grant execute on function public.join_organization(text)         to authenticated, service_role;
grant execute on function public.set_partner_bumper(uuid, text)  to authenticated, service_role;

-- ── Stop granting anon on future functions ────────────────────────
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
