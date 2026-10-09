# Focus Log

A personal work timer for one owner: start, pause, resume and stop a timer on tasks filed under
projects; see today's sessions, weekly and monthly totals, and a searchable history; get a reminder
email and a browser pop-up when a timer runs too long; and a Monday summary email.

`blueprint.md` is the approved plan and the source of truth. `decisions.md` records why things are
the way they are.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, Tailwind CSS 4 with every design value in
`src/styles/tokens.css`, Radix primitives, Supabase (Postgres + Auth), Postmark for email, the
browser's built-in Web Push for pop-up alerts. One always-on web service; the scheduler runs inside it.

## Run locally

```bash
cp .env.example .env    # fill in real values
npm install
npm run dev
```

## Scripts

| Script | What it does |
|---|---|
| `npm run build` / `npm start` | Production build / start (`next start -H 0.0.0.0 -p $PORT`) |
| `npm run migrate` | Applies `supabase/migrations/*.sql` with `SUPABASE_DB_URL` (Railway pre-deploy command) |
| `npm run seed` | Creates the owner account (no password) and the example data; safe to re-run |
| `npm run icons` | Re-renders the app icons in `public/icons/` from the brand mark |
| `npm run lint` | Design-token check (no raw hex/px in components) + type check |
| `npm test` | Unit tests (time maths, formats, reports, weekly summary, CSV, service worker) |
| `npm run test:db` | Database test on a throwaway local Postgres: every timer rule and access rule |

## Configuration

Every setting is an environment variable; see `.env.example`. The app refuses to start, naming the
missing variables, without `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. Missing Postmark or VAPID keys show up on Settings → System status.

Health check: `GET /api/health`.
