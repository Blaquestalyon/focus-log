import os from 'node:os'; import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
const dir = path.join(os.tmpdir(), 'focus-log-dbtest');
fs.rmSync(dir, { recursive: true, force: true });
const db = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54329, persistent: false });
await db.initialise(); await db.start(); await db.createDatabase('t');
const c = new pg.Client({ host: 'localhost', port: 54329, user: 'postgres', password: 'pw', database: 't' });
await c.connect();
await c.query("set timezone='UTC'");
const ws = process.argv[2] ?? process.cwd();
for (const f of [new URL('./supabase-stub.sql', import.meta.url).pathname, `${ws}/supabase/migrations/20261009000000_focus_log_schema.sql`,
                 `${ws}/supabase/migrations/20261009000000_focus_log_schema.sql`, `${ws}/supabase/seed.sql`, `${ws}/supabase/seed.sql`]) {
  await c.query(fs.readFileSync(f, 'utf8')); console.log('applied', f.split('/').pop());
}
const tests = (await import(process.argv[3] ?? new URL("./timer-functions.test.mjs", import.meta.url).href)).default;
try { await tests(c); console.log('ALL TESTS PASSED'); } catch (e) { console.error('TEST FAILURE:', e.message); process.exitCode = 1; }
await c.end(); await db.stop();
