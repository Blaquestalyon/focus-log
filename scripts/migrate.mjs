/**
 * Pre-deploy migrations (blueprint §10): `supabase db push --db-url "$SUPABASE_DB_URL" --include-all`.
 * When SUPABASE_DB_URL is not set on the host, migrations are applied through the platform's
 * migration tool instead, so this step says so plainly and lets the deploy continue.
 * With the URL set, any migration error fails the deploy (non-zero exit), as §10 requires.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const url = process.env.SUPABASE_DB_URL?.trim();
if (!url) {
  console.log('migrate: SUPABASE_DB_URL is not set, so no migrations were run by this deploy. Apply database changes through the platform migration tool, or set SUPABASE_DB_URL to have each deploy apply them.');
  process.exit(0);
}
const bin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
const r = spawnSync(bin, ['db', 'push', '--db-url', url, '--include-all'], { stdio: 'inherit' });
if (r.error) {
  console.error(`migrate: could not run the Supabase CLI: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status ?? 1);
