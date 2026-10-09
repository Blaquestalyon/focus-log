# Decisions

Each entry records what was decided and WHY, so a future reader can check whether the reason still holds.


## 2026-10-09 — Data model

- **The schema migration is written to be re-runnable** (`create … if not exists`, `create or replace`, drop-then-create for triggers and policies).
  *Why:* it is applied first through the platform's migration tool, and the deploy's pre-deploy command (`supabase db push`, blueprint §10) may apply the same file again if the tool did not record it in Supabase's migration history. Re-running must be harmless. *Still holds while:* migrations are applied by more than one path.
- **The owner's account was created by the seed SQL** (a row in `auth.users` + `auth.identities`, email confirmed, empty password) rather than by `auth.admin.createUser`.
  *Why:* the data-model step runs before the app exists and without the service-role key; the result is the same account the blueprint describes (confirmed, no password, owner sets it through the emailed link). The app's own `npm run seed` script (build phase) uses `auth.admin.createUser` and skips the owner when the email already exists. *Re-check if:* Supabase changes the shape of `auth.users` / `auth.identities`.
- **Names are trimmed by a small database trigger** (`fl_trim_name`) as well as by the API.
  *Why:* §3 says names are "stored trimmed"; the trigger guarantees it whatever writes the row.
- **Grants are narrower than "all four to authenticated" on three tables:** `email_log` is select-only for `authenticated`, and `user_settings` / `timer_state` are select+update.
  *Why:* §3 gives those tables no insert/delete policies for the owner (T-S3 requires `authenticated` cannot write `email_log`); RLS already blocks it, the grants make it explicit.
- **Internal helpers** `fl__lock_state`, `fl__run_closed_seconds` and `fl__iso` sit beside the `fl_timer_*` functions, with the same execute rights.
  *Why:* each timer function needs the same lock-and-check and the same run sum; `fl__iso` gives every timer view one ISO 8601 UTC format with milliseconds.
- **Remove example data deletes every session still marked as an example, including example sessions on a task that has been claimed.** The claimed task and project stay, carrying only the owner's real time.
  *Why:* §3/§6 say removal deletes "the rows that are still examples"; a claim converts the task/project, not the sample sessions under it.
- **Supabase Auth settings are not a database migration.** Sign-ups off, minimum password length 10, OTP expiry 3600s and the Site URL (§10 step 2) are set during wiring against the live URL.
  *Why:* they live in Supabase Auth's project config, not in SQL.
- **A local database test** (`tests/db/`) runs the migration and the seed twice on a throwaway Postgres with a stand-in for Supabase's `auth` schema and roles, then exercises every timer transition, the five-second and 24-hour rules, Undo, example claims and removal, delete-all, and the access rules for a second user and `anon`.
  *Why:* the timer functions are the app's primary objective (§1); they are proven before anything is built on them.
- **The live database was rebuilt once, on 2026-10-09, to exactly the committed migration** (`supabase/oneoff/2026-10-09-rebuild-from-draft.sql`, kept for the record; it is NOT a migration and must never be moved into `supabase/migrations`).
  *Why:* an earlier build session had created the tables from a draft schema that was never committed. The committed migration only creates tables that are missing, so it landed on top of the draft tables and left a hybrid (draft constraints, a second new-user trigger, a stray function). A read-only check confirmed the database held only example rows and the owner's unused account, so the tables were dropped and recreated from the committed migration, keeping the owner's login, then re-seeded. A follow-up check confirmed one new-user trigger, no draft leftovers, the owner's login with its email identity, and the expected example rows. *Lesson:* a "create if missing" migration can't repair a database built by something else. Check what a database already holds before trusting it.
- **The seed also repairs the owner's login record** (empty instead of NULL token fields, an email identity row) whenever it runs.
  *Why:* the owner account was first created by the earlier session in an unknown way, and Supabase's sign-in service fails on NULL token fields and needs an email identity for the set-password link.
