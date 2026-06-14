-- Promote a user to a PARTNER account.  (Manual admin operation — NOT a
-- migration; do not put this in supabase/migrations.)
--
-- Use it after the partner's auth account exists. For a real partner who
-- will log in, create that account first via the Supabase dashboard:
--   Authentication → Add User → enter their email + a temporary password,
--   tick "Auto Confirm User". (The dashboard creates a fully loginable
--   account; a raw SQL insert into auth.users would NOT be loginable.)
-- Then edit the two values below and run this in the SQL editor.
--
-- It creates the partner record (with a generated invite code), links the
-- partner to that user, and stamps their profile so they land straight in
-- the app instead of the org-onboarding screen. Re-running for the same
-- user is a no-op that just re-prints their existing code.

do $$
declare
  -- ↓↓↓ EDIT THESE TWO ↓↓↓
  v_email        text := 'partner@example.com';        -- the partner's login email
  v_partner_name text := 'Chamber of Commerce';        -- display name for the partner
  -- ↑↑↑ EDIT THESE TWO ↑↑↑
  v_uid  uuid;
  v_code text;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);
  if v_uid is null then
    raise exception 'No auth user with email %. Create them in Authentication → Add User first.', v_email;
  end if;

  -- Create the partner (or find an existing one this user already owns).
  select invite_code into v_code from public.partners where owner_id = v_uid limit 1;
  if v_code is null then
    insert into public.partners (name, owner_id)
    values (v_partner_name, v_uid)
    returning invite_code into v_code;
  end if;

  -- Mark the profile so the app treats them as set up (skips org onboarding)
  -- and shows the partner name in the header.
  update public.profiles
     set role_title        = 'Partner',
         organization_name = v_partner_name
   where id = v_uid;

  raise notice '✅ % is now a Partner. Invite code: %', v_email, v_code;
end $$;

-- Look up a partner's invite code any time:
--   select name, invite_code from public.partners order by created_at desc;
