# Progress

## Done
- Data model applied and approved (see decisions.md).
- Build: project setup (Next.js 15, Tailwind 4 tokens, TypeScript), design tokens and base styles.
- Build: shared formats and time-zone math, report and weekly-summary logic.
- Build: server side — env checks, database clients, request helpers, rate limits, timer/session/report/project/task/settings/data/status/push/auth API routes, Postmark email (templates, exactly-once sending, retries, cap), pop-up alerts, the in-process scheduler, middleware and boot hook.

## In progress
- Build: user interface (shell, components, screens).

## Next
- Service worker, manifest and icons; seed script; unit tests; README.
- Apply the second migration (session_rows view + email claim function).
- Self-check: install, build, boot, health.
