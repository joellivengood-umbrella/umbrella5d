-- Hard guard: prevent removing the last manager from an organization.
--
-- The team UI hides the Remove button on the current user's own row,
-- so a solo manager can't accidentally orphan their org via the app.
-- This trigger is the defensive layer below the UI — it stops any
-- removal path (SQL editor, a future "Leave organization" feature,
-- unforeseen client bugs) from leaving an org with zero managers.
--
-- A manager-less org is a stuck state: no one can invite members,
-- launch POTD, or manage assignments, and there's no recovery short
-- of direct DB intervention.
--
-- BEFORE DELETE so the delete is rejected outright — the existing
-- AFTER DELETE trigger on_org_member_removed (profile + assignments
-- cleanup) only fires on successful deletions, so this guard naturally
-- prevents partial side effects too.
--
-- Idempotent: CREATE OR REPLACE function + drop-then-create trigger.

create or replace function public.prevent_last_manager_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_managers integer;
begin
  -- Member removal is always fine — the org still has managers.
  if old.role <> 'manager' then
    return old;
  end if;

  -- Count managers in the org excluding the row being removed. If
  -- removing this manager would leave zero, reject.
  select count(*)
    into remaining_managers
    from public.org_members
   where org_id = old.org_id
     and role   = 'manager'
     and id    <> old.id;

  if remaining_managers = 0 then
    raise exception
      'Cannot remove the last manager of an organization. Promote another member first.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_last_manager_removal on public.org_members;
create trigger prevent_last_manager_removal
  before delete on public.org_members
  for each row execute function public.prevent_last_manager_removal();
