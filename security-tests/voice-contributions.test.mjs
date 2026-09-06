import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("voice pilot requires ownership, reserved uploads, consent, and review", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      alter table storage.objects enable row level security;
      grant usage on schema auth,storage to anon,authenticated;
      grant execute on function auth.uid(),storage.foldername(text) to anon,authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;`);
    const sql = await readFile(
      new URL(
        "../supabase/migrations/202609060002_voice_contributions.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    const alice = "11111111-1111-4111-8111-111111111111",
      bob = "22222222-2222-4222-8222-222222222222";
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users values($1),($2)", [alice, bob]);
    const reserve = (consent = "pilot-v1") =>
      db.query(
        "select * from public.begin_voice_contribution($1,'مرحبا',0,2,1000,'audio/webm',$2)",
        [id, consent],
      );
    await db.exec("set role anon");
    await assert.rejects(reserve(), /permission denied/);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    await assert.rejects(reserve("invalid"), /check constraint/);
    const row = (await reserve()).rows[0];
    assert.equal(row.user_id, alice);
    assert.equal(row.upload_complete, false);
    assert.equal((await reserve()).rows[0].id, id);
    await assert.rejects(
      db.query("select public.complete_voice_contribution($1)", [id]),
      /incomplete/,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name,metadata) values('yalla-voice-contributions',$1,'{}')",
        [alice + "/unreserved.webm"],
      ),
      /row-level security/,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('yalla-voice-contributions',$1,'{\"size\":1000}')",
      [row.object_path],
    );
    await db.query("select public.complete_voice_contribution($1)", [id]);
    await assert.rejects(
      db.query(
        "update public.voice_contributions set review_status='approved' where id=$1",
        [id],
      ),
      /permission denied/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      bob,
    ]);
    assert.equal(
      (await db.query("select * from public.voice_contributions")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(reserve(), /identifier unavailable/);
    await assert.rejects(
      db.query("select public.complete_voice_contribution($1)", [id]),
      /not found/,
    );
    await assert.rejects(
      db.query("select public.delete_voice_contribution($1)", [id]),
      /not found/,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name,metadata) values('yalla-voice-contributions',$1,'{}')",
        [row.object_path],
      ),
      /row-level security/,
    );
    await db.exec("reset role");
    await assert.rejects(
      db.query(
        "update public.voice_contributions set review_status='approved' where id=$1",
        [id],
      ),
      /approved_voice_is_reviewed/,
    );
    await db.query(
      "update public.voice_contributions set review_status='approved',reviewed_at=now(),reviewed_transcript='مرحبا' where id=$1",
      [id],
    );
    await db.exec(sql); // rerunning setup preserves contributions and private bucket settings
    assert.equal(
      (await db.query("select public from storage.buckets")).rows[0].public,
      false,
    );
    assert.equal(
      (await db.query("select review_status from public.voice_contributions"))
        .rows[0].review_status,
      "approved",
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    await assert.rejects(
      db.query("select public.delete_voice_contribution($1)", [id]),
      /Remove the audio file/,
    );
    await db.query("delete from storage.objects where name=$1", [
      row.object_path,
    ]);
    await db.query("select public.delete_voice_contribution($1)", [id]);
    assert.equal(
      (await db.query("select * from public.voice_contributions")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
