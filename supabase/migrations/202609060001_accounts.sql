-- Run once in the Supabase SQL editor. Passwords remain in Supabase Auth;
-- the application table never receives plaintext passwords or password hashes.
begin;

create table if not exists public.learner_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{"completed":[],"xp":0,"activity":{},"goal":30,"name":"","sound":true,"saved":[],"practices":0}'::jsonb,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  constraint progress_shape check (
    jsonb_typeof(progress) = 'object'
    and progress ?& array['completed','xp','activity','goal','name','sound','saved','practices']
    and jsonb_typeof(progress->'completed') = 'array'
    and jsonb_array_length(progress->'completed') <= 1000
    and jsonb_typeof(progress->'xp') = 'number'
    and (progress->>'xp')::numeric between 0 and 1000000000
    and jsonb_typeof(progress->'practices') = 'number'
    and (progress->>'practices')::numeric between 0 and 100000000
    and jsonb_typeof(progress->'activity') = 'object'
    and jsonb_typeof(progress->'name') = 'string'
    and char_length(progress->>'name') <= 30
    and (progress->>'goal')::int in (10,30,60)
    and jsonb_typeof(progress->'sound') = 'boolean'
    and jsonb_typeof(progress->'saved') = 'array'
    and jsonb_array_length(progress->'saved') <= 1000
    and octet_length(progress::text) < 250000
  )
);

alter table public.learner_progress enable row level security;
revoke all on public.learner_progress from anon, authenticated;
grant select on public.learner_progress to authenticated;
drop policy if exists "Read only your own learning progress" on public.learner_progress;
create policy "Read only your own learning progress" on public.learner_progress
  for select to authenticated using ((select auth.uid()) = user_id);

-- Writes go through a narrowly scoped RPC with optimistic concurrency. A client
-- cannot choose a different user's ID or overwrite another device silently.
create or replace function public.save_learner_progress(p_progress jsonb, p_expected_version bigint)
returns setof public.learner_progress
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query update public.learner_progress
    set progress = p_progress, version = version + 1, updated_at = now()
    where user_id = current_user_id and version = p_expected_version
    returning *;
  if not found then
    raise exception 'Progress changed on another device. Reload before saving.' using errcode = '40001';
  end if;
end;
$$;
revoke all on function public.save_learner_progress(jsonb,bigint) from public, anon;
grant execute on function public.save_learner_progress(jsonb,bigint) to authenticated;

create or replace function public.initialize_learner_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.learner_progress (user_id, progress)
  values (new.id, jsonb_build_object(
    'completed','[]'::jsonb,'xp',0,'activity','{}'::jsonb,'goal',30,
    'name',left(coalesce(new.raw_user_meta_data->>'name',''),30),
    'sound',true,'saved','[]'::jsonb,'practices',0
  ));
  return new;
end;
$$;
revoke all on function public.initialize_learner_progress() from public, anon, authenticated;
drop trigger if exists on_yalla_user_created on auth.users;
create trigger on_yalla_user_created after insert on auth.users
  for each row execute function public.initialize_learner_progress();

-- Include accounts created before the migration was applied.
insert into public.learner_progress (user_id, progress)
select id, jsonb_build_object('completed','[]'::jsonb,'xp',0,'activity','{}'::jsonb,
  'goal',30,'name',left(coalesce(raw_user_meta_data->>'name',''),30),
  'sound',true,'saved','[]'::jsonb,'practices',0)
from auth.users on conflict (user_id) do nothing;
commit;
