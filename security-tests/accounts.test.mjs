import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("database isolates accounts, denies anonymous access, and rejects stale saves", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609060001_accounts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const alice = "11111111-1111-4111-8111-111111111111",
      bob = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users values ($1,$2),($3,$4)", [
      alice,
      JSON.stringify({ name: "Alice" }),
      bob,
      JSON.stringify({ name: "Bob" }),
    ]);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.learner_progress"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.save_learner_progress('{}',0)"),
      /permission denied/,
    );
    await db.exec("reset role;set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    const own = await db.query("select * from public.learner_progress");
    assert.equal(own.rows.length, 1);
    assert.equal(own.rows[0].user_id, alice);
    assert.equal(own.rows[0].progress.name, "Alice");
    assert.equal(
      (
        await db.query(
          "select * from public.learner_progress where user_id=$1",
          [bob],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "update public.learner_progress set progress='{}' where user_id=$1",
        [bob],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("delete from public.learner_progress where user_id=$1", [bob]),
      /permission denied/,
    );
    const p = { ...own.rows[0].progress, xp: 30, completed: [0] };
    const saved = await db.query(
      "select * from public.save_learner_progress($1,0)",
      [JSON.stringify(p)],
    );
    assert.equal(saved.rows[0].progress.xp, 30);
    assert.equal(saved.rows[0].version, 1);
    await assert.rejects(
      db.query("select * from public.save_learner_progress($1,0)", [
        JSON.stringify({ ...p, xp: 0 }),
      ]),
      /Progress changed/,
    );
    await assert.rejects(
      db.query("select * from public.save_learner_progress($1,1)", [
        JSON.stringify({ ...p, xp: -5 }),
      ]),
      /progress_shape/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      bob,
    ]);
    const other = await db.query("select * from public.learner_progress");
    assert.equal(other.rows.length, 1);
    assert.equal(other.rows[0].progress.xp, 0);
    assert.equal(other.rows[0].progress.name, "Bob");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(
      db.query("select * from public.save_learner_progress($1,0)", [
        JSON.stringify(p),
      ]),
      /Authentication required/,
    );
    await db.exec("reset role");
    // Reapplying after manual dashboard setup must preserve saved account data.
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609060001_accounts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query(
          "select progress from public.learner_progress where user_id=$1",
          [alice],
        )
      ).rows[0].progress.xp,
      30,
    );
    const columns = await db.query(
      "select column_name from information_schema.columns where table_schema='public' and table_name='learner_progress'",
    );
    assert.deepEqual(
      columns.rows.map((r) => r.column_name),
      ["user_id", "progress", "version", "updated_at"],
    );
  } finally {
    await db.close();
  }
});
