# Progress

## Done
- Data model applied and approved; second migration (session_rows view + email claim) applied.
- Server: env checks, request helpers, rate limits, every §7 API route, Postmark email (templates, exactly-once, retries, cap), pop-up alerts (web-push), scheduler, status, middleware, boot hook.
- UI: tokens and base styles, shared components with the state matrix, app shell (sidebar / rail / drawer), command palette, keyboard shortcuts, dialogs, Sign in, Set password, Timer, Reports, History, Your data, Settings.
- Service worker, manifest, icons (generated before every build); seed script; token lint; 39 unit tests; database test.
- Self-check: clean build, lint, type check, unit tests and database test all pass; app boots; /api/health answers.
- Click-through against a local stand-in of the database and login service (real Postgres + the Supabase login and data servers): sign in, set password from a link (and a reused link is refused), start / pause / resume / stop / switch, Reports week and month, History (search, empty match, add time, overlap message, edit, delete), Your data (projects, tasks, sent emails, new project, duplicate name, remove examples), Settings (save on change, wrong current password), sign out, 401 after sign-out; desktop 1440px and phone 360px with no sideways overflow.
- Fixes from the click-through: the task list now closes after a start so the clock is visible; Add time no longer overwrites times typed before its default start arrives; table headers no longer wrap; `npm run dev` works (boot code kept out of the edge bundle).
- Optimization passes (same behavior, fewer duplicate code paths; see decisions.md 2026-10-09 — Optimization pass, and the second pass).
- Session resumed 2026-10-09: repo blueprint confirmed byte-identical to the owner's plan; clean install, production build, token lint + type check, 39 unit tests and the database test all pass again; the production server boots, `/api/health` answers, signed-out `/` redirects to sign-in, `/sw.js` is public with `Cache-Control: no-cache`.

## In progress
- QA fix round (15 failures from snapshot 80b6a4f). Fixed in code and re-checked locally with the testers' own scripts against the local stand-in: icons folder created by the build step; starfields render (sign-in 14, stage 10, avoiding card/clock/bar/controls); gold hairline aligned with the first digit; running Today row reads `<1m`; single Esc closes dialogs and focus returns to the ⋯ trigger; `N` from other screens focuses the task box; muted text on overlays raised to secondary (help, shortcuts, palette) and the help link underlined; tab panels show the gold ring; popovers/selects inside dialogs sit above the dialog; hit targets (segmented 40/44, switches 40/44, mini-timers 40/44); History task column readable at tablet width; timer race returns the another-device message instead of a 500; `%`/`_` search escaped for PostgREST's quoted values.
- All code fixes pushed (3d437a6, e4a2f83, 1721504, e144797, 5911ae5); literal `%` search and the parallel-start race (18 runs, no server errors) confirmed locally; trimmed lockfile committed so `npm ci` works (see decisions.md).
- Sign-ups turned off by the owner during wiring (T-A7 resolved).
- Deploy: blueprint reconciled with what ships (decisions.md "Deploy"); `railway.json` added (pre-deploy migrate, health check, no sleeping); `APP_URL` falls back to Railway's generated domain; public `GET /health` added; `npm run migrate` skips when `SUPABASE_DB_URL` is unset (the platform cannot supply it).
- LIVE: https://focus-log-production.up.railway.app (Railway project a4e6df72…, service 94b58172…). verify_live passed: /health, /api/health (db ok, scheduler ok), sign-in page, /sw.js (no-cache), manifest, built icon, password-link 202, wrong password 401, signed-out redirect, /api/timer 401. Same-origin check confirmed live (own origin passes, foreign 403).
- VAPID key pair generated once and set on Railway via wiring variables (not in the repo, not stored anywhere else). Confirmed working: owner allowed alerts in Edge and received the test alert.
- Wiring done: owner set their password via the emailed link (Postmark sending works), signed in and ran a timer; sign-ups confirmed off; clock clipping fixed (owner chose "shrink to fit", live 84cb9b9); Chrome Work profile cannot register push (outside the app); review question answered: nothing missing.

## Watch in QA
- One React hydration warning (#418, text mismatch) appeared once on the Timer page during the first production click-through. It did not recur in three later production runs or in a development-mode run, which would have named the mismatching text. Likely a time-of-day boundary in server vs browser rendering; QA should watch for it.

## Next
- Handoff delivered. Later changes come through VibeStack Builder (change requests).
- Optional for the owner: add SUPABASE_DB_URL on Railway so each deploy applies its own migrations; upgrade Supabase to Pro for daily backups.

## Notes for testers
- The headless Chromium build used here (single-process) shares cookies between browser contexts; use a separate browser launch when a test needs a signed-out second visitor.
