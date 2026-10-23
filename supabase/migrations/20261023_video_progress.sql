-- Title: Video watch progress — resume point + how far each member has watched
--
-- Our own video player (no Vimeo/YouTube) records, per member and per video:
--   position_seconds  where they left off (resume point)
--   furthest_seconds  the furthest point they've actually played to
--   duration_seconds  the video's length
-- A video counts as watched at furthest >= 90% of duration; that unlocks the
-- lesson's Mark Complete button, or the 5D Machine step that contains it.
--
-- source_id identifies the video: the content_items id for a single-video
-- lesson, or the lesson_blocks id for a video block in a 5D Machine lesson.
-- (No FK, since it points at one of two tables.)
--
-- Writes go only through save_video_progress(), which ties the row to the
-- caller and only ever moves furthest_seconds FORWARD — a later save from an
-- earlier position (e.g. after rewinding) never lowers it. Members read only
-- their own rows. The player itself can't scrub forward; this is the record.
--
-- Idempotent: safe to re-run.

create table if not exists public.video_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  source_id        uuid not null,
  position_seconds real not null default 0 check (position_seconds >= 0),
  furthest_seconds real not null default 0 check (furthest_seconds >= 0),
  duration_seconds real not null default 0 check (duration_seconds >= 0),
  updated_at       timestamptz not null default now(),
  primary key (user_id, source_id)
);

alter table public.video_progress enable row level security;

drop policy if exists "video_progress_select_own" on public.video_progress;
create policy "video_progress_select_own"
  on public.video_progress
  for select
  using ((select auth.uid()) = user_id);

-- No direct client writes: the RPC below is the only write path.
revoke insert, update, delete on public.video_progress from anon, authenticated;
grant select on public.video_progress to authenticated;

create or replace function public.save_video_progress(
  _source_id uuid,
  _position  real,
  _duration  real
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _pos real;
begin
  if _uid is null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if _source_id is null or _duration is null or _duration <= 0 or _duration > 86400
     or _position is null or _position < 0 then
    raise exception 'BAD_PROGRESS' using errcode = '22023';
  end if;
  _pos := least(_position, _duration);

  insert into public.video_progress as vp
    (user_id, source_id, position_seconds, furthest_seconds, duration_seconds, updated_at)
  values (_uid, _source_id, _pos, _pos, _duration, now())
  on conflict (user_id, source_id) do update
    set position_seconds = excluded.position_seconds,
        furthest_seconds = greatest(vp.furthest_seconds, excluded.furthest_seconds),
        duration_seconds = excluded.duration_seconds,
        updated_at       = now();
end;
$$;

revoke execute on function public.save_video_progress(uuid, real, real) from public, anon;
grant  execute on function public.save_video_progress(uuid, real, real) to authenticated;
