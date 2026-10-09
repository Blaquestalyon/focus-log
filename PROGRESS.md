# Progress

## Done
- Data model applied and approved; second migration (session_rows view + email claim) applied.
- Server: env checks, request helpers, rate limits, every §7 API route, Postmark email (templates, exactly-once, retries, cap), pop-up alerts (web-push), scheduler, status, middleware, boot hook.
- UI: tokens and base styles, shared components with the state matrix, app shell (sidebar / rail / drawer), command palette, keyboard shortcuts, dialogs, Sign in, Set password, Timer, Reports, History, Your data, Settings.
- Service worker, manifest, icons (generated before every build); seed script; token lint; 39 unit tests; database test.
- Self-check: clean build, lint, type check, unit tests and database test all pass; app boots; /api/health answers.
- Click-through against a local stand-in of the database and login service (real Postgres + the Supabase login and data servers): sign in, set password from a link (and a reused link is refused), start / pause / resume / stop / switch, Reports week and month, History (search, empty match, add time, overlap message, edit, delete), Your data (projects, tasks, sent emails, new project, duplicate name, remove examples), Settings (save on change, wrong current password), sign out, 401 after sign-out; desktop 1440px and phone 360px with no sideways overflow.
- Fixes from the click-through: the task list now closes after a start so the clock is visible; Add time no longer overwrites times typed before its default start arrives; table headers no longer wrap; `npm run dev` works (boot code kept out of the edge bundle).
- Optimization pass (same behavior, fewer duplicate code paths; see decisions.md 2026-10-09 — Optimization pass).
- Session resumed 2026-10-09: repo blueprint confirmed byte-identical to the owner's plan; clean install, production build, token lint + type check, 39 unit tests and the database test all pass again; the production server boots, `/api/health` answers, signed-out `/` redirects to sign-in, `/sw.js` is public with `Cache-Control: no-cache`.

## In progress
- Nothing open in the build or optimization phases.

## Watch in QA
- One React hydration warning (#418, text mismatch) appeared once on the Timer page during the first production click-through. It did not recur in three later production runs or in a development-mode run, which would have named the mismatching text. Likely a time-of-day boundary in server vs browser rendering; QA should watch for it.

## Next
- Full QA testing phase, then fixes from it.
- Deploy: Railway service, env vars (VAPID keys generated once), pre-deploy `npm run migrate`, health check `/api/health`.
- Wiring: Supabase Auth settings (sign-ups off, min password 10, OTP 3600s, Site URL = APP_URL), Postmark key, seed check.

## Notes for testers
- The headless Chromium build used here (single-process) shares cookies between browser contexts; use a separate browser launch when a test needs a signed-out second visitor.
