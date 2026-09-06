-- Apply in the Supabase SQL Editor. Private, authenticated recording pilot.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('yalla-voice-contributions', 'yalla-voice-contributions', false, 2097152,
  array['audio/webm','audio/mp4','audio/ogg','audio/wav'])
on conflict (id) do update set public=false, file_size_limit=2097152,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.voice_contributions (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  phrase_ar text not null check (char_length(phrase_ar) between 1 and 300),
  lesson_id integer not null check (lesson_id between 0 and 999),
  seconds numeric not null check (seconds between 0.4 and 21),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  mime_type text not null check (mime_type in ('audio/webm','audio/mp4','audio/ogg','audio/wav')),
  object_path text not null unique,
  consent_version text not null check (consent_version in ('pilot-v1','optional-v1')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  upload_complete boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_transcript text,
  reviewed_at timestamptz,
  reviewer_note text,
  constraint approved_voice_is_reviewed check (review_status <> 'approved' or
    (upload_complete and reviewed_at is not null and char_length(trim(reviewed_transcript)) > 0 and reviewed_transcript is not null))
);
create index if not exists voice_contributions_owner on public.voice_contributions(user_id, created_at);
alter table public.voice_contributions enable row level security;
revoke all on public.voice_contributions from anon, authenticated;
grant select on public.voice_contributions to authenticated;
drop policy if exists "Read your voice contributions" on public.voice_contributions;
create policy "Read your voice contributions" on public.voice_contributions for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.voice_contributions_ready()
returns boolean language sql stable as $$ select true $$;
revoke all on function public.voice_contributions_ready() from public, anon;
grant execute on function public.voice_contributions_ready() to authenticated;

create or replace function public.begin_voice_contribution(
  p_id uuid, p_phrase_ar text, p_lesson_id integer, p_seconds numeric,
  p_size_bytes integer, p_mime_type text, p_consent_version text
) returns public.voice_contributions
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); existing public.voice_contributions; extension text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Serialize reservations per participant so parallel requests cannot bypass quotas.
  perform 1 from auth.users where id=uid for update;
  select * into existing from public.voice_contributions where id=p_id;
  if found then
    if existing.user_id=uid and existing.phrase_ar=p_phrase_ar and existing.lesson_id=p_lesson_id
      and existing.size_bytes=p_size_bytes and existing.mime_type=p_mime_type
      and existing.seconds=p_seconds and existing.consent_version=p_consent_version then return existing;
    end if;
    raise exception 'Recording identifier unavailable' using errcode='42501';
  end if;
  if (select count(*) from public.voice_contributions where user_id=uid) >= 200
    or (select count(*) from public.voice_contributions where user_id=uid and created_at > now()-interval '1 day') >= 100
  then raise exception 'Recording limit reached. Please try again later or delete unused contributions.'; end if;
  extension := case p_mime_type when 'audio/webm' then 'webm' when 'audio/mp4' then 'm4a'
    when 'audio/ogg' then 'ogg' when 'audio/wav' then 'wav' else null end;
  if extension is null then raise exception 'Unsupported recording format'; end if;
  insert into public.voice_contributions(id,user_id,phrase_ar,lesson_id,seconds,size_bytes,mime_type,object_path,consent_version)
  values(p_id,uid,p_phrase_ar,p_lesson_id,p_seconds,p_size_bytes,p_mime_type,
    uid::text || '/' || p_id::text || '.' || extension,p_consent_version) returning * into existing;
  return existing;
end;
$$;
revoke all on function public.begin_voice_contribution(uuid,text,integer,numeric,integer,text,text) from public, anon;
grant execute on function public.begin_voice_contribution(uuid,text,integer,numeric,integer,text,text) to authenticated;

create or replace function public.complete_voice_contribution(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare contribution public.voice_contributions;
begin
  select * into contribution from public.voice_contributions where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Recording not found' using errcode='42501'; end if;
  if not exists (select 1 from storage.objects where bucket_id='yalla-voice-contributions'
    and name=contribution.object_path and (metadata->>'size')::bigint=contribution.size_bytes)
  then raise exception 'Recording upload is incomplete'; end if;
  update public.voice_contributions set upload_complete=true where id=p_id;
end;
$$;
revoke all on function public.complete_voice_contribution(uuid) from public, anon;
grant execute on function public.complete_voice_contribution(uuid) to authenticated;

create or replace function public.delete_voice_contribution(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare contribution public.voice_contributions;
begin
  select * into contribution from public.voice_contributions where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Recording not found' using errcode='42501'; end if;
  if exists (select 1 from storage.objects where bucket_id='yalla-voice-contributions' and name=contribution.object_path)
  then raise exception 'Remove the audio file through Storage before deleting this contribution'; end if;
  delete from public.voice_contributions where id=p_id;
end;
$$;
revoke all on function public.delete_voice_contribution(uuid) from public, anon;
grant execute on function public.delete_voice_contribution(uuid) to authenticated;

-- Insert requires a matching reservation; no overwriting, public URLs, or cross-account access.
drop policy if exists "Upload reserved voice contribution" on storage.objects;
create policy "Upload reserved voice contribution" on storage.objects for insert to authenticated
with check (bucket_id='yalla-voice-contributions' and exists
  (select 1 from public.voice_contributions v where v.object_path=name
    and v.user_id=(select auth.uid()) and not v.upload_complete));
drop policy if exists "Read own voice audio" on storage.objects;
create policy "Read own voice audio" on storage.objects for select to authenticated
using (bucket_id='yalla-voice-contributions' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Delete own voice audio" on storage.objects;
create policy "Delete own voice audio" on storage.objects for delete to authenticated
using (bucket_id='yalla-voice-contributions' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
