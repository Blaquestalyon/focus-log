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

## 2026-10-09 — Build

- **Next.js 15 `instrumentation.ts` starts the scheduler; its state lives on `globalThis`.**
  *Why:* §8 puts the loop inside the web process. Route handlers and the boot hook can be bundled separately, so the heartbeat that `/api/health` and System status read must be shared through `globalThis`, not a module variable.
- **Middleware runs on the Node.js runtime** (`runtime: 'nodejs'`, stable in Next 15.5).
  *Why:* it reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` at request time; the Node runtime reads environment variables at runtime rather than at build time.
- **A read-only view `session_rows` (security_invoker) and a service-role function `fl_email_log_claim`** were added in a second migration.
  *Why:* History's search must match the task name OR the project name in one query, and the exactly-once email insert needs `ON CONFLICT … WHERE is_example = false`, which the REST layer cannot express. The view runs with the caller's RLS.
- **`GET /api/sessions/:id` was added** (not listed in §7).
  *Why:* History's `?session=<id>` deep link (T-H8) must open the Edit dialog for a session that may not be on the first page. It is read-only, signed-in only and RLS-scoped.
- **`POST /api/timer/start` may include `unarchived: true`** in its timer view.
  *Why:* F3 requires the toast "Unarchived Invoice prep." when starting by name revives an archived task; the client needs to know that happened.
- **Password-link retries generate a fresh link.**
  *Why:* §8 retries failed sends after 5 and 30 minutes; the original one-time token cannot be recovered from the log (links are never stored), so a retry asks Supabase for a new one.
- **Rate limits use a sliding window** rather than a token bucket.
  *Why:* §6 states limits as "N per window"; a sliding window gives exactly "the 11th attempt in 15 minutes answers 429" (T-A2, T-S8) and "5 test alerts per hour" (T-P9).
- **`npm run migrate` uses `supabase db push --db-url … --include-all`.**
  *Why:* the live database was first built through the platform's migration tool, so Supabase's migration history is empty; `--include-all` lets the first deploy apply (harmlessly re-apply) both re-runnable migrations and record them.
- **Copy the blueprint does not pin, filled in plainly** (to confirm with the owner at review): the duplicate-task message ("You already have a task called "X" in <project>."), toasts after deleting a project or task ("Deleted X."), "Project updated." / "Task updated." / "Created X." for task creation, the Tasks tab's filtered-empty state ("No tasks match." / "Try a different word or project."), the project delete body when it has no tasks, and a short description line under "Delete all tracked data".
  *Why:* every async outcome needs a visible result (design standards); these follow the voice of the nearest specced copy.
- **Build-time dependencies are in `dependencies`.**
  *Why:* Railway installs with `NODE_ENV=production`, which skips devDependencies; TypeScript, Tailwind and `tsx` (for `npm run seed`) must be present for `npm run build` and the scripts. Test-only tools stay in devDependencies.
- **App icons are generated before every build (`prebuild` runs `scripts/icons.ts`) and are not committed.**
  *Why:* the platform's push path carries text files only, so the PNGs cannot reach the repo; rendering them from the brand mark at build time gives the deploy the same three files. *Re-check if:* binary files can be pushed — then committing them removes a build step.
- **The boot work lives in `src/instrumentation-node.ts`, imported from `instrumentation.ts` only inside the `NEXT_RUNTIME === 'nodejs'` check.**
  *Why:* with an early `return` instead, `next dev` also bundled the scheduler (and web-push) for the edge runtime and failed with "Can't resolve 'http'". Production builds were unaffected, but `npm run dev` must work for whoever maintains the app.
- **The build was clicked through against a local stand-in of Supabase** (embedded Postgres + the official PostgREST and Supabase Auth server binaries behind a small gateway), with the same migrations and seed.
  *Why:* the platform never hands the owner's database keys to the build sandbox, so this is the only way to exercise signed-in screens before deploy. It is evidence about the code, not about the live project — the deployed app is still checked against the real database at deploy.
- **The lockfile is not in the repo; every direct dependency is pinned to an exact version in `package.json` instead.**
  *Why:* the platform's push path takes file contents as text the agent writes out, and `package-lock.json` is ~200 KB of integrity hashes — a single mistyped character would make every deploy's install fail. Exact pins keep the tested versions of everything the app imports; a clean install + build from the pinned file (no lockfile, production mode) was run and passed on 2026-10-09. Indirect dependencies still resolve fresh within their own ranges. *Re-check if:* the repo can be pushed with git directly — then commit the lockfile and keep the pins.

## 2026-10-09 — Optimization pass

Same behavior, same look, same checks — fewer ways of saying them. From a clean install (dependencies unchanged throughout), `npm run build`, `npm run lint` (token lint + type check), the 39 unit tests and the database test passed before the pass and before each push, and the app booted; an old-vs-new comparison of the date labels, clipped seconds, Reports and the Monday summary on 12,180 random inputs found no differences.

- **Consolidated (API):** one path-id check (`assertId`) for every `[id]` route; one task-exists check (`assertTaskExists`) for Add time and Edit session; one 24-hour error (`sessionTooLong`) for the range check and both database-check catches; shared field rules for email address, new password, task name and project name (the name rules now use `TASK_NAME_MAX` / `PROJECT_NAME_MAX`); one recent-email count (`recentEmailCount`) for the password-link and test-email limits; `MSG.badRequest` / `MSG.tooManyAttempts` instead of repeated copies of that wording; one in-file copy of each "has logged time, so it can't be deleted" message. Every check, status code, field and message is unchanged.
- **Consolidated (shared):** `elapsedSeconds` and `rowEndMs` in `lib/time` replace 14 inline copies of "whole seconds since start, never negative" across the API, Reports, the Monday summary, Today, History and the timer, and 4 inline copies of "when this row ends" in Reports and the Monday summary (`rowEndMs` moved there from `lib/server/rows`). `formatDateStr` / `formatDayLong` share one builder. `useReducedMotion` is `useMediaQuery` with its query. The scheduler builds the reminder email, the running-session column list and the 10-minute claim time once each.
- **Removed (nothing used them):** `isDefaultFilters`, `resetBuckets`, the `SupabaseClient` re-export in `lib/server/history`, the `addMonths` re-export in `lib/report-core`, `DialogTrigger`, `DialogFooter`, `PopoverClose`; a Stop-at error branch identical to the one after it; a History sort-header ternary whose two branches were the same.
- **No files stubbed.**
- **Seen and left alone:** the set-password link is built in two places (password-link route and scheduler retry) with different failure handling (the route logs, the retry gives up quietly). "Pop-up alerts aren't set up yet." is written in two routes, `push.ts` and `status.ts` (the latter two load outside the request helpers). The scheduler's elapsed time has no zero floor, unlike the shared helper, so it keeps its own. History's filter UUID pattern is looser than the zod `uuid` check, so swapping it would change accepted input. Client forms repeat some server copy (password and name rules) for instant feedback in the browser; sharing it would need a new client/server module. `@radix-ui/react-visually-hidden` is in `package.json` but nothing imports it — left in place (dependency list and lockfile untouched).
