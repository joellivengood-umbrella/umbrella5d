-- Title: Lesson media cleanup — is a stored file still in use?
--
-- The admin panel now uploads course media straight into the lesson-media
-- bucket and deletes a file once it's replaced or removed. Before deleting,
-- it asks lesson_media_in_use(path) whether anything still points at the
-- file: a lesson's media_url, a lesson block's url, or a partner bumper.
-- Admin-only (it reveals nothing sensitive, but there's no reason for anyone
-- else to call it). Deleting the object itself still goes through the
-- existing admin-only storage policy on lesson-media.
--
-- Idempotent: create-or-replace.

create or replace function public.lesson_media_in_use(_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _suffix text;
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if _path is null or btrim(_path) = '' then
    return true; -- nothing to judge: never green-light a delete
  end if;
  _suffix := '/lesson-media/' || _path;
  return exists (select 1 from public.content_items
                  where right(media_url, length(_suffix)) = _suffix)
      or exists (select 1 from public.lesson_blocks
                  where right(data ->> 'url', length(_suffix)) = _suffix)
      or exists (select 1 from public.partners
                  where right(bumper_url, length(_suffix)) = _suffix);
end;
$$;

revoke execute on function public.lesson_media_in_use(text) from public, anon;
grant  execute on function public.lesson_media_in_use(text) to authenticated;
