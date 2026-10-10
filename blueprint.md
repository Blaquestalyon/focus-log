# Focus Log — Blueprint

## How to use this blueprint
This blueprint is yours. It describes Focus Log completely enough that you can hand it to any developer or AI and they can build it without asking you anything else. Or you can let VibeStack Builder build it for you, without you ever touching code. Either way, it runs on accounts you own: your code on GitHub, your site on Railway, your data in your own Supabase project, and your emails through your own Postmark account. Nothing here locks you in.

## 1. What this app is
Focus Log is a personal work timer for one person, its owner. It is a **website**: it opens in any modern desktop or mobile browser, with nothing to install, and there is no phone app (the owner confirmed "a website in the browser" at intake). On an iPhone or iPad the same website can be added to the Home Screen so its pop-up alerts work there. It is still the website, not a separate app. The owner types a new task or picks a saved one, files it under a project or client, and then starts, pauses, resumes and stops a timer through the day. Every stretch of work becomes a timed session. The owner can see today's sessions under the clock, totals by project for any week or month, and a searchable history where mistakes can be fixed and forgotten time added. If a timer is left running too long, Focus Log nudges the owner by email and with a pop-up alert on each computer where they have allowed alerts. The pop-up appears even with no Focus Log tab open, as long as the browser itself is running. Every Monday morning it emails last week's hours.

**What Focus Log exists to do (the primary objective):** record, accurately and without fuss, how long the owner spends on each task, grouped under projects/clients. The timer has to be right. It counts from a start time saved on the server, never from ticks in a browser tab, so a sleeping laptop, a background tab, a second computer or a closed browser never corrupts the time.

**Supporting features (helpful, but not the point):** the Today list, the Reports totals, the searchable History with editing and CSV export, the over-time nudge (in-page banner, tab-title flash, pop-up alert, email), the Monday summary email, the command palette and keyboard shortcuts, and the Your data and Settings screens. If a build ever gets stuck, the timer's correctness and the session record come first. Everything else is convenience around them.

**Roles**
- **Owner** (exactly one account: `jdavis@power-in-numbers.net`). Signs in with email + password. Can do everything: run the timer; create, rename, archive and delete projects and tasks; view, edit, add, delete and export sessions; view the email log; change every setting; allow pop-up alerts on any browser and remove allowed browsers; change their password; remove example data; delete all tracked data. Every row in the database belongs to this account, and the owner sees only their own rows (enforced by row-level security).
- **Signed-out visitor.** Can reach only:
  - the Sign in screen;
  - the Set password screen, and only with a valid emailed link;
  - the "request a set-password link" form;
  - `GET /api/health`, and `GET /health` (a bare liveness answer, `{"ok":true}`, for the hosting platform);
  - the static files a browser needs before anyone signs in: the service worker `/sw.js`, the app manifest `/manifest.webmanifest` and the app icons under `/icons/`.

  Every other page redirects to `/sign-in?next=<original path>`, and every other API route answers `401`. There is **no sign-up**. The app has no sign-up screen, and new sign-ups are disabled in Supabase Auth.
- **System (the scheduler).** Not a person. A loop inside the web service that runs every 60 seconds with the database's service-role key. It:
  - reads running sessions and settings;
  - sends nudge and weekly emails through Postmark;
  - sends nudge pop-up alerts through each allowed browser's push service;
  - writes `email_log`;
  - writes the delivery fields of `push_subscriptions`, and deletes a browser's row when its push service reports it gone.

  It never creates, edits or deletes sessions, projects or tasks.

## 2. Design brief

**WORLD**
- **MOOD:** a broadcast booth after hours. The desk is navy-black, one gold readout is lit, and a small cyan "on air" lamp glows only while the clock is running. Everything else waits in the dark until it is needed.
- **COLOUR PLACEMENT:**
  - *Navy-black layers* (`#07080D` → `#1E2336`): every background, panel, row and overlay. No surface in the app is white, light grey or pure `#000000`.
  - *Metallic gold gradient* (`--gradient-gold`): used for three things.
    - The running clock's digits.
    - The sparkle inside the Focus Log mark.
    - The polished lettering taken from the owner's logo: the "Focus Log" wordmark (sidebar header, mobile top bar and the Sign in card), every page title (h1), and the display total on Reports.

    Never on buttons, body text, section or card headings, charts or borders.
  - *Flat gold* (accent ramp, anchor `#D4A745`):
    - Primary buttons (Start, Resume, Save, Set password).
    - The 2px focus ring and the 2px active-nav indicator bar.
    - The 1px hairline under the clock.
    - The 1px rim around the Timer stage (the anchor at 45% opacity, `--color-rim`).
    - The selected segment of segmented controls, and checked switches and checkboxes.
    - Text links (`--color-accent-text`).

    Never as a page or panel background, never as a chart series, never on more than ~10% of a screen.
  - *Electric cyan "signal"* (`#22C3FF`): the 8px on-air dot while a timer is running (on the stage, in the sidebar mini-timer and on the running row in Today), and the icon of info toasts. Never on buttons, text blocks or charts.
  - *Ribbon gradient* (`--gradient-ribbon`, deep navy `#0B1E6E` → electric blue `#22C3FF`): exactly three places. Nowhere else.
    - The 2px top edge of the sign-in/set-password card.
    - A 2px band across the full width of the top of the viewport on every signed-in screen, which is the sweep of blue in the owner's logo.
    - The 4px header band of both emails.
  - *Warm white* (`#F4F1E8`): primary text and the white sparkle glyphs.
  - *Project colours* (8 fixed hues, below): only 8px project dots, 3px left edges of session rows, and chart segments. Never as text colour or as a background fill.
  - *Danger red*: destructive buttons and the confirm button of destructive dialogs only.
- **LIGHT:** the running clock is the only light source.
  - **While a timer runs:** a gold pool sits under the digits. It is a radial ellipse 70% wide × 45% tall of the stage, centred 8% below the digits' midline, `#D4A745` at 7% opacity in the centre fading to 0 at the edge.
  - **On pause or stop:** the pool fades out in 300ms and the digits lose their gold.
  - **Nothing else casts light.** The gold lettering and the stage rim are polished metal, not light: they never glow, carry no halo or shadow, and look the same whether or not the timer runs.
  - **Elevation:** surfaces never carry shadows. Elevation is one step lighter surface plus a 1px border. Only things lifted off the desk toward the viewer carry a shadow (dialogs, the command palette, menus, popovers, toasts), and they share one: `0 16px 48px rgba(0,0,0,0.55)`.
- **MOTIFS:**
  1. *The four-point sparkle* (taken from the white sparkles in the owner's logo): a four-point star with concave sides, drawn as inline SVG.
     - It is the app mark: a 16px sparkle in metallic gold inside a 24px ring with a 1.5px gold stroke.
     - It is the empty-state mark: 40px, stroke-only, `--color-text-muted`.
     - It is the one-shot "logged" sparkle (signature moment 2).
     - It is the app icon: the mark centred on `#07080D`, rendered from the same SVG into 192px and 512px PNGs, plus a maskable 512px PNG with 20% safe padding. These are used by the home-screen app and by pop-up alerts.
     - It is never a decoration scattered for its own sake, except in the two fixed starfields described under Signature moment 1 (sign-in and the Timer stage).
  2. *The hairline*: a 1px rule. A gold one sits 16px under the clock, left-aligned with the first digit and 40% of the stage width. Border-coloured ones run under every page title, full content width.
  3. *Flanking micro-labels*: uppercase JetBrains Mono 12px labels set either side of a big number, each a small label stacked over its value.
     - Clock: `PROJECT`/name on the left, `STARTED`/time on the right.
     - Reports total: `WEEK OF`/range on the left, `VS LAST WEEK`/delta on the right.
  4. *The ribbon*: three placements only, listed above.
  5. *The badge rim* (taken from the thin gold outline of the owner's badge): one 1px `--color-rim` border with an 8px radius around the Timer stage. It is the only gold-edged surface in the app. Every other card, panel and dialog keeps its quiet `--color-border` edge.
  6. *Polished lettering* (taken from the heavy, wide, squared gold letters of "SHOW IT OFF"): Archivo at its widest and heaviest (`wdth 125`, `wght 800`), filled with `--gradient-gold`. It is used only for the wordmark, page titles and the Reports display total. Section headings, body text, labels and table text stay warm white or grey.
- **NEVER:**
  - no light mode;
  - no purple-to-blue SaaS gradient backgrounds;
  - no frosted glass except the command palette;
  - no card radius above 8px;
  - no confetti, fireworks, trophies or five-point stars;
  - no paragraphs in gold;
  - no glow, halo or drop shadow on gold lettering;
  - no microphone, ribbon banner, badge imagery or "Get Discovered!" slogan (those belong to Show It Off, not Focus Log);
  - no stock illustrations or photos;
  - no lone spinner standing in for content;
  - no colour-filled page backgrounds;
  - no bouncing or springy easing.

**LINEAGE.** The starting point is Obsidian: dark-first, keyboard-forward, borders over shadows, fast motion. Focus Log departs from it in four ways. The accent is a metallic gold taken from the owner's logo, not a cold single hue. The neutrals carry the navy undertone of the logo's starfield instead of neutral grey. The main screen is a single subject on a stage (one clock in a void) instead of a dense list. Density lives only on Reports and History.

**ANCHOR + RAMP** (neutral temperature: **cool, navy-tinted grey**)
| Token | Hex | Role |
|---|---|---|
| `--color-accent-subtle` | `#221B0E` | selected row / selected segment background |
| `--color-accent-subtle-border` | `#4A3B1A` | border of selected items |
| `--color-accent-hover` | `#E2B957` | primary button hover |
| `--color-accent` | `#D4A745` | **anchor**: primary button, focus ring, nav indicator, hairline |
| `--color-accent-pressed` | `#B18A2F` | primary button active |
| `--color-accent-text` | `#E8C468` | gold text (links, eyebrows) on dark surfaces |
| `--color-on-accent` | `#0B0B10` | text/icons on gold buttons |

**WCAG AA (checked):**
- `#D4A745` on `#0C0E16` = 8.6:1.
- `#0B0B10` on `#D4A745` = 8.8:1.
- `#E8C468` on `#121522` = 10.8:1.
- `#7F849A` muted text on `#0C0E16` = 5.2:1, and on `#191D2D` = 4.5:1, so muted text may never sit on anything lighter than `--color-surface-raised`.
- The darkest gradient stop of the clock (`#B98A2C`) on `#0C0E16` = 6.2:1. The same stop under the gold lettering measures 6.4:1 on `--color-bg-0` (the sidebar wordmark) and 5.8:1 on `--color-surface` (the Sign in card and the Reports total card), so the lettering passes AA at every size it is used.
- The stage rim is decorative (the stage is also identified by its heading and controls), so it carries no contrast requirement.
- Danger buttons use `#C9353F` with white text (5.2:1), because the brighter `#E5484D` fails at 3.9:1. `#FF5C6C` is used only as text/icon colour on dark (6.4:1).
- No working-shade shift is needed for the gold.

**Neutrals and semantics:**
| Token | Value | Use |
|---|---|---|
| `--color-bg-0` | `#07080D` | app canvas, sidebar |
| `--color-bg-1` | `#0C0E16` | content region |
| `--color-surface` | `#121522` | cards, table rows |
| `--color-surface-raised` | `#191D2D` | row hover, inputs, menus |
| `--color-surface-overlay` | `#1E2336` | dialogs; the palette uses it at 88% opacity with `backdrop-filter: blur(16px)` |
| `--color-border` | `#262B3F` | |
| `--color-border-strong` | `#363C56` | |
| `--color-rim` | `rgba(212,167,69,0.45)` | Timer stage rim only |
| `--color-text-primary` | `#F4F1E8` | |
| `--color-text-secondary` | `#B4B7C6` | |
| `--color-text-muted` | `#7F849A` | |
| `--color-text-disabled` | `#555A70` | |
| `--color-signal` | `#22C3FF` | |
| `--color-success` | `#3DD68C` | |
| `--color-warning` | `#FF9F43` | |
| `--color-danger` | `#C9353F` | hover `#B12D36` |
| `--color-danger-text` | `#FF5C6C` | |
| `--color-info` | `#22C3FF` | |

Gradients:
- `--gradient-gold: linear-gradient(180deg,#F7E7A6 0%,#E2BC5C 42%,#B98A2C 68%,#EFD27A 100%)`
- `--gradient-ribbon: linear-gradient(90deg,#0B1E6E 0%,#1546C9 45%,#22C3FF 100%)`

Project palette (key → hex; each is ≥3:1 on `--color-surface`): `azure #4C8DFF`, `violet #9B7BFF`, `rose #FF6B9A`, `coral #FF8A5B`, `lime #A6E05A`, `teal #2ED3B7`, `sand #C9B48A`, `slate #8A93B8`. Gold and cyan are deliberately left out, because they mean "action" and "on air".

**POSTURE:** dark only. A light mode does not ship (the owner's brand is black-first and the app has a single user). `color-scheme: dark` is set on `:root`.

**TYPE** (self-hosted, two families):
- **Archivo**, variable with width and weight axes: `@fontsource-variable/archivo/wdth.css` (use `full.css` if that file name differs in the installed version). It carries the display, headings, body and all numerals. Its expanded widths echo the wide, squared lettering of the owner's logo.
- **JetBrains Mono** 400/500 (`@fontsource/jetbrains-mono`) carries micro-labels, keyboard hints and the segmented-control labels.
- `font-feature-settings: "tnum" 1` applies to every duration, time, date number, count and chart axis.
- Every gold fill below uses `--gradient-gold` via `background-clip: text`, with the forced-colors fallback `CanvasText`.

| Role | Family / settings | Size / line-height |
|---|---|---|
| Clock | Archivo `wdth 125`, `wght 600`, tnum, tracking −0.02em | `clamp(64px, 11vw, 144px)` / 1.0 |
| Wordmark ("Focus Log") | Archivo `wdth 125`, `wght 800`, gold fill | 16px / 1 in the shell; 28px / 1.15 as the Sign in card's h1 |
| Display number (Reports totals) | Archivo `wdth 125`, `wght 800`, tnum, gold fill | 48px / 1.1 |
| Page title (h1) | Archivo `wdth 125`, `wght 800`, tracking −0.01em, gold fill | 28px / 1.15 |
| Section heading (h2) | Archivo `wdth 100`, `wght 600` | 20px / 1.25 |
| Card heading (h3) | Archivo `wdth 100`, `wght 600` | 16px / 1.25 |
| Body | Archivo `wdth 100`, `wght 400` | 16px / 1.5, measure ≤70ch |
| Body small / table | Archivo `wdth 100`, `wght 400`, tnum in numeric cells | 14px / 1.45 |
| Meta | Archivo `wght 400`, `--color-text-secondary` | 13px / 1.4 |
| Micro-label | JetBrains Mono 500, uppercase, tracking 0.08em, `--color-text-muted` (`--color-text-secondary` on overlay surfaces such as dialogs and the palette, where muted text would fall below AA) | 12px / 1.3 |
| Kbd chip | JetBrains Mono 400, 1px `--color-border-strong`, radius 4px, padding 2px 6px | 12px / 1 |

**DENSITY:** comfortable on the Timer stage; compact on History and Reports (40px rows); regular everywhere else.

**Spacing** follows a 4px grid: tokens `--space-1` 4px through `--space-20` 80px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80).

**RADIUS:** sharp.
- 4px for buttons, inputs, chips and kbd.
- 8px for cards, panels, dialogs, the palette, toasts and the Timer stage rim.
- 999px only for status pills and the on-air dot.

**ELEVATION:** borders only, plus the single overlay shadow defined under LIGHT.

**MOTION tokens:**
| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 140ms | hover, toggles, tooltips |
| `--dur-base` | 200ms | menus, toasts, list insert/remove |
| `--dur-panel` | 260ms | dialogs, drawer, palette |
| `--dur-stage` | 300ms | light-pool fade, clock colour change |
| `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` | entrances |
| `--ease-in` | `cubic-bezier(0.7,0,0.84,0)` | exits |

- **Entrances:** dialogs and the palette enter with opacity 0→1 plus scale 0.98→1. Menus enter with opacity plus a 4px downward translate, and toasts with opacity plus an 8px upward translate.
- **Reduced motion** (`prefers-reduced-motion: reduce`): every translate, scale and stagger collapses to a 120ms opacity fade. The digit stagger and the logged sparkle are skipped, and the light pool appears and disappears with a 120ms fade.

**Z-index tokens:** base 0, sticky 10, sidebar 20, dropdown 40, drawer 50, dialog 60, palette 70, toast 80, tooltip 90. A popover or select opened from inside a dialog uses the layer just above the dialog (`--z-dialog` + 1), so it is never hidden behind the dialog's backdrop.

**SIGNATURE MOMENTS**
1. **The Stage** (Timer screen hero, signed-in `/`). The upper part of the Timer screen is a void framed by the badge rim: 1px `--color-rim`, 8px radius. Its min-height is 320px at ≥1024px and 240px below that. It holds only the task name (h2), the clock, the flanking micro-labels, the gold hairline and the controls, set over a still starfield.
   - *Running:* the clock digits (`H:MM:SS`, e.g. `1:02:09`) are filled with `--gradient-gold` via `background-clip: text`, with `forced-colors` fallback `CanvasText`. The light pool glows beneath them. An 8px cyan on-air dot sits left of the task name with a soft halo (`box-shadow: 0 0 0 4px rgba(34,195,255,0.18)`) that breathes in opacity 0.18↔0.06 over 2.4s. The halo is static under reduced motion.
   - *Starting:* when a timer starts, the digits enter one character at a time, left to right, 30ms apart. Each character fades from 0 and rises 4px over 180ms with `--ease-out`.
   - *Pausing:* the digit fill crossfades over 300ms from gold to flat `--color-text-secondary`, the pool fades out, the on-air dot becomes a 2px-stroked hollow circle in `--color-text-muted`, and the right flank label changes to `PAUSED` with the pause time (e.g. `12:04 PM`).
   - *Idle:* the clock shows `0:00:00` in `--color-text-disabled` and the flanks are hidden.
   - *Starfield:* 10 white four-point sparkles inside the rim, at sizes 5–12px and opacities 4–8%.
     - They are positioned by a fixed seed, so they never change between visits.
     - They sit behind every other layer of the stage, including the light pool.
     - They are `aria-hidden` and `pointer-events: none`, and never animate.
     - None falls inside the clock's box, the task bar or the controls row.
     - They are hidden under `forced-colors`.
     - The rim and the starfield look the same in every timer state.
   - *Tab title:* while running, the document title updates every second to `▶ 1:02:09 · Invoice prep — Focus Log`. While paused it reads `❚❚ 1:02:09 · Invoice prep — Focus Log`, and while idle `Focus Log`. In a background tab, browsers may slow this update to about once a minute, and that is accepted.
   - *Sign-in screen:* this and the Timer stage are the only places the sparkle is used as atmosphere. A fixed, non-animated field of 14 white sparkles sits on the sign-in canvas, at sizes 6–14px and opacities 4–10%, positioned by a fixed seed so it never changes between visits, and none falls inside the 400px card.
2. **The logged sparkle.** When a session is closed by Pause, Stop or Switch, its row slides into the top of the Today list (height 0→40px plus fade, `--dur-base`, `--ease-out`). A single 12px white four-point sparkle then scales 0→1→0 and rotates 0→45° over 600ms, centred on the row's duration cell, once per logged session. The Today total in the Today header counts up from its old value to its new value over 400ms (tabular digits, so nothing shifts). Under reduced motion the row fades in, there is no sparkle, and the total updates instantly.

**VOICE:** brief, plain and precise, with a quiet warmth. It never cheers, never uses exclamation marks except in the weekly email subject, and always states the number.
- Empty Today: **"Nothing on the clock yet today."** / "Type what you're working on and press Start, or pick a saved task."
- Toast after Stop: **"Logged 1h 12m to Invoice prep."** with an `Undo` action.
- Confirm delete: **"Delete this session?"** / "Invoice prep, Wed Oct 8, 9:00–10:12 AM (1h 12m) will be removed from your totals. This can't be undone." Buttons `Cancel` and `Delete session`.
- Nudge banner: **"Your timer has been running for 4h 03m."** / "Still on Invoice prep?" Buttons `Keep going`, `Stop now`, `Stop at…`.

**REFERENCES** (seven drawn on, mixed):
| Reference | Taken |
|---|---|
| 11x | The 1px hairline rule set under a display headline at about 40% of its width, which becomes the gold hairline under the clock; −0.02em tracking at display size; one confident light element on a dark field. |
| 21 TSI | The single subject in a void: nothing above the fold on the Timer screen except the clock and its controls; the full-width hairline above quiet uppercase labels, used under page titles with micro-labels above the content. |
| Amrit Palace | Small uppercase labels flanking the display text left and right (`PROJECT` / `STARTED`); display text entering letter by letter, used for the clock's digits when a timer starts. |
| Dala | Sparse luminous particles on black velvet, used for the fixed starfields on sign-in (4–10% opacity) and behind the Timer stage (4–8%); a gold uppercase eyebrow above plain body copy (the Reports range eyebrow, the email headers). |
| Integrated Biosciences | Monospace uppercase labels inside a segmented control (`WEEK │ MONTH`, History presets); a button paired with a separate square chip, used as the Start button with its attached `⏎` key chip. |
| Steep | Data cards with one big tabular figure and a small muted comparison line beneath; two-column lists with right-aligned numerals (Reports "By project"). |
| Superhuman | A translucent overlay panel with backdrop blur, used only for the ⌘K palette; a dark command input with an accent chip holding the action key. |

(MEDIUM is omitted. The owner's logo set both the colours and the style: the polished gold lettering, the thin gold rim, the navy-to-electric-blue sweep and the night-sky sparkles. Every surface in Focus Log is coded in CSS and SVG, with no generated imagery, and nothing from the logo is reproduced as an image.)

## 3. Data model

**Database: Supabase (Postgres + Supabase Auth).** Focus Log writes a new record for every start, pause, resume and stop, and the server checks for runaway timers every minute. Airtable's free plan caps a base at 1,000 records and 1,000 data requests a month, which this app outgrows within months. Supabase also gives the app a secure built-in login, lets the database itself guarantee that only one timer can run and that no two sessions overlap, and returns totals over years of history quickly. Logins use Supabase Auth (email + password). Because Supabase's own dashboard is a developer tool, the owner sees and edits all data inside the app, on History, Your data and Settings.

**Extensions:** `pgcrypto` (for `gen_random_uuid()`) and `btree_gist` (for the no-overlap exclusion constraint).

**Shared conventions:**
- Every table has RLS enabled.
- `created_at timestamptz not null default now()`.
- `updated_at timestamptz not null default now()` is maintained by a `set_updated_at()` BEFORE UPDATE trigger on every table that has it.
- All timestamps are stored in UTC. The owner's time zone (in `user_settings`) is applied only when computing "today", day, week and month boundaries, and when displaying times.

**Server clock rule:** every timer start, pause, resume and stop timestamp is taken from the **database's** `now()` inside a database function (§3 *Database functions*), never from the browser.

### Table: user_settings
One row per account (exactly one in practice). It is created automatically by the `fl_handle_new_user` trigger when the auth user is created.
| Column | Type | Required | Notes |
|---|---|---|---|
| `user_id` | uuid | yes | **PK**; FK → `auth.users(id)` ON DELETE CASCADE |
| `time_zone` | text | yes | IANA name, default `'America/New_York'`; the API validates it against `Intl.supportedValuesOf('timeZone')` |
| `time_zone_confirmed` | boolean | yes | default `false`; set `true` once the browser's zone has been applied or the owner picks one |
| `nudge_after_minutes` | integer | yes | default `240`; CHECK `nudge_after_minutes BETWEEN 30 AND 720` |
| `nudge_email_enabled` | boolean | yes | default `true` |
| `nudge_browser_enabled` | boolean | yes | default `true`; turns pop-up alerts on or off for every allowed browser (push alerts and the in-tab fallback alike) |
| `weekly_email_enabled` | boolean | yes | default `true` |
| `last_project_id` | uuid | no | FK → `projects(id)` ON DELETE SET NULL; the default project for the next new typed task |
| `example_notice_dismissed_at` | timestamptz | no | set when the owner dismisses the example-data notice; null = not dismissed. Kept on the account so the dismissal follows the owner to every computer (§3 *The example notice*) |
| `created_at`, `updated_at` | timestamptz | yes | |

**Access rule (RLS):** SELECT and UPDATE are allowed for `authenticated` where `user_id = auth.uid()`. There are no INSERT or DELETE policies (the trigger inserts, and cascade deletes). The scheduler reads all rows with the service role.

### Table: projects
A project or client that tasks are filed under.
| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | **PK**, default `gen_random_uuid()` |
| `user_id` | uuid | yes | FK → `auth.users(id)` ON DELETE CASCADE; default `auth.uid()` |
| `name` | text | yes | CHECK `char_length(btrim(name)) BETWEEN 1 AND 60`; stored trimmed |
| `color` | text | yes | default `'azure'`; CHECK `color IN ('azure','violet','rose','coral','lime','teal','sand','slate')` |
| `archived_at` | timestamptz | no | null = active |
| `is_example` | boolean | yes | default `false`; true only for seeded example rows that are still examples |
| `claimed_from_example_at` | timestamptz | no | set when this seeded example became the owner's own: `is_example` switched to `false` because real work was logged under it (§3 *Example-data claims*). Never cleared |
| `created_at`, `updated_at` | timestamptz | yes | |

Unique index `projects_user_name_uq` on `(user_id, lower(name))`, covering archived projects too.

**Access rule (RLS):** SELECT, INSERT, UPDATE and DELETE are allowed for `authenticated` where `user_id = auth.uid()` (INSERT uses a `WITH CHECK` on the same condition). A project whose tasks have sessions cannot be deleted. The database enforces this through `tasks.project_id` ON DELETE CASCADE meeting `sessions.task_id` ON DELETE RESTRICT, and the API checks first and answers with "Archive it instead" (§6).

### Table: tasks
A saved, reusable task such as "Invoice prep". A task with no project falls under "No project".
| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | **PK**, default `gen_random_uuid()` |
| `user_id` | uuid | yes | FK → `auth.users(id)` ON DELETE CASCADE; default `auth.uid()` |
| `project_id` | uuid | no | FK → `projects(id)` ON DELETE CASCADE; null = "No project" |
| `name` | text | yes | CHECK `char_length(btrim(name)) BETWEEN 1 AND 80`; stored trimmed |
| `archived_at` | timestamptz | no | archived tasks are hidden from the task picker but stay in History and Reports |
| `last_used_at` | timestamptz | no | set to `now()` whenever a timer starts on this task; drives the "Recent" chips |
| `is_example` | boolean | yes | default `false`; true only for seeded example rows that are still examples |
| `claimed_from_example_at` | timestamptz | no | set when this seeded example became the owner's own (§3 *Example-data claims*). Never cleared |
| `created_at`, `updated_at` | timestamptz | yes | |

Unique index `tasks_user_project_name_uq` on `(user_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))`, so the same task name can exist under two projects but never twice under one. Index on `(user_id, last_used_at DESC NULLS LAST)`.

**Access rule (RLS):** all four operations are allowed for `authenticated` where `user_id = auth.uid()`. INSERT and UPDATE also require, in `WITH CHECK`, that `project_id` is null or belongs to the same user (`EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.user_id = auth.uid())`).

### Table: sessions
One continuous stretch of work on one task. A pause closes a session, and resuming opens a new one under the same task and the same run.
| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | **PK**, default `gen_random_uuid()` |
| `user_id` | uuid | yes | FK → `auth.users(id)` ON DELETE CASCADE; default `auth.uid()` |
| `task_id` | uuid | yes | FK → `tasks(id)` ON DELETE RESTRICT |
| `started_at` | timestamptz | yes | the database clock at start, or the owner's entered time |
| `ended_at` | timestamptz | no | **null = this session is running** |
| `duration_seconds` | integer | — | GENERATED ALWAYS AS (`CASE WHEN ended_at IS NULL THEN NULL ELSE floor(extract(epoch FROM ended_at - started_at))::int END`) STORED |
| `source` | text | yes | default `'timer'`; CHECK `source IN ('timer','manual')` (`manual` = added through "Add time") |
| `run_id` | uuid | no | the run this timer session belongs to. A run is one Start through the Stop, Discard or new Start that ends it. Every session of a run shares this value across pauses and resumes. Null for `manual` entries. Set to null when the owner moves the session to another task (trigger `fl_detach_moved_session`, below) |
| `end_reason` | text | no | CHECK `end_reason IN ('pause','stop','switch')`; null while running and for manual entries; records only how the session closed and is never rewritten afterwards |
| `edited_at` | timestamptz | no | set whenever the owner changes `started_at`, `ended_at` or `task_id` after creation; shows an "Edited" tag |
| `nudge_acknowledged_at` | timestamptz | no | set by "Keep going" on the nudge banner; suppresses further in-app nudges, the pop-up alerts and the email for this session |
| `is_example` | boolean | yes | default `false` |
| `created_at`, `updated_at` | timestamptz | yes | |

Constraints:
- `sessions_end_after_start` CHECK (`ended_at IS NULL OR ended_at > started_at`).
- `sessions_max_24h` CHECK (`ended_at IS NULL OR ended_at - started_at <= interval '24 hours'`).
- `sessions_one_running` UNIQUE INDEX on `(user_id) WHERE ended_at IS NULL`, so only one timer can ever run.
- `sessions_no_overlap` EXCLUDE USING gist (`user_id WITH =`, `tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') WITH &&`), so no two sessions overlap, including against a running one. Back-to-back sessions such as 10:00–11:00 and 11:00–12:00 are allowed because ranges are half-open.
- Indexes on:
  - `(user_id, started_at DESC)`;
  - `(user_id, duration_seconds DESC, id DESC)` for History's duration sort;
  - `(task_id)`;
  - `(run_id)`.

**Access rule (RLS):** SELECT, INSERT, UPDATE and DELETE are allowed for `authenticated` where `user_id = auth.uid()`. INSERT and UPDATE `WITH CHECK` also require that `task_id` belongs to the same user. The scheduler reads running sessions and writes nothing here, apart from reading `nudge_acknowledged_at`.

### Table: timer_state
The single source of truth for what the timer is doing right now. There is one row per account, created by `fl_handle_new_user`.
| Column | Type | Required | Notes |
|---|---|---|---|
| `user_id` | uuid | yes | **PK**; FK → `auth.users(id)` ON DELETE CASCADE |
| `status` | text | yes | default `'idle'`; CHECK `status IN ('idle','running','paused')` |
| `task_id` | uuid | no | FK → `tasks(id)` ON DELETE RESTRICT; the task on the clock (running or paused) |
| `session_id` | uuid | no | FK → `sessions(id)` ON DELETE RESTRICT; the open session (running only) |
| `run_id` | uuid | no | the current run (running or paused); every session the run logs carries the same value. Null when idle |
| `paused_at` | timestamptz | no | when the current pause began (paused only) |
| `stopped_at` | timestamptz | no | when the last Stop happened. Set by `fl_timer_stop` and cleared by every other timer action. It opens the 30-second Undo window (§6) |
| `updated_at` | timestamptz | yes | |

CHECK `timer_state_shape`:
- `status = 'idle' AND task_id IS NULL AND session_id IS NULL AND run_id IS NULL AND paused_at IS NULL`, or
- `status = 'running' AND task_id IS NOT NULL AND session_id IS NOT NULL AND run_id IS NOT NULL AND paused_at IS NULL AND stopped_at IS NULL`, or
- `status = 'paused' AND task_id IS NOT NULL AND session_id IS NULL AND run_id IS NOT NULL AND paused_at IS NOT NULL AND stopped_at IS NULL`.

**Access rule (RLS):** SELECT and UPDATE are allowed for `authenticated` where `user_id = auth.uid()`. There is no INSERT or DELETE policy. In practice it is written only by the `fl_timer_*` functions below, which run as the calling user (SECURITY INVOKER), so RLS still applies.

### Table: email_log
Every email Focus Log decides to send, or decides to skip, recorded *before* sending so nothing is ever sent twice.
| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | **PK**, default `gen_random_uuid()` |
| `user_id` | uuid | yes | FK → `auth.users(id)` ON DELETE CASCADE |
| `kind` | text | yes | CHECK `kind IN ('nudge','weekly_summary','test','password_link')` |
| `ref_key` | text | yes | idempotency key: `session:<session uuid>` for nudges, `week:<YYYY-MM-DD of that Monday>` for weekly summaries, `test:<ISO timestamp>`, `link:<ISO timestamp>` |
| `status` | text | yes | CHECK `status IN ('sending','sent','failed','skipped_empty','skipped_acknowledged')` |
| `to_email` | text | yes | |
| `subject` | text | yes | |
| `provider_message_id` | text | no | Postmark `MessageID` |
| `error` | text | no | short provider error code + message (max 300 chars); never the email body |
| `attempts` | integer | yes | default `0`; maximum 3 |
| `next_attempt_at` | timestamptz | no | when a `failed` row may be retried |
| `is_example` | boolean | yes | default `false`; true only for seeded example rows. Example rows are ignored by System status (last email, failed count, emails this month), by the monthly cap and by the once-only check |
| `created_at` | timestamptz | yes | |
| `sent_at` | timestamptz | no | |

Unique index `email_log_once_uq` on `(user_id, kind, ref_key) WHERE is_example = false`, so a seeded example row can never block a real email. Every insert that relies on it uses `ON CONFLICT (user_id, kind, ref_key) WHERE is_example = false DO NOTHING`.

**Access rule (RLS):** the owner can SELECT where `user_id = auth.uid()` (shown on Your data → Sent emails). There are no INSERT, UPDATE or DELETE policies for `authenticated`. Only the server, using the service-role key, writes this table, except for the owner's "Remove example data" and "Delete all tracked data" actions, which go through the server.

### Table: push_subscriptions
One row per browser the owner has allowed to show pop-up alerts.
- **Created** when the owner taps **Allow alerts** in that browser and grants permission.
- **Re-saved** on every signed-in visit from that browser.
- **Deleted** when the owner removes the browser in Settings, or when that browser's push service reports the subscription gone.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | **PK**, default `gen_random_uuid()` |
| `user_id` | uuid | yes | FK → `auth.users(id)` ON DELETE CASCADE; default `auth.uid()` |
| `endpoint` | text | yes | the push-service URL the browser issued; CHECK `endpoint LIKE 'https://%' AND char_length(endpoint) <= 2048` |
| `p256dh` | text | yes | the browser's public encryption key (base64url), from the subscription's `keys.p256dh` |
| `auth_secret` | text | yes | the browser's auth secret (base64url), from the subscription's `keys.auth` |
| `label` | text | yes | a friendly name built from the browser's user agent on save, e.g. `Chrome on Windows`, `Safari on iPhone`; CHECK `char_length(label) BETWEEN 1 AND 60` |
| `last_seen_at` | timestamptz | yes | default `now()`; refreshed each time this browser re-saves its subscription |
| `last_success_at` | timestamptz | no | when the push service last accepted an alert for this browser |
| `last_failure_at` | timestamptz | no | when an alert last failed for this browser |
| `last_error` | text | no | short push-service status + message (max 300 chars); never the alert's contents or keys |
| `nudge_session_id` | uuid | no | FK → `sessions(id)` ON DELETE SET NULL; the running session this browser was last alerted (or is being alerted) about |
| `nudge_status` | text | no | CHECK `nudge_status IN ('sending','sent','failed')`; the state of the alert for `nudge_session_id` |
| `nudge_attempts` | integer | yes | default `0`; at most 3 per session |
| `nudge_next_attempt_at` | timestamptz | no | when a `failed` alert may be retried |
| `created_at`, `updated_at` | timestamptz | yes | |

Unique index `push_subscriptions_endpoint_uq` on `(endpoint)`; index on `(user_id)`.

**Access rule (RLS):**
- **Owner:** SELECT, INSERT, UPDATE and DELETE are allowed for `authenticated` where `user_id = auth.uid()`. INSERT and UPDATE use a `WITH CHECK` on the same condition.
- **What the API returns:** it never sends `endpoint`, `p256dh` or `auth_secret` back to the browser. A browser identifies itself by sending its own endpoint, and the API answers with an `is_this_browser` flag (§7).
- **Scheduler:** using the service role, it reads every row, writes the `last_*` and `nudge_*` fields, and deletes a row when its push service answers 404 or 410.
- **Signing key:** the VAPID key pair that signs every alert is not stored in the database. It lives in environment variables (§10) and is never changed, because a new pair makes every row here stop working.

**No public access anywhere.** No table is readable or writable by a signed-out visitor, the `anon` role has no policies on any table, and there are no public or public-write tables.

### Database functions (the timer's core mechanism)
**How every timer function runs:**
- All of these are `LANGUAGE plpgsql SECURITY INVOKER`.
- Each runs in one transaction and begins with `SELECT … FROM timer_state WHERE user_id = auth.uid() FOR UPDATE`, so two clicks or two devices can't race.
- Each uses the database's `now()` as the clock and returns the same JSON "timer view" as `GET /api/timer` (§7). `fl_timer_view()` and `fl_timer_undo_stop()` are specified in §6.
- Errors are raised as `RAISE EXCEPTION '<CODE>' USING ERRCODE = 'P0001'`, and the API maps each code to user copy in §6.
- EXECUTE on every `fl_timer_*` function, including `fl_timer_view` and `fl_timer_undo_stop`, is revoked from `anon` and `PUBLIC` and granted to `authenticated` only.
- A timer session that would close shorter than 5 seconds is deleted instead of saved (the five-second rule, §6). Below, "close" always means "close, or delete under that rule", and `closed_session.dropped` says which.
- **Timer state first, then the delete.** `timer_state.session_id` references `sessions(id)` ON DELETE RESTRICT, so the database refuses to delete a session the timer still points at, and that refusal would roll back the whole action. So whenever a function deletes the open session (under the five-second rule, or in Discard), it first writes the new `timer_state`, which no longer points at that session, and only then deletes the session. This is the order `fl_timer_discard` uses. The link is never changed to ON DELETE SET NULL, because a running `timer_state` must always hold a `session_id` (`timer_state_shape`).

Each step list below states one transition from the §6 table.
- **`fl_timer_start(p_task_id uuid)`**
  1. Verify the task exists for `auth.uid()` (`FL_TASK_NOT_FOUND`) and is not archived (`FL_TASK_ARCHIVED`).
  2. *Running on the same task:* change nothing and return the view with `already_running: true`.
  3. *Paused on the same task* (`p_task_id = timer_state.task_id`): take the resume path, doing exactly what `fl_timer_resume` does. Insert a new session on this task with `started_at = now()` and `run_id = timer_state.run_id`, then set `running` with that `session_id` and `paused_at = null`. The run continues, so the clock carries on and `run.started_at` is unchanged. Continue at step 7, then return the view with `resumed: true` and no `closed_session`.
  4. *Running on another task:* if the open session has run more than 24 hours (`now() - started_at > interval '24 hours'`), raise `FL_STOP_TOO_LONG`. The owner must pick a stop time first (§6). Otherwise close the open session at `now()` with `end_reason = 'switch'`. A session that ran under 5 seconds is still closed here, so the new session can't overlap it, and it is deleted in step 6 once `timer_state` no longer points at it.
  5. *Paused on another task:* no session is open, so the paused run simply ends. Its logged sessions keep `end_reason = 'pause'` and are never relabelled.
  6. *Idle, paused on another task, or running after step 4:* start a new run.
     1. Let `v_run := gen_random_uuid()`. Insert a session (`task_id`, `started_at = now()`, `source = 'timer'`, `run_id = v_run`).
     2. Set `timer_state` to `running` with that `task_id`, `session_id` and `run_id = v_run`, with `paused_at` and `stopped_at` null.
     3. Only then, if step 4 closed a session that ran under 5 seconds, delete that session (`closed_session.dropped = true`).
  7. Set `tasks.last_used_at = now()` and `user_settings.last_project_id = tasks.project_id`.
  8. Return the view, plus `closed_session` (`{id, seconds, run_seconds, dropped, end_reason, from}`) when step 4 closed a session.
- **`fl_timer_pause()`**
  1. Requires `running` (`FL_NOT_RUNNING`). If the open session has run more than 24 hours, raise `FL_STOP_TOO_LONG`.
  2. Set `status = 'paused'`, `session_id = null` and `paused_at = now()`, keeping `task_id` and `run_id`.
  3. Then close the session at `now()` with `end_reason = 'pause'`. Under the five-second rule it is deleted instead, which works because step 2 has already moved `timer_state` off it.
  4. Return the view plus `closed_session`.
- **`fl_timer_resume()`**
  1. Requires `paused` (`FL_NOT_PAUSED`). If the paused task has since been archived, raise `FL_TASK_ARCHIVED`.
  2. Insert a new session on `timer_state.task_id` with `started_at = now()` and `run_id = timer_state.run_id`, so the run continues.
  3. Set `running` with that `session_id` and `paused_at = null`, update `last_used_at`, and return the view.
- **`fl_timer_stop(p_stop_at timestamptz DEFAULT NULL)`**
  - If `running`:
    1. Let `stop_at = coalesce(p_stop_at, now())`.
    2. Validate: `stop_at > now()` raises `FL_STOP_IN_FUTURE`; `stop_at <= started_at` raises `FL_STOP_BEFORE_START`; `stop_at - started_at > 24 hours` raises `FL_STOP_TOO_LONG`.
    3. Set `timer_state` to `idle` first (as described in the last bullet below).
    4. Then close the session at `stop_at` with `end_reason = 'stop'`. Under the five-second rule it is deleted instead, now that `timer_state` no longer points at it.
    5. `closed_session.from = 'running'`.
  - If `paused`:
    1. A non-null `p_stop_at` raises `FL_NOT_RUNNING`, because Stop at applies only while running.
    2. Otherwise no session is open and nothing in `sessions` is written.
    3. `closed_session` describes the run's latest surviving session (`end_reason 'pause'`, `from = 'paused'`). It is null when the run has no surviving session.
  - If `idle`: `FL_NOT_RUNNING`.
  - In every allowed case it sets `timer_state` to `idle` (`task_id`, `session_id`, `run_id` and `paused_at` null) with `stopped_at = now()`, and returns the view plus `closed_session`.
- **`fl_timer_discard()`**
  1. If `running`: set `timer_state` to `idle` first, then delete the open session.
  2. If `paused`: set `idle`.
  3. If `idle`: `FL_NOT_RUNNING`.
  - In both allowed cases `run_id` and `stopped_at` are cleared. The run's earlier closed sessions stay logged.
- **`fl_handle_new_user()`** is a `SECURITY DEFINER` trigger function declared with `SET search_path = public`, AFTER INSERT ON `auth.users`. Using schema-qualified names, it inserts that user's `public.user_settings` and `public.timer_state` (`idle`) rows.
- **`fl_detach_moved_session()`** is a BEFORE UPDATE trigger on `sessions`. When `NEW.task_id <> OLD.task_id`, it sets `NEW.run_id = null`, so time refiled under another task never counts toward the current run's clock.

**Example-data claims** (§6 *Example data*). These are SECURITY INVOKER trigger functions, so the owner's RLS applies. They run in the same transaction as the write that fires them.
- **`fl_claim_example_on_session`**: AFTER INSERT OR UPDATE OF `task_id` ON `sessions`, FOR EACH ROW WHEN (`NEW.is_example = false`).
  - If that session's task has `is_example = true`, the trigger sets the task's `is_example = false` and `claimed_from_example_at = now()`.
  - It does the same for the task's project when that project is still an example.
  - So the first real session logged on a sample task, whether by the timer or by Add time, makes the task and its project the owner's own in the same step.
- **`fl_claim_example_on_task`**: AFTER INSERT OR UPDATE OF `project_id` ON `tasks`, FOR EACH ROW WHEN (`NEW.is_example = false AND NEW.project_id IS NOT NULL`). It claims the project in the same way when it is still an example. This guarantees that removing example projects can never cascade into a task the owner created.

Overlap, the 24-hour limit and the single-running rule are therefore enforced by the database itself (constraints above), not only by the app. The API turns constraint violations into user copy: SQLSTATE `23P01` becomes the overlap message, and `23514` on `sessions_max_24h` becomes the 24-hour message (§6).

### Seed-data plan
**The owner's own account (real, permanent; never part of the example data).**
- **Creation:** the seed script calls `supabase.auth.admin.createUser({ email: 'jdavis@power-in-numbers.net', email_confirm: true })` with **no password**.
- **What the trigger creates:**
  - this user's `user_settings` row: `time_zone 'America/New_York'`, `time_zone_confirmed false`, nudge after 240 minutes, and all three email/alert toggles on;
  - this user's `timer_state` row: `idle`.
- **Role:** **Owner**, the only role.
- **First visit:** the owner clicks **"First time here? Set your password"** on the Sign in screen. Focus Log emails a one-time set-password link through Postmark, and the owner chooses their password.
- **No stored password:** no password is ever written into the seed, the repo or any config.
- **Idempotent:** the seed looks the user up by email and skips creation if the user exists.
- **Auth setting:** "Allow new users to sign up" is **off**.

**Example rows**
- **Who they belong to:** every example row has `is_example = true` and is attached to the owner's account.
- **How they're removed:** one click on Your data → **Remove example data**.
  - It deletes the rows that are still examples in the order sessions → tasks → projects → email_log.
  - It never touches the account, settings, timer state or allowed browsers.
  - It keeps any sample task or project that became the owner's because real time was logged under it (§6).
- **Naming:** sample project names start with `Sample: `, so they can't be mistaken for the owner's real businesses.
- **Times** are relative to the seed day in `America/New_York`.

The rows:
- **projects:** "Sample: Podcast Pilot" (`violet`), "Sample: Admin & Billing" (`azure`), "Sample: Acme Co" (`coral`), "Sample: Reading" (`lime`).
- **tasks:** "Episode outline" (Sample: Podcast Pilot), "Sponsor outreach emails" (Sample: Podcast Pilot), "Invoice prep" (Sample: Admin & Billing), "Website copy review" (Sample: Acme Co), "Read: The Effective Executive" (Sample: Reading).
- **sessions:**
  1. Episode outline, 3 days ago 9:00–10:30 AM (`timer`, `stop`, its own run).
  2. Invoice prep, 3 days ago 10:45–11:20 AM (`timer`, `pause`, run R).
  3. Invoice prep, 3 days ago 1:05–1:40 PM (`timer`, `stop`, the same run R), showing pause/resume as two sessions in one run.
  4. Sponsor outreach emails, 2 days ago 11:40 PM to yesterday 12:25 AM (`timer`, `stop`, its own run), a session that crosses midnight.
  5. Website copy review, yesterday 2:00–3:15 PM (`manual`, no run, `edited_at` set).
- **email_log:** three rows. Being examples, they are ignored by System status, the monthly cap and the once-only check, so the seeded "last week" summary never stops the real one.
  - a `test` email (`sent`, subject "Focus Log test email");
  - a `weekly_summary` for the Monday two weeks before the seed's current week (`skipped_empty`);
  - a `weekly_summary` for last week's Monday (`sent`, subject "Your week: 6h 40m across 3 projects").
- **user_settings and timer_state:** single-row-per-account tables. They hold exactly the owner's one row each (above) and get no example rows.
- **push_subscriptions:** no rows. A row exists only once a real browser allows alerts.

**The example notice.** While any `is_example` row exists, a dismissible notice appears at the top of Timer, Reports and History: "You're looking at example data so you can see how things work." with the button **Remove example data**.
- Dismissing it (the `X` button) sets `user_settings.example_notice_dismissed_at`. It then stays hidden on all three screens, on every computer the owner signs in on.
- The Example data card on Your data stays until the examples are removed.

## 4. Screens

Focus Log has seven screens. Two are for signed-out visitors (Sign in, Set password), and five are signed-in screens inside the app shell (Timer, Reports, History, Your data, Settings). **Your data** is the owner's data screen: the friendly in-app place to see and edit everything Focus Log stores. The Supabase dashboard is never the answer for the owner. Every value below sits on the §2 tokens, and components never use raw hex or px values.

**Shared formats (all screens and emails; locale en-US; the owner's time zone from `user_settings.time_zone`)**
- **Clock:** `H:MM:SS`. Hours are unpadded and unbounded (`0:04:09`, `27:04:10`).
- **Duration:** under 60 seconds shows `<1m`. Under 1 hour shows `Xm` (`42m`). From 1 hour it shows `Hh MMm` (`1h 05m`, `12h 30m`). Seconds are summed first, then floored to whole minutes. Zero shows `0m`.
- **Delta:** `+2h 10m` or `−1h 05m` (true minus sign U+2212). An equal total shows `No change`, and a previous total of zero shows `—`.
- **Time:** `9:02 AM`.
  - A range in the same meridiem: `9:00–10:12 AM`. A range across meridiems: `11:40 PM–12:25 AM`.
  - A running session: `9:02 AM–now`.
- **Date:** `Wed, Oct 8` in the current year and `Wed, Oct 8, 2025` otherwise.
  - Day headers: `Wednesday, October 8`, with `, 2025` added for other years. Today and yesterday read `Today · Wed, Oct 8` and `Yesterday · Tue, Oct 7`.
- **Week range:** `Oct 6 – 12, 2026`. Across months: `Sep 29 – Oct 5, 2026`. Across years: `Dec 29, 2025 – Jan 4, 2026`.
- **Month:** `October 2026`.
- **Share:** a whole percent (`34%`), with `<1%` for anything above 0 and under 1%.
- **Digits:** every number, time and duration uses tabular figures (`tnum`).
- **Date and time fields:** every date and time the owner enters (Stop at, Edit start time, Add time / Edit session, History's custom range) is read in the saved time zone (`user_settings.time_zone`), never the computer's. When the computer's zone differs from the saved one, a meta line under the fields reads `Times are in America/New_York.`

**Shared controls and their state matrix (every screen)**

| Control | Default | Hover | Focus-visible | Active / pressed | Disabled |
|---|---|---|---|---|---|
| Primary button (gold) | `--color-accent` bg, `--color-on-accent` text, 4px radius | `--color-accent-hover` | 2px `--color-accent` ring, 2px offset in `--color-bg-1` | `--color-accent-pressed` | opacity 0.4, `cursor:not-allowed`, `aria-disabled="true"`, click handler inert |
| Secondary button | `--color-surface-raised` bg, 1px `--color-border-strong`, `--color-text-primary` | bg `--color-surface-overlay` | same ring | bg `--color-surface` | same as primary |
| Ghost button | transparent, `--color-text-secondary` | bg `--color-surface-raised`, text primary | same ring | bg `--color-surface` | same |
| Danger button | `--color-danger` bg, white text | `--color-danger-hover` (`#B12D36`) | same ring | `#9E2830` | same |
| Icon-only button | 40×40 hit area, 16px Lucide icon in `--color-text-secondary`, tooltip required | bg `--color-surface-raised`, icon primary | same ring | bg `--color-surface` | same |
| Text input / select | 40px tall, `--color-surface-raised` bg, 1px `--color-border`, 4px radius | border `--color-border-strong` | same ring | n/a | opacity 0.5, not editable |
| Input with error | border `--color-danger-text`, plus a message under the field: 13px `--color-danger-text` with 14px `CircleAlert` icon, linked by `aria-describedby` | — | — | — | — |
| Switch / checkbox | off: `--color-border-strong` track; on: `--color-accent` track, `--color-on-accent` thumb | track lightens one step | same ring | — | opacity 0.4, inert |
| Segmented control | JetBrains Mono 12px uppercase; unselected text muted | text secondary | same ring | — | — |
| Segmented (selected) | `--color-accent-subtle` bg, 1px `--color-accent-subtle-border`, `--color-accent-text` | — | same ring | — | — |
| Table row / list row | `--color-surface` | `--color-surface-raised` (140ms) | ring inset 2px | — | — |

**Sizes and states shared by every control**
- **Sizes:** buttons are 40px tall by default and 44px on the Timer stage and in the mobile layout. Compact 32px buttons appear only inside tables, where they keep a 40px hit area through padding.
- **Async buttons:** a button whose action is in flight shows a 14px spinner in place of its icon, keeps its label, and is disabled until the response arrives.
- **Labels:** every input has a visible `<label>` (14px, `--color-text-secondary`, 8px above the field).
- **When validation runs:** on blur and on submit, never while typing. The first invalid field receives focus on submit.

**Shared overlays and keyboard behaviour**
- **Tooltips:** Radix Tooltip with a 400ms open delay, opened by hover and by keyboard focus. They have an `--color-surface-overlay` background, 1px border, 12px text, 4px radius and 8px padding, and fade in over 140ms. Every icon-only button and every truncated label has one, and a truncated label's tooltip shows the full text.
- **Menus (⋯):** each menu is triggered by a `MoreHorizontal` icon button whose tooltip is "More actions".
  - Menus are Radix DropdownMenu with 8px radius, the overlay shadow, 36px items, arrow-key navigation, Enter to select and Esc to close.
  - Destructive items use `--color-danger-text` with a `Trash2` icon and sit last, below a separator.
- **Dialogs:** Radix Dialog, max width 480px (560px for the session dialogs), 8px radius, `--color-surface-overlay` background, overlay shadow, and a backdrop of `rgba(7,8,13,0.72)`.
  - A Close icon button (`X`, tooltip "Close") sits in the top-right corner and is last in the tab order, so opening a dialog focuses its first field (or Cancel); a dialog with nothing to fill in focuses itself. A dialog opened from a ⋯ menu returns focus to that ⋯ button when it closes.
  - Text inside dialogs and the palette that would be muted elsewhere uses `--color-text-secondary` (the overlay surface is lighter than `--color-surface-raised`), and links inside running text are underlined.
  - Focus is trapped inside. Esc and Cancel close the dialog, and focus returns to the trigger.
  - The footer has buttons right-aligned, with Cancel (ghost) to the left of the confirm button.
- **Confirm dialogs for deletes:** the title names the thing being deleted, and the confirm button is a danger button whose label repeats the verb.
- **Toasts:** Sonner, styled to the tokens.
  - They sit in the bottom-right corner (bottom-centre below 768px) with 8px radius, an `--color-surface-overlay` background and the overlay shadow.
  - Each has an icon: `CircleCheck` in `--color-success`, `Info` in `--color-signal`, or `CircleAlert` in `--color-danger-text`.
  - They auto-dismiss after 5s (errors after 6s), and at most 3 are visible. Any **Undo** action uses `--color-accent-text`.
  - The toast region is `aria-live="polite"`, and errors are announced assertively.
- **Keyboard shortcuts:** these work anywhere signed in, but never while focus is in a text field.
  - `⌘K` / `Ctrl K` opens the command palette.
  - `N` focuses the task input, going to Timer first if needed.
  - `P` pauses or resumes. `S` stops (the toast offers Undo). `A` opens Add time.
  - `G` then `T` / `R` / `H` / `D` / `S` goes to Timer / Reports / History / Your data / Settings.
  - `?` opens the Keyboard shortcuts dialog, and `Esc` closes the topmost layer.

**App shell (all five signed-in screens)**
- **Ribbon band:** a 2px `--gradient-ribbon` band runs across the full viewport width at the very top of every signed-in screen (`position: fixed; top: 0; left: 0; right: 0`, z-index `--z-sidebar`, `aria-hidden`, `pointer-events: none`). The sidebar, rail, mobile top bar and content region all start 2px below it. Menus, popovers, the drawer, dialogs, the palette, toasts and tooltips sit above it.
- **Desktop sidebar (≥1024px):** a left sidebar 240px wide on `--color-bg-0`, with a 1px right border. It contains, top to bottom:
  1. **Header:** the mark (sparkle in a ring, §2) plus the wordmark "Focus Log" in the polished gold lettering (Archivo `wdth 125`, `wght 800`, 16px, `--gradient-gold` fill, §2).
  2. **Search or jump:** a secondary-style button reading "Search or jump…" with a `⌘K` kbd chip (`Ctrl K` on Windows/Linux). It opens the palette.
  3. **Navigation:** Timer (`Timer`), Reports (`ChartColumn`), History (`History`), Your data (`Database`) and Settings (`Settings`). Items are 40px tall with a 16px icon and a 14px label. The active item has a `--color-surface` background, primary text and a 2px gold indicator bar on its left edge.
  4. **Mini-timer** (shown only while running or paused): an 8px cyan dot (a hollow muted circle when paused), the task name truncated to 1 line, and `H:MM:SS` tabular. Clicking it goes to `/`.
  5. **Footer:** Help (`CircleHelp`) opens the "How Focus Log works" dialog. Below it are the owner's email (13px muted, truncated with tooltip) and a Sign out icon button (`LogOut`, tooltip "Sign out").
- **Icon rail (768–1023px):** the sidebar collapses to a 64px rail with icons only. Every icon has a tooltip, and the mini-timer shrinks to its dot plus `H:MM`.
- **Mobile bar (<768px):** a 56px top bar holds the mark, the gold "Focus Log" wordmark, the mini-timer pill (when active) and a `Menu` icon button (tooltip "Open menu"). The button opens a left drawer (280px, 260ms) containing the full sidebar.
- **Content region:** `--color-bg-1`, max content width 1120px, padding 32px (16px below 768px).
- **Page header:** the h1 title on the left (28px, in the gold polished lettering of §2), the page's primary action on the right, and a full-width 1px `--color-border` hairline 16px below.
- **Not found:** an unknown signed-in path shows, inside the shell, the empty-state mark, "This page doesn't exist.", "It may have moved, or the link was mistyped." and a **Go to Timer** button.
- **Crash fallback:** any screen that throws shows "Something went wrong on this screen." / "Your timer is safe — it runs on the server. Reload to try again." with a **Reload** button.
- **Signed-out mid-use:** if any API call answers 401, the app goes to `/sign-in?next=<path>&expired=1`.
- **Service worker and alert sign-up:** on every signed-in page load the shell registers `/sw.js` (scope `/`). When this browser has granted alerts and holds a push sign-up, the shell re-saves that sign-up (§5 F21). The service worker only shows pop-up alerts and opens Focus Log when one is clicked. It caches nothing and never serves pages (§8). The root layout links `/manifest.webmanifest`, sets `theme-color` `#07080D`, and links `/icons/icon-192.png` as the Apple touch icon.

**Command palette (`⌘K`)**
- **Appearance:** cmdk inside a dialog, 640px wide, 15vh from the top. It uses `--color-surface-overlay` at 88% opacity with a 16px backdrop blur, the only frosted surface in the app.
- **Input:** 48px tall, placeholder "Type a command or a task to start…". The active result shows a `⏎` gold-text kbd chip.
- **Groups** (at most 8 results each, filtered by fuzzy match):
  - **Timer:** Pause, Resume, Stop, Stop at…, Discard timer (each shown only when valid).
  - **Start a task:** saved active tasks, showing a project dot, the task name and the project name, ordered by last used. When the typed text exactly matches no task, the last item is `Start "<typed text>" as a new task`, filed under the default project.
  - **Go to:** Timer, Reports, History, Your data, Settings.
  - **Actions:** Add time, New project, New task, Export this week (CSV), Keyboard shortcuts, Sign out.
- **Behaviour:** arrow keys move, Enter runs the command and closes the palette, and Esc closes it. Starting a task from the palette follows the 24-hour rule for starting (Timer screen, below).
- **No match:** "Nothing matches "xyz"." / "Press Enter to start it as a new task."

### Screen: Sign in
**Purpose:** the owner signs in. Route `/sign-in`. A visitor who is already signed in is sent to `next` or `/`.
**Layout:**
- **Canvas and card:** a full-viewport `--color-bg-0` canvas with the fixed 14-sparkle field (§2, Signature moment 1). Centred on it is a 400px card (`--color-surface`, 1px border, 8px radius, 32px padding) with a 2px `--gradient-ribbon` top edge.
- **Card header:** the mark at 40px, "Focus Log" as h1 in the gold wordmark lettering (28px, `wdth 125`, `wght 800`, `--gradient-gold` fill, §2), and the subtitle "Sign in to your timer." (secondary text).
- **Expired-session notice:** when `?expired=1`, a muted info line with an `Info` icon above the form reads: "You were signed out. Sign in to pick up where you left off — your timer kept running."
**Components:**
- **Email field:** `type=email`, `autocomplete=username`, prefilled empty.
- **Password field:** `autocomplete=current-password`, with a show/hide icon button inside it (`Eye`/`EyeOff`, tooltip "Show password"/"Hide password").
- **Sign in button:** a full-width primary. While in flight it reads "Signing in…" with a spinner.
- **Links:** two text links in `--color-accent-text`: **"Forgot your password?"** and **"First time here? Set your password"**. Both reveal the same inline link form (the card cross-fades over 200ms), which also opens directly at `/sign-in?link=1`.
- **Link form:** the heading "Get a link to set your password", an Email field (prefilled from the sign-in field), the primary button **Send me a link**, and the ghost button **Back to sign in**.
- **Confirmation after sending:** a `MailCheck` icon, then "Check your inbox." / "If that address has a Focus Log account, a link to set your password is on its way. It works once, for 60 minutes." and the ghost button **Back to sign in**.
**Validation and errors:**
- Empty email: "Enter your email address."
- Malformed email: "That doesn't look like an email address."
- Empty password: "Enter your password."
- Wrong credentials: a banner above the button reading "That email and password don't match. Try again, or set a new password below."
- Rate limit (429): "Too many attempts. Wait 15 minutes and try again."
- Network failure: "Couldn't reach Focus Log. Check your connection and try again."
**Loading:** the card renders statically, so there is no skeleton. Only the button shows the in-flight state.
**Empty:** not applicable, because the screen is a form.

### Screen: Set password
**Purpose:** the owner chooses a password from an emailed one-time link. Route `/set-password?token_hash=…&type=recovery`.
**Layout:** the same canvas and card as Sign in, with the title "Set your password" as the card's h1 in the gold page-title lettering (§2). The page never consumes the token on load, so email link-scanners can't use it up. The token is verified only when the form is submitted.
**Components:**
- **Fields:** New password (`autocomplete=new-password`, with show/hide) and Confirm password.
- **Helper line under New password:** "At least 10 characters. A short phrase works well."
- **Set password button:** a full-width primary that reads "Setting password…" while in flight.
**Validation:**
- Under 10 characters: "Use at least 10 characters."
- Over 72 characters: "Use 72 characters or fewer."
- Same as the email address: "Pick something other than your email address."
- Confirm field doesn't match: "The two passwords don't match."
**States:**
- **Missing token in the URL:** the form is replaced by the `LinkOff`-style empty mark (Lucide `Link2Off`), "This link is incomplete." / "Open the link from your email again, or send yourself a new one." and the primary button **Send a new link** (goes to `/sign-in?link=1`).
- **Invalid or expired token on submit:** the form is replaced by "This link has expired or was already used." / "Links work once, for 60 minutes. Send yourself a new one." and **Send a new link**.
- **Success:** the owner is signed in, redirected to `/`, and sees the toast "Password set. You're signed in."
- **Network error:** "Couldn't reach Focus Log. Check your connection and try again." The form keeps its values.

### Screen: Timer
**Purpose:** the heart of the app. Start, pause, resume, switch and stop, and see today's sessions without leaving the screen. Route `/`.
**Page header:** the h1 "Timer" with the subtitle (13px, secondary) `Wednesday, October 8`, and on the right a secondary button **Add time** (`Plus` icon).

**Notices** (stacked above the stage, each 8px radius, `--color-surface`, 1px border, dismiss icon button `X` with tooltip "Dismiss"):
1. **Example data** (while any `is_example` row exists and `user_settings.example_notice_dismissed_at` is null): "You're looking at example data so you can see how things work." The button **Remove example data** opens the confirm dialog described on Your data.
   - Dismissing it hides it at once and sends `PATCH /api/settings { example_notice_dismissed: true }`, so it stays hidden on Timer, Reports and History on every computer.
   - If that save fails, the notice comes back and an error toast reads "Couldn't save that change. Try again."
   - The Example data card on Your data stays until the examples are removed.
2. **Welcome** (until the first non-example session exists, or until dismissed; stored in `localStorage` key `fl-welcome-dismissed`):
   - Title: "Welcome to Focus Log."
   - Three numbered lines:
     1. "Type what you're working on and press Start."
     2. "Pause when you step away. Resume picks up where you left off."
     3. "Press ⌘K any time to jump around or start a task."
   - Button **Got it**.
3. **Time zone mismatch** (when the browser's zone differs from the saved one and this pair hasn't been dismissed; stored as `fl-tz-dismissed-<browserZone>`):
   - Text: "This computer is set to America/Los_Angeles, but Focus Log is using America/New_York."
   - Buttons **Switch to America/Los_Angeles** (secondary) and **Keep America/New_York** (ghost).
4. **Pop-up alert prompt** (shown once, after the first timer start, if `Notification.permission === 'default'`, `nudge_browser_enabled` is on, and this browser can take push alerts, meaning `serviceWorker`, `PushManager` and `Notification` are all present; iPhone and iPad Safari offer these only from the Home Screen, so the prompt never shows there in a normal tab; stored as `fl-notify-prompt-dismissed`):
   - Text: "Want a pop-up on this computer if a timer runs too long?" / "It appears even with Focus Log closed, as long as your browser is open. The reminder email arrives either way."
   - Buttons **Allow alerts** (secondary; runs the Allow alerts steps in §5 F21, and permission is only ever asked from this tap) and **Not now** (ghost).
5. **System status problem** (shown whenever `GET /api/status` returns a non-empty `problems` list; it sits at the top of the stack, above the other notices):
   - Style: the shared notice, with a 3px left edge and a `TriangleAlert` icon in `--color-danger-text` when any problem is red, otherwise in `--color-warning`.
   - Title: the first problem's message from §6, e.g. "Reminder emails aren't going out — Postmark rejected the key."
   - Body: "See Settings → System status for what to do." When there is more than one problem: "And 1 more issue. See Settings → System status for what to do."
   - Button **Open System status** (secondary), which goes to `/settings#status`.
   - **Dismissing it** stores the current problem keys, the time and the failed-email count (`email.failed_7d`) in `localStorage` key `fl-status-dismissed`. The notice then comes back when any of these happens:
     - the problems other than `emails_failed` change (one appears or clears) and at least one of them remains;
     - any problem other than `emails_failed` is still present 24 hours after dismissal (real outages such as `email_not_configured`, `email_key_rejected`, `scheduler_stopped` and the `push_*` keys therefore keep coming back every 24 hours until they're fixed);
     - `emails_failed` is present and either wasn't present at dismissal, or the failed count has risen above the stored count.
   - **A dismissed `emails_failed` warning on its own** never comes back with time, only when another email fails. When the failed count drops (failures older than 7 days age out), the stored count is lowered to match, so the next new failure still brings the notice back. The count always stays visible on Settings → System status.
   - The Timer screen fetches `GET /api/status` on load, when the window gains focus, and every 5 minutes.

**Nudge banner** (above the stage, `role="alert"` when it first appears):
- **When it shows:** the timer is running, the current session's elapsed time is at least `nudge_after_minutes`, and the session isn't acknowledged.
- **Style:** `--color-surface-raised` background, a 3px `--color-warning` left edge, and an `AlarmClock` icon in `--color-warning`.
- **Text:** the title "Your timer has been running for 4h 03m." (refreshed every minute) and the body "Still on Invoice prep? It's been running since 9:02 AM without a pause."
- **Buttons:** **Keep going** (secondary; acknowledges, so the banner hides and no reminder email or further pop-up goes out for this session if it hasn't already, and an open pop-up for it in this browser is closed), **Stop now** (primary) and **Stop at…** (ghost; opens the Stop at dialog).

**The Stage** (Signature moment 1; a void on `--color-bg-1` framed by the 1px `--color-rim` badge rim with an 8px radius, inner padding 32px (16px below 768px), min-height 320px at ≥1024px and 240px below, with the fixed 10-sparkle starfield inside the rim, §2):
- **Task bar (top row)** is a combobox, a project picker and the Start button.
  - **Task combobox:**
    - Its visually hidden label is "What are you working on?". The placeholder reads "What are you working on?" when idle or paused and "Switch to another task…" while running.
    - It holds up to 80 characters. A counter `72/80` appears from 70 characters on.
    - The dropdown has three sections:
      - **Recent** (up to 6 active tasks by `last_used_at`, shown when the input is empty).
      - **Matching tasks** (up to 8 active tasks whose name or project name contains the text, case-insensitive, ordered by `last_used_at` desc).
      - A last option, `Start "<text>" as a new task` (`Plus` icon), shown when no active task under the selected project has exactly that name.
    - Each option shows a project dot, the task name with the matched text in weight 600, and the project name in muted text.
    - Arrow keys move through options. Enter starts the highlighted option, or the typed text if nothing is highlighted. Esc closes the list first and clears the text on a second press.
  - **Project picker** (secondary button showing a dot and project name, or a `Folder` icon and "No project"):
    - It opens a popover listing "No project" first, then active projects A–Z, with a search field once there are more than 8 projects. The footer item **New project…** opens the New project dialog. When the dialog creates a project, that project is selected.
    - It defaults to `user_settings.last_project_id`.
    - When a saved task is highlighted or selected, the picker shows that task's project and is disabled, with the tooltip "This task belongs to Show It Off. Change it in Your data."
  - **Start button** (primary, 44px):
    - The label reads **Switch** while running and **Start** when idle.
    - While paused it reads **Resume** when the task it would start is the paused task: either the highlighted or selected option is that task, or the typed text matches its name (trimmed, case-insensitive) with the project picker showing its project. Pressing it then resumes the run (§6). Otherwise it reads **Start**.
    - It carries an attached 44×44 square `⏎` chip (`--color-surface-raised`, 1px border, 4px radius, `aria-hidden`), separated by 4px.
    - It is disabled when the input is empty and nothing is selected, with the tooltip "Type a task or pick one below".
- **Task line:**
  - The h2 shows the task name, truncated to 1 line with a tooltip.
  - Running: the 8px cyan on-air dot sits to its left.
  - Paused: a hollow muted circle replaces the dot.
  - Idle: the task line reads "Ready when you are." in muted text.
- **Clock** (the §2 type role):
  - It shows run time: the closed sessions of this run plus the current session's elapsed time (§6).
  - Running: gold gradient and light pool. Paused: flat secondary text. Idle: `0:00:00` in `--color-text-disabled`.
  - The clock element is `aria-hidden`. A visually hidden `role="timer"` sibling is updated once a minute with the time in words, e.g. "1 hour 2 minutes".
- **Flank micro-labels:**
  - **Left:** `PROJECT` over the project name, or `NO PROJECT`.
  - **Right:** `STARTED` over the run's start time (`9:02 AM`, or `Yesterday 11:40 PM` / `Tue, Oct 7 11:40 PM` if it started on an earlier day). While paused, it reads `PAUSED` over the pause time.
  - Below 768px both flanks stack under the clock, left-aligned.
  - Hidden when idle.
- **Gold hairline:** 16px under the clock (§2).
- **Controls row** (24px below the hairline; hidden when idle):
  - **Running:** **Pause** (secondary, `Pause` icon, kbd hint `P`) and **Stop** (primary, `Square` icon, kbd hint `S`).
  - **Paused:** **Resume** (primary, `Play` icon, `P`) and **Stop** (secondary, `Square`, `S`).
  - **⋯ menu** (tooltip "More timer options"):
    - Running: **Edit start time…**, **Stop at…**, separator, **Discard timer** (danger).
    - Paused: **Discard timer** only.
  - When the current session's elapsed time is 24 hours or more, Pause and Stop both open the Stop at dialog instead, and the row shows the meta line "This timer has run for over 24 hours. Pick when you actually stopped."
- **The 24-hour rule for starting:** while the current session has run 24 hours or more, every way of starting or switching a task opens the Stop at dialog first, in its pending-start form (Timer dialogs, below). That covers the Start/Switch button, Enter in the task combobox, the Recent chips, the palette's Start a task items, **Start this task again** in Today and History, and **Start timer** on Your data → Tasks. The dialog opens on whichever screen the start came from. If the server answers `FL_STOP_TOO_LONG` to a start anyway (for example from a stale screen), the same dialog opens.
- **Live announcements** (`aria-live="polite"`): "Timer started: Invoice prep", "Paused at 1:02:09", "Resumed Invoice prep", "Switched to Episode outline", "Stopped. Logged 1h 12m."

**Recent row** (under the stage; hidden when there are no active tasks):
- **Contents:** the micro-label `RECENT`, then up to 6 chips for the most recently used active tasks, excluding the one on the clock.
- **Chip:** 32px tall with a 40px hit area, 4px radius, `--color-surface` background and a 1px border. It shows a project dot and the task name truncated at 24 characters, with the tooltip "Invoice prep · Power in Numbers — Admin". A `Play` icon appears on hover and focus.
- **Click:** starts the task when idle or paused, or switches to it while running.

**Today panel** (below; `--color-surface`, 1px border, 8px radius):
- **Header row:** the micro-label `TODAY`, the date `Wed, Oct 8` in secondary text, and on the right the day total (`3h 47m`, 20px Archivo `wght 600` tabular). The total counts up on change (Signature moment 2) and ticks every minute while running.
- **Rows:** 40px each, newest `started_at` first, covering every session that overlaps today in the owner's time zone. Each row has:
  - A 3px left edge in the project colour.
  - The time range, tabular.
  - The task name (primary) and project name (muted).
  - Tags (11px JetBrains Mono uppercase pill, `--color-surface-raised`, muted): `MANUAL`, `EDITED`, `FROM YESTERDAY` (started before today), and `RUNNING` with the cyan dot.
  - The right-aligned duration. A row that started yesterday shows today's portion, with the tooltip "1h 20m in total — 25m of it today".
  - A ⋯ menu:
    - Closed sessions: **Edit…**, **Start this task again**, separator, **Delete…**.
    - The running session: **Edit start time…** and **Stop at…**.
  - Inserted rows animate as in Signature moment 2, and deleted rows collapse in 200ms.
- **Footer:** the ghost button **Add time**, which opens the Add time dialog on today.
- **Loading:** a skeleton of the header bar and three 40px row placeholders that match the column widths, pulsing opacity 0.5↔0.8 over 1.2s (static under reduced motion).
- **Empty:** the 40px stroke sparkle mark, **"Nothing on the clock yet today."** / "Type what you're working on and press Start, or pick a saved task." and the primary button **Start a timer**, which focuses the task combobox.
- **Error:** an `CircleAlert` icon, "Couldn't load today's sessions." / "Check your connection, then try again." and the secondary button **Try again**.

**Stage loading and error**
- **Loading:** the task-line skeleton (240×20px), a clock skeleton (360px by the clock's line height, 8px radius) and two 44px button skeletons. It never shows `0:00:00` before the real state is known.
- **Error:** "Couldn't reach your timer." / "Your time is safe on the server — this is just a connection problem." with the secondary button **Try again**. The controls are hidden until the timer view loads.

**Timer dialogs**
- **Stop at…:**
  - Title "When did you stop?", with a Date field and a Time field (`type=date`, `type=time` in 1-minute steps).
  - The default is the session start plus the nudge threshold when elapsed exceeds it, otherwise now rounded down to the minute.
  - A live line reads "Logs 4h 00m to Invoice prep (5h 10m on this timer since 9:02 AM)."
    - The first figure is this session, from its start to the chosen time.
    - The bracketed figure is the whole run up to the chosen time (`run.closed_seconds` + chosen time − session start). It is the same figure the "Logged …" toast reports after the stop.
    - The bracket's start time is the run's start, in the STARTED flank format (`9:02 AM`, `Yesterday 11:40 PM`, `Tue, Oct 7 11:40 PM`).
    - When the run has no earlier sessions (`run.closed_seconds` is 0), the bracket is left out: "Logs 4h 00m to Invoice prep."
  - Buttons **Cancel** and **Stop at 1:02 PM** (the label follows the chosen time).
  - Errors come from §6: "The stop time can't be later than now.", "The stop time has to be after the start time (9:02 AM).", "A single session can be at most 24 hours. Pick an earlier stop time."
  - **Pending-start form** (opened by the 24-hour rule for starting): the meta line reads "This timer has run for over 24 hours. Pick when you actually stopped, then Episode outline starts." and the confirm button reads **Stop and start Episode outline**. Confirming sends `POST /api/timer/stop { stop_at }` and then `POST /api/timer/start` for the chosen task. If the start fails after the stop succeeded, the stop stays and the start's error appears as a toast. **Cancel** changes nothing.
- **Edit start time…:**
  - Title "When did you start?", with Date and Time fields defaulting to the current start.
  - A live line reads "The clock will show 1h 14m."
  - Buttons **Cancel** and **Save start time**.
  - Errors: "The start time can't be in the future." and the overlap message from §6.
- **Discard timer:**
  - Title "Discard this timer?", body "The current Invoice prep timer (started 9:02 AM, 1h 02m so far) will be thrown away and nothing will be logged for it. Earlier sessions stay."
  - Buttons **Cancel** and **Discard timer** (danger).
- **New project:** shared with Your data.

### Screen: Reports
**Purpose:** totals by project for any week (Monday–Sunday) or calendar month. Route `/reports?period=week|month&start=YYYY-MM-DD`. The default is the current week, and an invalid `start` falls back to the current period. The page replaces an invalid, future, or non-Monday (week) / non-1st (month) `start` in the URL with the current period (`history.replaceState`) before it calls `GET /api/reports`, so the API's 400 never reaches the screen.
**Page header:** the h1 "Reports" and the secondary button **Export CSV** (`Download` icon), which downloads this range.
**Controls row:**
- A segmented control `WEEK │ MONTH`.
- Icon buttons `ChevronLeft` and `ChevronRight`, with tooltips "Previous week"/"Next week" (or "Previous month"/"Next month"). Next is disabled on the current period, with the tooltip "You're on the current week".
- The ghost button **This week** / **This month**, disabled when already on the current period.
- Changing any control updates the URL, so Back and Forward work.

**Total card** (`--color-surface`, 8px radius, 32px padding):
- **Eyebrow:** the range in `--color-accent-text` JetBrains Mono 12px uppercase, e.g. `OCT 6 – 12, 2026`.
- **Number:** the display figure, e.g. `23h 15m`, 48px tabular, in the gold polished lettering (Archivo `wdth 125`, `wght 800`, `--gradient-gold` fill, §2).
- **Left flank:** `WEEK OF` over `Mon, Oct 6`, or `MONTH OF` over `October 2026`.
- **Right flank:** `VS LAST WEEK` (or `VS LAST MONTH`) over the delta, with an `ArrowUp` or `ArrowDown` icon in secondary text. Up is never coloured as "good".
- **Running note:** when the range includes a running timer, a meta line reads "Includes your running timer up to now." and the figures refresh every 60 seconds.

**Daily chart** (Recharts stacked `BarChart`, 220px tall):
- One bar per day: 7 for a week, 28–31 for a month.
- Each bar is stacked by project in the project colours, with "No project" in `--color-border-strong` and a 2px top radius.
- **X axis:** `Mon 6` … `Sun 12` for a week, or day numbers for a month. Below 768px only every 5th month label is shown.
- **Y axis:** whole-hour ticks (`0h`, `2h`, `4h`; the step is 1, 2 or 4 hours, chosen so there are at most 5 ticks), 12px muted tabular. Grid lines are `--color-border` horizontal only.
- **Tooltip:** a token-styled card (overlay surface, 8px radius) showing `Wed, Oct 8`, the day total, and one row per project with its dot and duration.
- **Animation:** bars grow from 0 over 400ms with `--ease-out` and a 20ms stagger, on the first render after page load only. Changing the period cross-fades the chart over 200ms, and reduced motion skips the grow.
- **Accessibility:** the chart has `role="img"` with an `aria-label` summary ("Daily totals: Monday 3h 10m, Tuesday …"), and a visually hidden table carries the same data.

**By project list:**
- **Columns:** Project | Time | Share.
- **Rows:** 44px each, sorted by time descending, with "No project" always last.
  - Each row shows a project dot, the name, an `ARCHIVED` tag if archived, and a 4px-tall share bar under the name in the project colour, at a width equal to the share.
  - Time and share are right-aligned and tabular.
- **Disclosure:** each row is a disclosure button (`ChevronRight`, rotating 90° in 140ms). Click or Enter reveals that project's tasks (name and time, sorted descending) indented by 24px.

**States:**
- **Loading:** skeletons of the total card, 7 grey bars of varying heights, and 4 list rows.
- **Empty** (range total is 0): the stroke sparkle mark, **"No time logged this week."** (or "…this month.") / "Start a timer and it'll show up here, or add time you forgot to track." and buttons **Go to Timer** (primary) and **Add time** (secondary, opens Add time on the range's first day).
- **Error:** "Couldn't load this report." / "Check your connection, then try again." with **Try again**.

### Screen: History
**Purpose:** search every past session, fix mistakes, add forgotten time, and export. Route `/history`. Query params: `q`, `range=7d|30d|90d|all|custom`, `from`, `to`, `projects=<id,id>`, `sort=date|duration`, `add=1&date=YYYY-MM-DD` (opens Add time), `session=<id>` (opens Edit).
**Page header:** the h1 "History", the primary button **Add time** (`Plus`), and the secondary button **Export CSV** (`Download`), which exports the current filters.

**Filter bar:**
- **Search:** a 320px input with a `Search` icon and the placeholder "Search tasks and projects". It is debounced by 250ms and matches task and project names, case-insensitive substring. A clear `X` icon button (tooltip "Clear search") appears once there is text.
- **Date range:** a segmented control `7D │ 30D │ 90D │ ALL │ CUSTOM`, default `30D`. `CUSTOM` opens a popover with From and To date fields and **Apply**; "To" before "From" shows "The end date has to be on or after the start date."
- **Project filter:** a multi-select popover button reading "All projects" or "2 projects", with checkboxes and an option to include archived projects.
- **Clear filters:** a ghost button shown only when any filter differs from the default.
- **Summary line** under the bar: `312 sessions · 182h 40m` (meta, tabular).

**Table** (≥768px):
- **Header:** sticky, `--color-bg-1`, micro-label column titles.
- **Columns:**
  - **Date:** sortable; the default sort is newest first.
  - **Time:** the range.
  - **Task**
  - **Project:** with its dot.
  - **Duration:** right-aligned and sortable (longest first).
  - **Actions:** the ⋯ menu.
- **Day grouping:** when sorted by date, rows are grouped under day header rows (36px, `--color-bg-1`) showing `Wednesday, October 8` on the left and that day's total on the right. Sessions are listed under the day they started, and the meta line under the filter bar reads "Sessions are listed under the day they started." Sorting by duration removes the grouping.
  - The day total is the full length of every session in the current filters that started that day, matching the rows listed under it (not clipped at midnight the way Today and Reports are).
  - The server computes it per day over the whole filtered set (`day_totals`, §7), so it is complete even when only part of that day's rows has loaded.
- **Rows:**
  - Each row is 40px with a 3px project-colour left edge and the tags `MANUAL`, `EDITED`, `OVERNIGHT` (crosses midnight) and `RUNNING`.
  - Clicking a closed row (or pressing Enter on it) opens Edit.
  - **⋯ menu, closed session:** **Edit…**, **Start this task again**, separator, **Delete…**.
  - **⋯ menu, running session:** **Edit start time…** only. Delete is disabled, with the tooltip "Stop or discard the timer first".
- **Paging:** 50 rows per page. The footer reads `Showing 50 of 312` with the secondary button **Show 50 more**, and new rows fade in over 200ms. When sorted by duration, the running session (if it matches the filters) is pinned at the top of the first page (§6).
- **Mobile (<768px):** each row becomes a card (`--color-surface`, 8px radius, 12px padding). Line 1 is the task name and duration, line 2 is the project dot and name · range · date, and the ⋯ button sits top-right. Nothing scrolls horizontally.

**States:**
- **Loading:** sticky header plus 8 skeleton rows matching the column widths.
- **Empty, no sessions ever:** the stroke sparkle mark, **"Your history starts with your first timer."** / "Every session you log will be listed here, newest first." and **Go to Timer** (primary).
- **Empty, no matches:** a `SearchX` icon, **"No sessions match "acme"."** (or "No sessions in this date range." when there is no query) / "Try a different word, or widen the date range." and **Clear filters** (secondary).
- **Error:** "Couldn't load your history." / "Check your connection, then try again." with **Try again**.

**Session dialog (Add time / Edit session)**, 560px:
- **Fields:**
  - **Task:** the same combobox as the stage, including `Create "<text>"`, plus a project picker for new tasks.
  - **Date:** the start date.
  - **Start time** and **End time:** time inputs in 1-minute steps.
  - **Ends on a different day:** a checkbox that reveals an End date field. It is checked automatically, with the End date set to the next day, when the end time is earlier than the start time.
- **Live readout:** "Duration: 1h 15m".
- **Add time defaults:** the date is today, or the `date` param, or the day clicked. The start is the end of the latest session on that date, or 9:00 AM if there is none. The end is start + 30 minutes, capped at now.
- **Buttons:** **Cancel**, then **Add time** or **Save changes**.
- **Running session (Edit):** the end fields are hidden, the task field is disabled with the note "This timer is still running. Switch tasks from the Timer.", and the dialog becomes Edit start time.
- **Errors:** inline at the field per §6. An overlap error appears in a banner above the footer naming the conflicting session.
- **Delete confirm:** **"Delete this session?"** / "Invoice prep, Wed, Oct 8, 9:00–10:12 AM (1h 12m) will be removed from your totals. This can't be undone." with **Cancel** and **Delete session** (danger). On success the toast reads "Session deleted."

### Screen: Your data
**Purpose:** the owner's data screen, a friendly place to see and edit everything Focus Log keeps (sessions themselves live in History). Route `/data?tab=projects|tasks|emails`.
**Page header:**
- The h1 "Your data", with the subtitle "Everything Focus Log keeps for you. Sessions live in History."
- The primary action depends on the tab: **New project** on Projects, **New task** on Tasks, none on Sent emails.
- The secondary button **Export everything** (`Download`) downloads all sessions as CSV.
**Example data card** (top, shown while examples exist):
- **Text:** "Example data is loaded." / "4 projects, 5 tasks, 5 sessions and 3 email records are marked as examples. Removing them leaves your own data untouched." The counts are live and count only rows that are still examples.
  - When sample items have become the owner's (§6), a second line reads "Sample: Admin & Billing and Invoice prep have your own time logged, so they'll be kept."
- **Button:** **Remove example data** (danger).
- **Confirm:** **"Remove example data?"** / "This deletes the 4 example projects, 5 tasks, 5 sessions and 3 email records. Anything you created yourself stays." with **Cancel** and **Remove example data**. When items will be kept, the body adds "Sample: Admin & Billing and Invoice prep stay, because you've logged time on them."
- **Success toast:** "Example data removed." When items were kept: "Example data removed. Kept 1 project and 1 task you've logged time on: Sample: Admin & Billing, Invoice prep."
- **Couldn't remove** (409 `EXAMPLES_IN_USE`): "Some example items are still in use, so nothing was removed. Stop the timer, then try again."
**Tabs:** Radix Tabs: `Projects │ Tasks │ Sent emails`. Arrow keys move between tabs, and the selected tab has a 2px gold underline.

**Projects tab:**
- **Toolbar:** a "Show archived" switch (off by default).
- **Table columns:** Project (dot + name + `ARCHIVED` tag) | Tasks | Total time | Last used | ⋯.
  - Default sort is name A–Z; Total time and Last used are also sortable.
  - "Last used" shows `Today`, `Yesterday` or a date, and `—` if never used.
- **⋯ menu:** **Edit…**, **Archive** or **Unarchive**, separator, **Delete…**.
  - Delete is disabled when the project has logged time, with the tooltip "Has logged time — archive it instead".
- **Archive:** archiving shows the toast "Archived Show It Off." with **Undo**.
  - Blocked (409): "Stop the timer first — Invoice prep in this project is on the clock."
- **Project dialog** (New project / Edit project):
  - **Name:** maximum 60 characters.
  - **Colour:** an 8-swatch radio group. Each swatch is a 28px circle with a 40px hit area and an accessible name ("Azure", "Violet", "Rose", "Coral", "Lime", "Teal", "Sand", "Slate"). The selected swatch has a 2px `--color-text-primary` ring at 2px offset. Arrow keys move the selection.
  - **Buttons:** **Cancel**, then **Create project** or **Save changes**.
- **Delete confirm:** **"Delete Show It Off?"** / "Its 2 saved tasks will be deleted too. It has no logged time." (with no saved tasks: "It has no logged time, so nothing else changes.") with **Cancel** and **Delete project**. Success toast: "Deleted Show It Off."
- **Edit saved:** toast "Project updated."
  - Blocked (409 `ON_CLOCK`, a task of this project is running or paused): the dialog closes and an error toast reads "Stop the timer first — Invoice prep in this project is on the clock." Nothing is deleted.
- **Empty:** the stroke sparkle mark, **"No projects yet."** / "Projects and clients keep your hours sorted. Add your first one." and **New project**.

**Tasks tab:**
- **Toolbar:** a search field ("Search tasks"), a project filter select ("All projects", "No project", then each project) and a "Show archived" switch.
- **Table columns:** Task | Project | Sessions | Total time | Last used | ⋯.
- **⋯ menu:** **Edit…**, **Start timer**, **Archive** or **Unarchive**, separator, **Delete…**.
  - Delete is disabled when the task has sessions, with the tooltip "Has logged time — archive it instead".
- **Task dialog:**
  - **Fields:** Name (maximum 80 characters) and Project (select, including "No project" and **New project…**).
  - **Moving a task with sessions:** when the project changes on a task that has sessions, an inline warning appears: "Moving this task also moves its 14 sessions (12h 30m) to Client: Acme Co. Past reports will change to match."
- **Delete confirm:** **"Delete Invoice prep?"** / "It has no logged time, so nothing else changes." with **Delete task**. Success toast: "Deleted Invoice prep."
- **Create / edit saved:** toasts "Created Invoice prep." and "Task updated."
- **Duplicate name:** "You already have a task called "Invoice prep" in Sample: Admin & Billing." (with no project: "You already have a task called "Invoice prep" with no project.")
- **Empty:** **"No saved tasks yet."** / "Tasks are saved the first time you start a timer on them." and **Go to Timer**.
- **No matches** (search or project filter finds nothing): **"No tasks match."** / "Try a different word or project."

**Sent emails tab:**
- **Table columns:** Date (`Mon, Oct 6, 8:00 AM`) | Type (`Reminder`, `Weekly summary`, `Test`, `Password link`) | Subject | Status | Detail. Newest first, 50 per page with **Show 50 more**.
- **Status pills** (999px radius, 12px):
  - `Sent`: `--color-success` text on `--color-surface-raised`.
  - `Sending`: `--color-info`.
  - `Failed`: `--color-danger-text`.
  - `Skipped — nothing logged` and `Skipped — you pressed Keep going`: muted.
- **Detail column:** shows the human error from §8 when a send failed, otherwise `—`.
- **Empty:** a `Mail` icon, **"No emails yet."** / "Reminders and Monday summaries will be listed here once they're sent." and the secondary button **Send a test email**.

**Each tab's loading and error states:**
- **Loading:** a 6-row table skeleton.
- **Error:** "Couldn't load your data." / "Check your connection, then try again." with **Try again**.

### Screen: Settings
**Purpose:** time zone, reminders, the weekly email, the account, system status and the danger zone. Route `/settings`. Each section is a card (`--color-surface`, 8px radius, 24px padding) with an h2.
**Saving:** settings save on change. A small `Check` and "Saved" (13px muted) appear next to the control for 2 seconds, fading over 140ms. On a failed save the control reverts and an error toast reads "Couldn't save that change. Try again."
**Sections:**
1. **Time zone**
   - A searchable combobox of every IANA zone, labelled like `America/New_York — UTC−04:00`.
   - Under it, the ghost button **Use this computer's time zone (America/Chicago)**, shown only when that differs.
   - Helper text: "Used for Today, weekly and monthly totals, and when the Monday email arrives."
2. **Reminders**
   - **"Remind me when a timer runs longer than"**: a select with every 30-minute step from `30 minutes` to `12 hours` (labels like `1 hour 30 minutes`), default `4 hours`.
   - **"Email me a reminder"**: a switch (`nudge_email_enabled`).
   - **"Show a browser alert"**: a switch (`nudge_browser_enabled`). Helper text: "A pop-up on every browser you allow below, even with Focus Log closed, as long as the browser is open."
   - **This browser** (a readout under the switch, one of):
     - Allowed and signed up: "This browser shows pop-up alerts, even with Focus Log closed." with the secondary button **Send a test alert**.
     - Not asked yet: "Pop-ups aren't on for this browser yet." with the secondary button **Allow alerts**.
     - Allowed but not signed up (the sign-up was lost or failed): "This browser stopped receiving alerts." with the secondary button **Turn alerts back on**, which runs the same steps as Allow alerts.
     - Blocked: "Alerts are blocked in this browser. Allow them in your browser's site settings, then reload."
     - iPhone or iPad Safari outside the Home Screen: "On iPhone and iPad, pop-ups only work from the Home Screen. Tap Share, then Add to Home Screen, open Focus Log from that icon, and allow alerts here."
     - Push not supported: "This browser can't show pop-up alerts. The reminder email still arrives."
     - When the server has no alert keys, the readout adds "Pop-up alerts aren't set up yet.", and Allow alerts, Turn alerts back on and Send a test alert are disabled with that tooltip.
   - **Send a test alert** results (toasts):
     - Sent: "Test alert sent. If nothing appeared, check Do Not Disturb or Focus Assist."
     - Expired sign-up (410): "This browser's alert sign-up has expired. Click Turn alerts back on."
     - Failed (502): "The test alert couldn't be sent: <human error from §8>."
     - Not set up (503): "Pop-up alerts aren't set up yet."
     - Too many (429): "You've sent 5 test alerts this hour. Try again later."
   - **Allowed browsers** (micro-label `ALLOWED BROWSERS`): one 44px row per allowed browser, newest `last_seen_at` first.
     - Each row shows a `Monitor` icon (`Smartphone` when the label names an iPhone, iPad or Android), the label (e.g. `Chrome on Windows`), a `THIS BROWSER` tag on the current one, and the meta line "Last seen Oct 8 · Last alert Mon, Oct 6, 1:02 PM" ("No alerts yet" before the first).
     - When that browser's latest alert failed, a second line in `--color-danger-text` shows the human error from §8.
     - An icon button `Trash2` (tooltip "Remove this browser") opens the confirm **"Remove Chrome on Windows?"** / "It stops getting pop-up alerts now. If you open Focus Log in that browser again, it signs back up — to stop it for good, remove it while using that browser, or block alerts there." For the current browser the body reads "This browser stops getting pop-up alerts until you allow them again." Buttons **Cancel** and **Remove browser** (danger). Toast: "Removed Chrome on Windows."
     - **Loading:** two 44px row skeletons.
     - **Empty:** a `BellOff` icon, **"No browsers allowed yet."** / "Allow alerts on each computer where you want a pop-up." and the secondary button **Allow alerts on this browser** (shown when this browser can allow alerts).
   - Notes: "The in-page banner and the flashing tab title always appear while Focus Log is open." and "Do Not Disturb, Windows Focus Assist and full-screen apps can hide pop-ups even when they're sent. The reminder email always goes out too."
3. **Weekly summary**
   - **"Email me my week every Monday at 8:00 AM"**: a switch (`weekly_email_enabled`).
   - The secondary button **Send a test email**. Success toast: "Test email sent to jdavis@power-in-numbers.net." When email isn't set up: "Email isn't set up yet. Add the Postmark key where Focus Log is hosted."
   - Meta line: "Skipped automatically when you logged nothing that week."
4. **Account**
   - The email, read-only.
   - A **Change password** form with the fields Current password, New password and Confirm new password, and the primary button **Change password**. Success toast: "Password changed." Wrong current password: "Your current password isn't right."
   - The secondary button **Sign out everywhere**, behind the confirm "Sign out on every device?" / "You'll need your password to sign back in on each one. Your timer keeps running." with **Sign out everywhere**.
5. **System status** (`id="status"`, the target of `/settings#status`; refreshes every 30 seconds; each line has a 10px dot that is green for healthy, orange for warning, red for problem and grey (`--color-text-muted`) for turned off, plus a sentence). The email lines count only real emails, never example rows.
   - **Email sending.** Healthy: "Connected · Last email Mon, Oct 6, 8:00 AM". Problem when the key is missing: "Not set up — POSTMARK_SERVER_TOKEN is missing". Warning when the key was rejected: "Postmark rejected the key — replace POSTMARK_SERVER_TOKEN".
   - **Background checks.** Healthy: "Running · Last check 32 seconds ago". Problem when the last check is over 3 minutes old: "Not running — last check 14 minutes ago". When turned off (grey): "Turned off (SCHEDULER_ENABLED=false)".
   - **Pop-up alerts.** Healthy: "On · 2 browsers · Last alert Mon, Oct 6, 1:02 PM" ("No alerts sent yet" before the first). Grey: "Turned off in Reminders" or "No browsers allowed yet". Warning when a browser's latest alert failed: "Last alert failed on Chrome on Windows — see Reminders". Problem when the keys are missing: "Not set up — VAPID keys are missing". Problem when the keys were rejected: "The alert keys were rejected — VAPID keys must match the ones browsers signed up with".
   - **Failed emails, last 7 days.** Healthy: `0`. Warning at 1 or more: "2 failed — see Sent emails" (link to `/data?tab=emails`).
   - **Emails this month.** `12 of 90`. Warning at 80% or more of the cap.
   - **Version.** The 7-character commit id.
6. **Danger zone** (1px `--color-danger` at 40% opacity border)
   - **"Delete all tracked data"** (h3) with the line "Projects, tasks, sessions and email records. Your login, settings and allowed browsers stay.", and the danger button **Delete all tracked data…**.
   - **Confirm dialog:**
     - Title **"Delete all tracked data?"**
     - Body: "This permanently deletes every project, task, session and email record — 312 sessions, 182h 40m. Your login, settings and allowed browsers stay. Download a copy of your hours first if you might want them: it's a spreadsheet you can read, and Focus Log can't load it back in."
     - A **Download a copy** link, which runs the CSV export.
     - The field "Type DELETE to confirm".
     - **Cancel**, then **Delete everything** (danger), disabled until the field equals `DELETE` exactly.
   - Success toast: "All tracked data deleted."

**Loading:** skeletons of the six section cards. **Error:** "Couldn't load your settings." / "Check your connection, then try again." with **Try again**.
**Help dialogs** (opened from the sidebar Help item and from `?`):
- **"How Focus Log works"** has five short points:
  1. "The clock runs on the server, so closing the tab or sleeping your laptop never loses time."
  2. "Pause closes a session. Resume starts a new one on the same task, and the clock carries on."
  3. "Forgot to stop? Use Stop at… to pick when you really stopped."
  4. "Fix any mistake in History: edit, delete, or add time."
  5. "Export everything as a spreadsheet from Your data."
  - Footer: "Something not working? Check System status in Settings."
- **"Keyboard shortcuts"** lists every shortcut from the shared conventions above, each with its kbd chips.

## 5. User flows

**F1 — First visit and setting a password**
1. The owner opens the site and is redirected to `/sign-in`.
2. They click **First time here? Set your password**, confirm the prefilled email and click **Send me a link**.
3. The server rate-checks the request, looks up the auth user by email, generates a recovery link with Supabase Auth admin `generateLink({ type: 'recovery', email })`, builds `${APP_URL}/set-password?token_hash=<hashed_token>&type=recovery`, logs an `email_log` row (`password_link`) and sends it through Postmark.
4. The screen shows "Check your inbox." whether or not the email belongs to an account.
5. The owner opens the email and clicks **Set my password**. The Set password screen appears.
6. They enter and confirm a password and click **Set password**.
7. The server calls `verifyOtp({ token_hash, type: 'recovery' })`, which creates a session, then `updateUser({ password })`. It sets the session cookies and redirects to `/`.
8. On the first signed-in load, if `time_zone_confirmed` is false, the browser sends its zone (`PATCH /api/settings { time_zone, time_zone_confirmed: true }`). The toast reads "Using your time zone: America/New_York. Change it in Settings."
- *Unhappy paths:*
  - An expired or used link shows "This link has expired or was already used." and **Send a new link**.
  - If Postmark isn't configured, the link isn't sent and the sign-in link form still shows the generic confirmation, while the server logs `EMAIL_NOT_CONFIGURED` and Settings shows the red status. The owner can recover by having a password set from the platform's operator path (§8 Your part).
  - The 4th link request in an hour answers 429: "Too many attempts. Wait 15 minutes and try again."

**F2 — Sign in and sign out**
1. The owner enters an email and password and clicks **Sign in**. They land on `next` or `/`.
2. Wrong credentials show the inline banner, and the 11th attempt in 15 minutes from one IP shows the 429 copy.
3. The sidebar Sign out icon ends this device's session and returns to `/sign-in`. **Sign out everywhere** ends all sessions.

**F3 — Start a new typed task**
1. The owner types "Invoice prep" and leaves the project picker on "Power in Numbers — Admin". They press Enter or click **Start**.
2. The client sends `POST /api/timer/start { task_name, project_id }`.
3. The server finds an active task with that name (case-insensitive) under that project or creates it, then calls `fl_timer_start`.
4. The response's timer view starts the clock: digits stagger in, the pool lights and the on-air dot appears. The input clears, and the Today list shows the running row.
- *Unhappy paths:*
  - An empty name keeps Start disabled.
  - A name over 80 characters shows "Keep task names under 80 characters." under the input.
  - If a task of that name exists but is archived, it is unarchived and used, with the toast "Unarchived Invoice prep."
  - A network failure shows the error toast "Couldn't reach Focus Log. Your timer hasn't changed." The button re-enables and nothing changes on screen.

**F4 — Start a saved task**
The owner clicks a Recent chip, picks a task from the combobox, or uses ⌘K → Start a task. The client sends `POST /api/timer/start { task_id }`, and the result is the same as F3. If the task was deleted on another device, the response is `FL_TASK_NOT_FOUND`: "That task no longer exists. Pick another or type a new one.", and the recents refresh. Starting a sample task makes it, and its sample project, the owner's own (F18).

**F5 — Pause and resume through the day**
1. The owner clicks **Pause** or presses `P`. `fl_timer_pause` closes the session, the clock freezes in secondary text, the pool fades out and the right flank shows `PAUSED 12:04 PM`.
2. The closed session slides into Today with the sparkle, and the Today total counts up. There is no toast, because Resume is the undo.
3. Later they click **Resume**. `fl_timer_resume` opens a new session on the same task in the same run, and the clock continues from the frozen value (the run total, §6).
4. Starting the paused task any other way does exactly what Resume does. That covers typing its name and pressing Start, picking it in the task box or ⌘K → Start a task, and **Start this task again** on one of its rows in Today or History.
   - While that task is selected or typed, the Start button reads **Resume**.
   - `fl_timer_start` takes the resume path (§3): the same run continues, the clock carries on from the frozen value, and STARTED keeps the run's first start time.
   - The response carries `resumed: true`, and the toast reads "Resumed Invoice prep."
   - Starting a **different** task while paused ends the run, and the new task's clock starts at `0:00:00`.
- *Unhappy paths:*
  - If another device already stopped the timer, the response is `FL_NOT_PAUSED` with the toast "The timer isn't paused — it may have changed on another device.", and the view refreshes.
  - If the owner pauses within 5 seconds of starting or resuming, nothing is logged and the toast reads "Under 5 seconds — nothing logged." The paused clock shows the run's earlier time, or `0:00:00` if that was the run's first session.
  - If the paused task has been archived, starting it by name unarchives it, as in F3 (toast "Unarchived Invoice prep."), and then resumes it. Picking it by id while it is archived answers `FL_TASK_ARCHIVED`, as Resume does.

**F6 — Switch tasks while running**
1. While Invoice prep is running, the owner picks "Episode outline" (combobox, chip or palette) and the button reads **Switch**.
2. `fl_timer_start` closes the current session with `switch` and starts the new one, in a new run, in the same transaction, so there is no gap and no overlap.
3. The toast reads "Switched to Episode outline. Logged 42m to Invoice prep." Starting the task that is already running does nothing, with the toast "Invoice prep is already running."
- *Unhappy path:* if the running session has run 24 hours or more, the Stop at dialog opens first, reading "This timer has run for over 24 hours. Pick when you actually stopped, then Episode outline starts." Confirming stops the old timer at the chosen time and starts Episode outline. **Cancel** changes nothing. If the server finds the old session over 24 hours anyway, it answers `FL_STOP_TOO_LONG` and the same dialog opens.

**F7 — Stop, with Undo**
1. The owner clicks **Stop** or presses `S`. `fl_timer_stop` closes the open session (when paused there is no open session, so the run simply ends), and the timer goes idle.
2. The toast reads "Logged 1h 12m to Invoice prep." (the run total) with **Undo** for 5 seconds. If the run logged nothing (it was stopped while paused after its only session fell under 5 seconds), the toast reads "Timer stopped. Nothing was logged." with no Undo.
3. **Undo** calls `POST /api/timer/undo-stop`, which restores exactly the previous state, running or paused. The session continues with no gap.
- *Unhappy path:* if Undo arrives after 30 seconds, or after another session was created, the toast reads "Too late to undo — add the time back in History if you need it."

**F8 — Forgot to stop (tab open)**
1. When the session passes the threshold (4 hours by default), the nudge banner appears.
2. If browser alerts are on, then at the scheduler's next tick (within 60 seconds) every allowed browser gets one pop-up: "Focus Log: timer still running" / "Invoice prep has been running for 4h 00m." A browser that allowed alerts but has no push sign-up shows the same pop-up from the open tab instead. Clicking the pop-up focuses the Focus Log tab (or opens one) at `/?nudge=<session_id>`, which opens Stop at….
3. If the tab is in the background, its title alternates every second between `⚠ Still running · 4h 00m` and the running title, until the tab is visible again. Browsers may slow this to about once a minute in a background tab, and that is accepted.
4. The owner picks one:
   - **Keep going** acknowledges the reminder. The banner hides, no further pop-ups go out for this session, the email for this session is skipped if it hasn't been sent, and an open pop-up for it in this browser is closed.
   - **Stop now** runs F7.
   - **Stop at…** opens the dialog, and the owner picks 1:00 PM, so the session is stored ending at 1:00 PM.

**F9 — Forgot to stop (tab closed)**
1. Within 60 seconds of the threshold, the scheduler sends the reminder email "Your timer has been running for 4h 00m" and one pop-up to each allowed browser. A browser that is running shows it straight away, even with no Focus Log tab open. A browser that is closed shows it when it next opens, if that is within an hour.
2. The owner clicks **Open Focus Log** in the email, or clicks the pop-up. Either goes to `/?nudge=<session_id>`.
3. If that session is still running, the Timer screen opens with the Stop at dialog already open. If it was already stopped, the screen loads normally with the toast "That timer was already stopped."
- *Unhappy paths:*
  - If Postmark fails, the send is retried after 5 and 30 minutes (§8). Each failure shows on Your data → Sent emails, and System status turns orange.
  - If a pop-up fails to send, it is retried after 5 and 30 minutes while the timer still runs. A browser whose sign-up has expired is removed from Allowed browsers.
  - Do Not Disturb, Focus Assist or a full-screen app may hide a delivered pop-up. The email still arrives.

**F10 — Add forgotten time**
1. The owner clicks **Add time** (Timer, History, Reports empty state, or `A`) and the dialog opens with its defaults.
2. They pick a task (or type a new one), a date and times, then click **Add time**.
3. The client sends `POST /api/sessions`. The new `manual` session appears in History and Today if it's today, and the toast reads "Added 1h 15m to Website copy review."
- *Unhappy paths:*
  - An overlap shows "This overlaps another session (Invoice prep, 9:00–10:12 AM). Adjust the times so they don't overlap."
  - A future time shows "Times can't be in the future."
  - A duration over 24 hours shows "A single session can be at most 24 hours. Split it into two entries."
  - Under 1 minute shows "Entries need to be at least 1 minute long."

**F11 — Edit a session**
1. In History or Today, the owner clicks a row or chooses **Edit…**.
2. They change the times or the task and click **Save changes**. The client sends `PATCH /api/sessions/:id`, the row updates with an `EDITED` tag, and the toast reads "Session updated."
- The same validation as F10 applies.
- If the running session's start is edited, the clock recalculates immediately.
- Moving a session of the current run to another task takes it out of the run, so the clock drops its time at the next refresh.

**F12 — Delete a session**
The owner chooses ⋯ → **Delete…** and confirms. The client sends `DELETE /api/sessions/:id`, the row collapses and the toast reads "Session deleted." The running session can't be deleted, so the owner uses Discard timer instead.

**F13 — Reports**
1. The owner opens Reports and sees this week. They switch to **MONTH** or step back with the previous arrow.
2. Clicking a project row reveals its tasks.
3. **Export CSV** downloads `focus-log_2026-10-06_to_2026-10-12.csv`.

**F14 — History search and export**
1. The owner types "acme". After 250ms the list filters, and the URL updates to `?q=acme`.
2. They choose `90D` and filter to one project, then click **Export CSV** to download exactly the filtered set.
3. **Show 50 more** pages through the rest.

**F15 — Manage projects and tasks**
- **Create:** on Your data → Projects the owner clicks **New project**, enters a name and picks a colour, then clicks **Create project**. The toast reads "Created Show It Off."
- **Archive:** archiving a project removes it and its tasks from the pickers. They stay in Reports and History.
- **Move a task:** moving a task to another project shows the inline warning and then saves.
- **Unhappy paths:**
  - A duplicate name shows "You already have a project called "Show It Off"."
  - Deleting a project with logged time is blocked: "This project has logged time, so it can't be deleted. Archive it instead to hide it."

**F16 — Monday summary**
1. Every Monday from 8:00 AM in the owner's time zone, the scheduler builds last week's summary (Monday–Sunday) and sends "Your week: 23h 15m across 4 projects".
2. The **Open this week in Reports** link goes to `/reports?period=week&start=2026-09-29`, and the **Add missed time** link goes to `/history?add=1&date=2026-09-29`.
3. If nothing was logged, no email is sent and the log shows `Skipped — nothing logged`.
4. If the switch is off, nothing is sent or logged.

**F17 — Settings changes**
1. Changing the reminder threshold to 2 hours saves on change. An already-running session past 2 hours shows the banner within 1 second (the client recomputes) and gets the email and pop-ups at the next scheduler tick, unless acknowledged.
2. Changing the time zone re-renders every date and time and moves the Today, week and month boundaries.

**F18 — Example data and the danger zone**
- **Using sample data:** starting a timer on "Invoice prep", or adding time to it, makes that task and "Sample: Admin & Billing" the owner's own in the same step. The owner can rename them in Your data.
- **Remove example data** deletes only rows that are still examples and keeps the claimed ones. The toast reads "Example data removed. Kept 1 project and 1 task you've logged time on: Sample: Admin & Billing, Invoice prep.", or just "Example data removed." when nothing was kept.
- **Dismissing the example notice** hides it on Timer, Reports and History. The card on Your data stays until the examples are removed.
- **Delete all tracked data** (after typing DELETE) empties projects, tasks, sessions and email records, and resets the timer to idle. Settings and allowed browsers stay.

**F19 — Two computers**
1. The owner starts a timer on the laptop.
2. On the desktop, the Timer screen refreshes within 30 seconds, or immediately when the window gains focus or the tab becomes visible, and shows it running with the identical time, because both read the server's start time.
3. Pressing Stop on one makes the other show idle at its next refresh. An action sent from a stale screen is rejected with the "may have changed on another device" toast, and that screen refreshes.

**F20 — Laptop asleep / tab in background**
The clock never counts ticks. On wake or `visibilitychange` → visible, the client refetches `GET /api/timer` and redraws from `started_at` and `server_now`, so the displayed time is correct within one frame.

**F21 — Pop-up alerts on a computer**
1. The owner taps **Allow alerts**, on the Timer prompt or in Settings → Reminders. Permission is asked only from this tap, never on page load.
2. The client calls `Notification.requestPermission()`, and the owner chooses Allow.
3. The client waits for the service worker (`navigator.serviceWorker.ready`), calls `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <the alert public key> })`, and sends the sign-up to `PUT /api/push/subscriptions`.
4. The browser appears under Allowed browsers as "Chrome on Windows" with the `THIS BROWSER` tag, and the toast reads "Pop-up alerts are on for this browser."
5. The owner clicks **Send a test alert**. Within seconds a pop-up reads "Focus Log test alert" / "Pop-up alerts are working on this computer.", and the toast reads "Test alert sent. If nothing appeared, check Do Not Disturb or Focus Assist."
6. On every later signed-in visit, the shell reads the browser's current sign-up (`pushManager.getSubscription()`) and re-saves it with `PUT /api/push/subscriptions`. A sign-up the browser changed without telling the site (Safari does this) is therefore kept current.
7. **On an iPhone or iPad:** in a Safari tab, Settings shows the Home Screen note instead of Allow alerts. The owner taps Share → Add to Home Screen, opens Focus Log from the new icon, signs in, and allows alerts in Settings from there. That Home Screen copy then appears as its own allowed browser ("Safari on iPhone").
- *Unhappy paths:*
  - Choosing Block shows the toast "Alerts are blocked. You'll still get the reminder email." and the readout shows the blocked line.
  - If the sign-up fails, the toast reads "This browser couldn't turn on pop-ups. You'll still get the reminder email."
  - If the server has no alert keys, the buttons are disabled with the tooltip "Pop-up alerts aren't set up yet", and System status shows red.
  - **Removing a browser:** the owner clicks its trash icon and confirms. The row is deleted. For the current browser the client also cancels the sign-up (`subscription.unsubscribe()`), so it isn't re-saved on the next visit.

## 6. Business logic & validation

**Permissions.** There is one role, Owner, which can do everything listed in §1 on its own rows only. RLS enforces this in the database, and each API route also requires a valid session. The scheduler uses the service role for reads, for `email_log` writes, and for the delivery fields of `push_subscriptions` (deleting rows whose push service reports them gone) only. Signed-out visitors reach only `/sign-in`, `/set-password`, `POST /api/auth/*`, `GET /api/health`, `GET /health`, and the static files `/sw.js`, `/manifest.webmanifest` and `/icons/*`.

**Timer states and transitions** (all inside the §3 database functions, with `now()` from the database):

| From | Action | Result |
|---|---|---|
| idle | start(task) | running: a new run and its first session open |
| running | start(other task) | running: the current session closes with `switch`, then a new run and session open. If the current session has run more than 24 hours: error `FL_STOP_TOO_LONG`, nothing changes |
| running | start(same task) | no change; the API answers 200 with `already_running: true` |
| running | pause | paused: the session closes with `pause`; the run continues. More than 24 hours: `FL_STOP_TOO_LONG` |
| running | stop / stop_at | idle: the session closes with `stop`; the run ends |
| running | discard | idle: the open session is deleted; the run's earlier sessions stay |
| paused | resume | running: a new session opens on the paused task, in the same run |
| paused | start(same task) | running: exactly like resume. A new session opens on the paused task, in the same run, and the clock carries on. The API answers 200 with `resumed: true` |
| paused | start(another task) | running: the paused run ends with nothing written, then a new run and session open |
| paused | stop | idle: the run ends; nothing in `sessions` is written |
| paused | stop_at | error `FL_NOT_RUNNING` |
| paused | discard | idle: the run ends; logged sessions stay |
| idle | pause / resume / stop / discard | error `FL_NOT_RUNNING` / `FL_NOT_PAUSED` |

`end_reason` records only how each session closed (`pause`, `stop` or `switch`) and is never rewritten. Which sessions make up a run comes from `run_id` alone.

**The run and the clock.**
- **What a run is:** the stretch from a Start to the Stop, Discard or new Start that ends it, including every pause/resume in between.
  - `fl_timer_start` gives each new run a fresh `run_id`. `fl_timer_resume` reuses `timer_state.run_id`, and so does `fl_timer_start` when it resumes the paused task, so every session of the run carries the same value.
  - Manual entries never belong to a run. A session moved to another task leaves its run (§3 `fl_detach_moved_session`).
- **How `fl_timer_view()` computes the run** (SECURITY INVOKER; called by `GET /api/timer` and returned by every `fl_timer_*` function):
  1. When idle, `run` is null.
  2. Otherwise, read this user's sessions where `run_id = timer_state.run_id`.
  3. Set `run.closed_seconds` to the sum of `duration_seconds` of the closed ones (`ended_at IS NOT NULL`). It is 0 when none survive, for example after a pause within 5 seconds of starting.
  4. Set `run.started_at` to the earliest `started_at` among them, including the open session when running. It is null when none survive, which can happen only while paused.
- **Clock while running:** `run.closed_seconds + (serverNow − session.started_at)`.
- **Clock while paused:** `run.closed_seconds`.
- **Clock while idle:** 0.
- **Server time on the client:** each timer view carries `server_now`. On receipt the client computes `offset = Date.parse(server_now) − (tSent + tReceived)/2` from its local send and receive times, and `serverNow = Date.now() + offset`.
- **Redraw:** the client redraws on a `setTimeout` aligned to the next whole second of `serverNow` (and `requestAnimationFrame` for paint). It refetches on `visibilitychange` → visible, on window `focus`, and every 30 seconds while visible. Elapsed time is never accumulated from ticks. In a background tab browsers may slow these timers to about once a minute; every redraw still computes from `serverNow`, so the clock is exact as soon as the tab is visible.

**Five-second rule.** A timer session that would close shorter than 5 seconds (by pause, stop or switch) is deleted instead of saved. `closed_session.dropped = true`, and the toast reads "Under 5 seconds — nothing logged." Manual entries must be at least 1 minute long.

**Twenty-four-hour rule.**
- A closed session is at most 24 hours long (DB constraint `sessions_max_24h`). Pausing, stopping or switching away from a session that has run longer raises `FL_STOP_TOO_LONG` (from the functions in §3, or from the constraint, which the API maps to the same code).
- The client prevents this: from 24 hours on, Pause and Stop open the Stop at dialog, and so does every way of starting or switching a task (§4 *The 24-hour rule for starting*).
- The scheduler never auto-stops a timer.

**Stop at.**
- `stop_at` must be at most `now()` ("The stop time can't be later than now.").
- It must be after the session's `started_at` ("The stop time has to be after the start time (9:02 AM).").
- It must be at most `started_at + 24h` ("A single session can be at most 24 hours. Pick an earlier stop time.").
- Stop at applies only while running. A stop time sent while paused answers `FL_NOT_RUNNING`.

**Undo stop** (`fl_timer_undo_stop(p_session_id, p_restore)`):
- **Allowed only when:**
  - the timer is idle and `timer_state.stopped_at` is at least `now() − 30 seconds`,
  - the session belongs to the user and is their most recent session by `started_at`,
  - its source is `timer`,
  - and its `end_reason` is `stop` when `p_restore = 'running'`, or `pause` when `p_restore = 'paused'`.
- **Restore to running:** set `ended_at = null` and `end_reason = null`, then set the timer to running on this session, with its `task_id` and `run_id`.
- **Restore to paused:** leave the session as it is, then set the timer to paused on its `task_id` and `run_id`, with `paused_at = ended_at`.
- Both clear `stopped_at`.
- **Otherwise:** `FL_UNDO_EXPIRED`.
- The client offers Undo only when the stop's response carried a `closed_session` that wasn't dropped, and passes `restore = closed_session.from`.

**Edit start time while running.** PATCH on a running session accepts only `started_at`. The new value must be at most `now()` and must not overlap the previous session (`23P01` → overlap message). Changing a running session's task is rejected: "Switch tasks from the Timer instead."

**Tasks and projects**
- **Project names:** 1–60 characters after trimming, unique per owner (case-insensitive) including archived projects.
- **Task names:** 1–80 characters, unique per owner per project (case-insensitive). Starting a timer by name reuses an existing task (unarchiving it if needed) instead of creating a duplicate. If two requests race and the unique index fires, the server re-selects the existing row.
- **Archiving a project** archives its tasks. Unarchiving a project unarchives the tasks that were archived at the same moment (same `archived_at`).
- **Archiving anything on the clock** (running, or paused with `timer_state.task_id` in it) answers 409 `ON_CLOCK`: "Stop the timer first — Invoice prep is on the clock."
- **Deleting a project:** first, if one of its tasks is on the clock (running, or paused with `timer_state.task_id` in it), 409 `ON_CLOCK`: "Stop the timer first — Invoice prep in this project is on the clock." Otherwise it is allowed only if none of its tasks has sessions, else 409 `HAS_SESSIONS`: "This project has logged time, so it can't be deleted. Archive it instead to hide it." Deleting cascades to its tasks.
- **Deleting a task:** allowed only with zero sessions and when it isn't on the clock. Otherwise: "This task has logged time, so it can't be deleted. Archive it instead to hide it."
- **Moving a task to another project** moves all its sessions in every report, because sessions belong to tasks.
- **"No project":** a task with `project_id = null` is reported under "No project", which always sorts last.
- **Last-used project:** `user_settings.last_project_id` is the default in the project picker. It is updated on every start and set to null if that project is archived or deleted.

**Sessions (manual add and edit)**
- `started_at < ended_at`: "The end time has to be after the start time."
- Neither time may be in the future: "Times can't be in the future."
- Duration at most 24 hours: "A single session can be at most 24 hours. Split it into two entries."
- Duration at least 60 seconds for manual entries: "Entries need to be at least 1 minute long."
- `started_at` at least `now() − 5 years`: "Pick a date within the last 5 years."
- **No overlap** with any other session, including the running one. On `23P01` the API queries the first overlapping session and names it:
  - "This overlaps another session (Invoice prep, 9:00–10:12 AM). Adjust the times so they don't overlap."
  - For the running timer: "This overlaps your running timer (Invoice prep, since 9:02 AM). Adjust the times so they don't overlap."
  - Back-to-back sessions are allowed.
- **Edited flag:** PATCH that changes `started_at`, `ended_at` or `task_id` sets `edited_at = now()`. Timer functions and undo never set it.
- **Runs:** manual entries never join a run. Moving a closed session to another task removes it from its run (§3), so the running clock never counts time filed under a different task.
- **Deleting:** closed sessions only. The running session answers 409 `RUNNING`: "Stop or discard the timer first."

**Time zone, days, weeks and months**
- All boundaries are computed in `user_settings.time_zone` with a tz-aware library (§9), never with the server's local time (the server runs in UTC).
- **Day:** local 00:00 to the next local 00:00. A DST day is 23 or 25 real hours, and durations are always real elapsed seconds.
- **Week:** Monday 00:00 to the next Monday 00:00, local.
- **Month:** the 1st at 00:00 to the 1st of the next month, local.
- **Clipping:** totals for any period (Today, Reports, the weekly email) count only the part of each session that falls inside the period: `max(0, min(end, periodEnd) − max(start, periodStart))`, where a running session's end is `serverNow`.
  - A session from 11:40 PM to 12:25 AM therefore counts 20 minutes to the first day and 25 minutes to the second.
  - History lists each session once, under the day it started, at its full duration.
- **Entered times:** every date and time typed into a dialog is read in the saved zone, never the computer's. When the two differ, the dialog shows `Times are in America/New_York.` (§4 Shared formats).
- **Changing the time zone** never moves stored instants. It only changes how they are grouped and displayed.

**Reports calculations**
- **Total:** the sum of clipped seconds in the range.
- **Previous total:** the same calculation for the immediately preceding week or month.
- **Delta:** total − previous. When the previous total is 0, the delta shows `—`.
- **Share:** `round(project_seconds / total × 100)`. Shares may sum to 99–101%.
- **Daily bars:** clipped seconds per local day per project.
- The current period includes the running timer up to `server_now`. Future periods can't be selected.
- **Invalid `start`:** the API answers 400 for a future range or a start that isn't a Monday (week) or a 1st (month). The Reports page never sends one, because it replaces such a URL with the current period first (§4).

**History search and paging**
- `q` is trimmed, matched case-insensitively as a substring (`ILIKE '%q%'` with `%` and `_` escaped) against the task name OR the project name, and limited to 80 characters.
- The range presets are relative to today (local): `7D` = the last 7 days including today, `30D` likewise, `90D` likewise, and `ALL` has no bound.
- **Paging** is keyset, 50 rows per page:
  - when sorted by date, on (`started_at`, `id`), newest first;
  - when sorted by duration, on (`duration_seconds`, `id`), longest first. The running session, which has no duration yet, is pinned at the top of the first page and left out of the keyset.
- **Day totals:** each day header shows the full length of every session in the current filters that started that day (the same rows listed under it, unclipped), with a running session counted up to `server_now`. The server computes them per day over the whole filtered set and returns them as `day_totals` (§7). The client never adds them up from the rows loaded so far.

**CSV export**
- **Format:** UTF-8 with BOM, RFC 4180 quoting, CRLF line endings.
- **Columns:** `date,start,end,duration_minutes,duration_hours,task,project,source,edited,session_id`.
  - `date` is the local `YYYY-MM-DD` of the start.
  - `start` and `end` are local `HH:MM` 24-hour, and an `end` on a later day is written as `YYYY-MM-DD HH:MM`.
  - `duration_hours` has 2 decimal places.
  - `project` is empty for No project.
  - `source` is `timer` or `manual`. `edited` is `yes` or `no`.
- **Rows:** running sessions are excluded. Any cell starting with `=`, `+`, `-` or `@` is prefixed with `'` (spreadsheet-formula guard). An export holds at most 50,000 rows, and above that the API answers 413: "That's more than 50,000 sessions. Pick a shorter date range."
- **Filenames:** `focus-log_<from>_to_<to>.csv`, or `focus-log_all_<today>.csv` with no range.
- **What it is:** a readable copy of the owner's hours. It is a record, not a backup: Focus Log has no import, so it can't be loaded back in.

**Reminders (the nudge)**
- **Measured on** the current session's continuous time (`now − session.started_at`), not the run, because "forgot to stop" means no break.
- **Threshold:** `nudge_after_minutes`, 30–720 minutes in 30-minute steps from the UI (the API accepts any integer in range): "Pick a time between 30 minutes and 12 hours."
- **In the page** (always on): the banner and, while the tab is hidden, the title flash.
- **Pop-up alerts (push):** when `nudge_browser_enabled` is on, the scheduler sends one alert for the session to every `push_subscriptions` row of the owner, at its first tick past the threshold (§8). Each browser gets at most one per session (`push_subscriptions.nudge_session_id`). A browser allowed after the threshold passed gets its one alert at the next tick. Every alert is tagged `fl-nudge-<session_id>`, so a second copy never stacks.
- **In-tab fallback:** a browser that has granted permission but has no push sign-up (push unsupported, or the sign-up failed) shows the same pop-up from an open Focus Log tab instead. It does so once per session per browser (`localStorage` key `fl-nudged-<session_id>`, same tag), and only while `nudge_browser_enabled` is on. A browser with a push sign-up never shows a second pop-up from the tab.
- **Email:** at most one per session (idempotency key `session:<id>`), sent by the scheduler (§8) when `nudge_email_enabled` is on.
- **Keep going** sets `nudge_acknowledged_at`.
  - The banner won't reappear for that session.
  - The scheduler sends no further pop-ups for it.
  - If the email hasn't been sent, the scheduler logs `skipped_acknowledged` instead of sending.
  - The tab where it was pressed closes any open pop-up tagged for that session. Stop, Stop at and Discard close it the same way.
- **What can hide a pop-up:** Do Not Disturb, Windows Focus Assist, full-screen apps and Chrome's quieting of alerts from often-ignored sites can hide a pop-up that was delivered. Focus Log can't detect this, which is why the email always goes out too and Settings offers **Send a test alert**.

**Weekly summary**
- **When it's due:** the week's Monday local time is between 08:00 and 23:59 and `weekly_email_enabled` is on. It covers the previous Monday–Sunday, with idempotency key `week:<YYYY-MM-DD of that Monday>`.
- **If the server was down** for the whole of Monday from 08:00, that week's email is not sent late.
- **Real time only:** every figure in the summary, and the "nothing logged" check, use only sessions with `is_example = false`. Sample sessions never appear in the email, and a week with only sample time counts as nothing logged. Today, Reports and History still show sample sessions.
- **Contents:** the total, the delta vs the week before, projects (time and share, sorted, No project last), the top 5 tasks by time, and per-day totals Mon–Sun. A timer still running at Sunday 24:00 contributes only up to then, with the line "A timer was still running at the end of the week. Time up to midnight Sunday is included."
- **Nothing logged:** a total of 0 means no email is sent and the status is `skipped_empty`.
- **Subject:** `Your week: 23h 15m across 4 projects`. One project reads `across 1 project`. Time with only "No project" reads `Your week: 3h 10m logged`.

**Email budget and limits**
- **Monthly cap:** `EMAIL_MONTHLY_CAP` (default 90) counts non-example `sent` rows in the current local calendar month across all kinds.
- **At the cap:** `nudge`, `weekly_summary` and `test` are recorded as `failed` with the error "Monthly email cap reached (90). Raise EMAIL_MONTHLY_CAP to send more.", with no retry. `password_link` is exempt, so the owner can always get in.
- **Password-link requests:** limited to 3 per hour and 10 per day, counted from non-example `email_log` rows.
- **Test email:** 3 per hour (429: "You've sent 3 test emails this hour. Try again later.").
- **Test alert:** 5 per hour (429: "You've sent 5 test alerts this hour. Try again later.").
- **Pop-up alerts** have no monthly cap: browser push is free, and the once-per-session-per-browser rule bounds them.

**Rate limits** (in-memory sliding windows, so "N per window" is exact; the app runs as one instance):

| Route | Limit | Over the limit |
|---|---|---|
| `POST /api/auth/sign-in` | 10 per 15 minutes per IP | 429 with the Sign in copy |
| `POST /api/auth/password-link` | 3 per hour per IP (plus the per-email counts above) | 429 |
| `POST /api/auth/set-password` | 10 per 15 minutes per IP | 429 |
| Every other authenticated mutation | 120 per minute per user | 429 "Slow down a moment and try again." |

**Client IP:** per-IP limits use the last address in `X-Forwarded-For`, which Railway's proxy appends, never the first, which a client can forge. Without that header, the socket address is used.

**Passwords:** 10–72 characters and not equal to the email. Change password requires the current password, which the server verifies with `signInWithPassword` before calling `updateUser`.

**Error messages for the timer functions:**

| Code | Message |
|---|---|
| `FL_TASK_NOT_FOUND` | "That task no longer exists. Pick another or type a new one." |
| `FL_TASK_ARCHIVED` | "That task is archived. Unarchive it in Your data, or type a new one." |
| `FL_NOT_RUNNING` | "The timer isn't running — it may have changed on another device." |
| `FL_NOT_PAUSED` | "The timer isn't paused — it may have changed on another device." |
| `FL_STOP_IN_FUTURE` | "The stop time can't be later than now." |
| `FL_STOP_BEFORE_START` | "The stop time has to be after the start time (9:02 AM)." |
| `FL_STOP_TOO_LONG` | "A single session can be at most 24 hours. Pick an earlier stop time." |
| `FL_UNDO_EXPIRED` | "Too late to undo — add the time back in History if you need it." |

After any timer error the client refetches `GET /api/timer`. `FL_STOP_TOO_LONG` in answer to a start or a pause also opens the Stop at dialog (§4), instead of only showing a toast.

**Example data**
- `is_example` rows behave like any other rows on Today, Reports and History, and seeded project names start with `Sample: `. The one exception is the Monday summary, which counts only real sessions (*Weekly summary*, above).
- **Becoming the owner's:** a sample task, and its project if still a sample, becomes the owner's own in the same transaction (§3 triggers), with `is_example = false` and `claimed_from_example_at = now()`. That happens when the first real (non-example) session is saved on the task, whether by a timer start, by Add time, or by moving a session onto it.
  - Creating a task under a sample project, or moving one there, claims the project the same way.
  - A claim is never undone, even if the session that caused it is later deleted.
- **Remove example data** calls the service-role-only function `fl_admin_delete_user_data(p_user_id uuid, p_examples_only boolean)` (EXECUTE revoked from `anon` and `authenticated`), passing the signed-in user's id and `true`:
  1. If `timer_state.task_id` still points at a sample task, that task and its project are claimed first. The app can't normally reach this state, because starting a timer saves a session, which claims the task.
  2. **Delete order:** sessions → tasks → projects → email_log, each `WHERE is_example = true`, then null `last_project_id` if it pointed at a deleted project.
  3. It returns what it removed, and what it kept: the claimed projects and tasks (`claimed_from_example_at IS NOT NULL`), by name.
  - It never fails because the owner used sample data. If the database still refuses a delete (a reference the rules above didn't foresee), the whole removal rolls back and the API answers 409 `EXAMPLES_IN_USE`: "Some example items are still in use, so nothing was removed. Stop the timer, then try again."
- **Example email records** are ignored by System status, the monthly cap, the password-link and test-email counts, and the once-only index (§3). They never block or count against a real email.
- **The example notice** on Timer, Reports and History is dismissible (§3, §4).

**Delete all tracked data** calls the same function with `false` in one transaction. It first sets `timer_state` to idle (deleting any open session), then deletes sessions → tasks → projects → email_log and nulls `last_project_id`. Settings, allowed browsers and the account remain. Closing the account entirely means deleting the Supabase project and the Railway service, which the owner owns.

**System status and the Timer notice**
- Every status line has a level: ok (green), warning (orange), problem (red) or off (grey).
  - **Email sending:** problem when `POSTMARK_SERVER_TOKEN` is unset; warning when the latest real send failed with Postmark's 401 / `ErrorCode 10` (key rejected); otherwise ok.
  - **Background checks:** off when `SCHEDULER_ENABLED=false`; problem when the last tick is more than 3 minutes old, or when no tick has happened 3 minutes after the process started; otherwise ok.
  - **Pop-up alerts:**
    - problem when `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` is unset;
    - problem when a browser's latest failure was a 401 or 403 from its push service and came after the last success anywhere (keys rejected);
    - warning when any browser's latest alert failed in another way;
    - off when `nudge_browser_enabled` is off or there are no allowed browsers;
    - otherwise ok.
  - **Failed emails, last 7 days:** warning at 1 or more non-example `failed` rows.
  - **Emails this month:** warning at 80% or more of the cap.
- `GET /api/status` lists every warning and problem in `problems`, problems before warnings, each with a key and the Timer notice message:

| Key | Level | Message |
|---|---|---|
| `email_not_configured` | problem | "Reminder emails aren't going out — email isn't set up yet." |
| `email_key_rejected` | warning | "Reminder emails aren't going out — Postmark rejected the key." |
| `scheduler_stopped` | problem | "Background checks have stopped, so reminders and Monday emails won't go out." |
| `push_not_configured` | problem | "Pop-up alerts aren't set up yet." |
| `push_key_rejected` | problem | "Pop-up alerts aren't going out — the alert keys were rejected." |
| `push_browser_failing` | warning | "Pop-up alerts are failing on Chrome on Windows." |
| `emails_failed` | warning | "2 emails failed in the last 7 days." |
| `email_cap_near` | warning | "You've used 72 of this month's 90 emails." |

- The Timer screen shows the System status problem notice whenever `problems` isn't empty (§4).

## 7. API surface

**Conventions**
- **Format:** JSON in and out (UTF-8). Timestamps are ISO 8601 UTC, and dates are `YYYY-MM-DD` local to the owner.
- **Auth:** Supabase session cookies, refreshed by middleware. Every route except `/api/health`, `/health` and `/api/auth/*` requires a signed-in owner and answers `401 { "error": { "code": "UNAUTHENTICATED", "message": "Sign in to continue." } }` otherwise.
- **Static files:** `/sw.js`, `/manifest.webmanifest` and `/icons/*` are served without sign-in (the middleware skips them) and are not API routes. `/sw.js` is sent with `Cache-Control: no-cache`.
- **Same-origin check:** non-GET routes reject an `Origin` that isn't `APP_URL` with `403 FORBIDDEN_ORIGIN`.
- **Errors:** `{ "error": { "code": "<CODE>", "message": "<human copy from §6>", "field": "<optional field name>" } }`. Common codes:
  - 400 `VALIDATION`
  - 404 `NOT_FOUND`: "That item no longer exists."
  - 409 for state conflicts
  - 429 `RATE_LIMITED`
  - 500 `SERVER_ERROR`: "Something went wrong on our side. Try again in a moment."
- **Requests and validation:** request bodies are validated with Zod. Unknown fields are rejected with 400. All data access uses a user-scoped Supabase client, so RLS applies.

**Shared shapes**
- `TimerView`:
  ```
  { status: "idle"|"running"|"paused",
    server_now,
    task: {id, name, archived} | null,
    project: {id, name, color, archived} | null,
    session: {id, started_at} | null,
    run: {started_at: string | null, closed_seconds} | null,
    paused_at: string | null,
    nudge: {after_minutes, due_at, acknowledged, active} | null,
    closed_session?: {id, seconds, run_seconds, dropped, end_reason, from: "running"|"paused"},
    already_running?: true,
    resumed?: true,
    unarchived?: true }
  ```
  `run` is computed from `run_id` (§6). `closed_session` is absent when nothing was closed, including a stop from paused whose run has no surviving session. `resumed` is present only when a start on the paused task resumed its run (§6). `unarchived` is present only when a start by name revived an archived task (the client then shows "Unarchived Invoice prep.", F3).
- `SessionRow`: `{ id, task: {id, name, archived}, project: {id, name, color, archived} | null, started_at, ended_at | null, duration_seconds | null, live_seconds | null, day_seconds?, source, end_reason, edited: boolean, is_example }`.

**Auth**
| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `POST /api/auth/sign-in` | none | `{email, password}` | 200 `{ok:true}` + cookies | 400 `VALIDATION`; 401 `INVALID_CREDENTIALS`; 429 |
| `POST /api/auth/password-link` | none | `{email}` | 202 `{ok:true}` (always, whether or not the account exists) | 400 `VALIDATION`; 429 |
| `POST /api/auth/set-password` | none | `{token_hash, type:"recovery", password}` | 200 `{ok:true}` + cookies | 400 `VALIDATION`; 400 `LINK_INVALID`; 429 |
| `POST /api/auth/sign-out` | owner | `{scope:"local"\|"global"}` | 204, cookies cleared | — |
| `POST /api/account/password` | owner | `{current_password, new_password}` | 204 | 400 `VALIDATION`; 400 `WRONG_PASSWORD` |

**Timer**
| Method & path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/timer` | — | 200 `TimerView` | — |
| `POST /api/timer/start` | `{task_id}` or `{task_name, project_id: uuid\|null}` | 200 `TimerView` (+`closed_session` when switching; `already_running` when the running task; `resumed` when the paused task) | 400 `VALIDATION`; 404 `FL_TASK_NOT_FOUND`; 409 `FL_TASK_ARCHIVED`; 409 `FL_STOP_TOO_LONG` (switching away from a session over 24 hours) |
| `POST /api/timer/pause` | — | 200 `TimerView` + `closed_session` | 409 `FL_NOT_RUNNING`; 409 `FL_STOP_TOO_LONG` |
| `POST /api/timer/resume` | — | 200 `TimerView` | 409 `FL_NOT_PAUSED`; 409 `FL_TASK_ARCHIVED` |
| `POST /api/timer/stop` | `{stop_at?: string}` | 200 `TimerView` + `closed_session` | 409 `FL_NOT_RUNNING` (also when `stop_at` is sent while paused); 400 `FL_STOP_IN_FUTURE` / `FL_STOP_BEFORE_START`; 409 `FL_STOP_TOO_LONG` |
| `POST /api/timer/discard` | — | 200 `TimerView` | 409 `FL_NOT_RUNNING` |
| `POST /api/timer/undo-stop` | `{session_id, restore:"running"\|"paused"}` | 200 `TimerView` | 409 `FL_UNDO_EXPIRED` |
| `POST /api/timer/acknowledge-nudge` | `{session_id}` | 200 `TimerView` | 409 `NOT_CURRENT_SESSION` ("That timer has already stopped.") |

**Today, sessions and export**
| Method & path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/today` | — | 200 `{date, time_zone, total_seconds, server_now, sessions: SessionRow[] (with day_seconds)}` | — |
| `GET /api/sessions` | query `q, range, from, to, projects, sort=date\|duration, cursor, limit≤50` | 200 `{rows: SessionRow[], next_cursor\|null, total_count, total_seconds, day_totals: [{date, seconds}]}`. `cursor` encodes (`started_at`, `id`) for `sort=date` and (`duration_seconds`, `id`) for `sort=duration`. `day_totals` has one entry per local start date that appears in `rows`, computed over the whole filtered set (§6). With `sort=duration` the running session, if it matches, is the first row of the first page only | 400 `VALIDATION` |
| `GET /api/sessions/:id` | — | 200 `SessionRow` (used by History's `?session=<id>` deep link, for a session not on the loaded page) | 404 |
| `POST /api/sessions` | `{task_id}` or `{task_name, project_id}`, plus `{started_at, ended_at}` | 201 `SessionRow` (source `manual`) | 400 `VALIDATION` (field messages); 409 `OVERLAP` (message names the conflicting session) |
| `PATCH /api/sessions/:id` | any of `{task_id, started_at, ended_at}` | 200 `SessionRow` | 400 `VALIDATION`; 404; 409 `OVERLAP`; 409 `RUNNING_EDIT` ("Switch tasks from the Timer instead." / "Stop the timer to set an end time.") |
| `DELETE /api/sessions/:id` | — | 204 | 404; 409 `RUNNING` |
| `GET /api/export.csv` | same filters as `GET /api/sessions` (none = everything) | 200 `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="…"` | 413 `TOO_MANY_ROWS` |

**Reports**
| Method & path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/reports` | `period=week\|month`, `start=YYYY-MM-DD` | 200 `{range: {start, end, label}, total_seconds, previous_total_seconds, includes_running, days: [{date, total_seconds, by_project: [{project_id\|null, seconds}]}], projects: [{id\|null, name, color, archived, seconds, share, tasks: [{id, name, seconds}]}]}` | 400 `VALIDATION` (future range or a start that isn't a Monday / 1st) |

**Projects and tasks**
| Method & path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/projects` | `include_archived=0\|1` | 200 `[{id, name, color, archived, task_count, total_seconds, last_used_at, is_example}]` | — |
| `POST /api/projects` | `{name, color}` | 201 project | 400; 409 `DUPLICATE_NAME` |
| `PATCH /api/projects/:id` | `{name?, color?, archived?: boolean}` | 200 project | 400; 404; 409 `DUPLICATE_NAME`; 409 `ON_CLOCK` |
| `DELETE /api/projects/:id` | — | 204 | 404; 409 `ON_CLOCK` (checked first: "Stop the timer first — Invoice prep in this project is on the clock."); 409 `HAS_SESSIONS` |
| `GET /api/tasks` | `q, project_id ("none" = No project), include_archived, recent=1 (top 6 by last_used_at)` | 200 `[{id, name, project, archived, session_count, total_seconds, last_used_at, is_example}]` | — |
| `POST /api/tasks` | `{name, project_id\|null}` | 201 task | 400; 409 `DUPLICATE_NAME` |
| `PATCH /api/tasks/:id` | `{name?, project_id?, archived?}` | 200 task | 400; 404; 409 `DUPLICATE_NAME`; 409 `ON_CLOCK` |
| `DELETE /api/tasks/:id` | — | 204 | 404; 409 `HAS_SESSIONS`; 409 `ON_CLOCK` |

**Pop-up alerts**
| Method & path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/push/subscriptions` | optional header `X-Push-Endpoint: <this browser's endpoint>` | 200 `{configured, public_key: string\|null, browsers: [{id, label, is_this_browser, last_seen_at, last_success_at, last_failure_at, error_human\|null}]}`. Never returns `endpoint`, `p256dh` or `auth_secret`. `is_this_browser` is true for the row whose endpoint equals the header | — |
| `PUT /api/push/subscriptions` | `{endpoint, expirationTime?: number\|null, keys: {p256dh, auth}}` (the browser's `PushSubscription.toJSON()`; `expirationTime` is ignored) | 200 `{id, label}`. Upserts by `endpoint` for the signed-in owner: refreshes the keys, `last_seen_at` and the label built from the `User-Agent` header (browser — Edge, Chrome, Firefox, Safari, Opera, else "Browser" — then " on ", then Windows, Mac, iPhone, iPad, Android, ChromeOS, Linux, else "this device"). An endpoint held by another account is never overwritten (RLS) | 400 `VALIDATION` ("That alert sign-up isn't valid."); 503 `PUSH_NOT_CONFIGURED` ("Pop-up alerts aren't set up yet.") |
| `DELETE /api/push/subscriptions/:id` | — | 204 | 404 |
| `POST /api/push/test` | header `X-Push-Endpoint` | 202 `{ok:true}` once the push service has accepted the test alert | 404 `NOT_SUBSCRIBED` ("This browser isn't set up for pop-ups yet. Click Allow alerts first."); 410 `SUBSCRIPTION_GONE` (the row is deleted; "This browser's alert sign-up has expired. Click Turn alerts back on."); 502 `PUSH_FAILED` ("The test alert couldn't be sent: <human error>."); 503 `PUSH_NOT_CONFIGURED`; 429 |

**Settings, data and status**
| Method & path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/settings` | — | 200 `{email, time_zone, time_zone_confirmed, nudge_after_minutes, nudge_email_enabled, nudge_browser_enabled, weekly_email_enabled, last_project_id, example_notice_dismissed_at}` | — |
| `PATCH /api/settings` | any subset of the editable fields above, plus `example_notice_dismissed: true`, which sets `example_notice_dismissed_at = now()` (`email` and `example_notice_dismissed_at` themselves are read-only) | 200 settings | 400 `VALIDATION` ("Pick a time zone from the list." / "Pick a time between 30 minutes and 12 hours.") |
| `POST /api/settings/test-email` | — | 202 `{ok:true}` | 503 `EMAIL_NOT_CONFIGURED`; 429 |
| `GET /api/email-log` | `cursor` | 200 `{rows: [{id, kind, status, subject, error_human, attempts, created_at, sent_at, is_example}], next_cursor}` | — |
| `GET /api/data/summary` | — | 200 `{example_counts: {projects, tasks, sessions, emails}, kept: {projects: [{id, name}], tasks: [{id, name}]}, totals: {sessions, seconds}}`. `example_counts` counts rows that are still examples; `kept` lists the claimed ones | — |
| `POST /api/data/remove-examples` | — | 200 `{removed: {projects, tasks, sessions, emails}, kept: {projects: [{id, name}], tasks: [{id, name}]}}` | 409 `EXAMPLES_IN_USE` ("Some example items are still in use, so nothing was removed. Stop the timer, then try again.") |
| `POST /api/data/delete-all` | `{confirm:"DELETE"}` | 200 `{deleted: {…}}` | 400 `VALIDATION` ("Type DELETE to confirm.") |
| `GET /api/status` | — | 200 `{email: {configured, key_rejected, last_sent_at, failed_7d, sent_this_month, monthly_cap}, scheduler: {enabled, last_tick_at, healthy, last_error}, push: {configured, enabled, key_rejected, browsers, failing_browsers: [label], last_sent_at}, problems: [{key, level: "warning"\|"problem", message}], version}`. Email figures exclude example rows | — |
| `GET /health` | none (public) | 200 `{ok:true}` whenever the process is answering (the hosting platform's liveness check; Railway's deploy health check still uses `/api/health`) | Never exposes anything else |
| `GET /api/health` | none (public) | 200 `{status:"ok", db:"ok", scheduler:"ok"\|"starting"\|"off", time}`; 503 `{status:"degraded", db:"ok"\|"error", scheduler:"ok"\|"starting"\|"off"\|"stale", time}` when a 3-second DB probe fails, or when the scheduler is enabled, the process has been up more than 3 minutes, and the last tick is older than 3 minutes. `starting` (up under 3 minutes with no tick yet) counts as healthy, so deploy health checks pass | Never exposes keys, emails or counts |

## 8. Integrations & extras

### Accepted extra: Postmark (transactional email)
**Why Postmark.** Focus Log sends only automatic system emails (reminders, the Monday summary, set-password links) to one inbox, and every one must land in the inbox, not spam, often within a minute. Postmark is a long-standing specialist in exactly this kind of transactional email. Its record on inbox placement is strong, it supports domain authentication (DKIM and Return-Path), and its free 100 emails a month covers expected use: about 5 Monday emails plus occasional reminders and links. Resend was considered as a backup and skipped (see below).

**How the app uses it**
- **Endpoint called:** `POST https://api.postmarkapp.com/email`.
  - **Headers:** `Accept: application/json`, `Content-Type: application/json`, `X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN`.
  - **Body:** `{ From: $EMAIL_FROM, To: "<owner email>", Subject, HtmlBody, TextBody, MessageStream: "outbound", Tag: "nudge"|"weekly"|"test"|"password-link", TrackOpens: false, TrackLinks: "None" }`.
  - **Timeout:** 10 seconds.
- **No webhooks are exposed.** Delivery status is read from the send response, and bounces don't apply to a single, verified, owner-owned inbox.
- **Exactly-once sending:** every send is preceded by an `email_log` insert with `status 'sending'` and `ON CONFLICT (user_id, kind, ref_key) WHERE is_example = false DO NOTHING RETURNING id`. Only the process whose insert succeeded sends. Then it sets `sent` with `provider_message_id` and `sent_at`, or `failed` with `error`, `attempts + 1` and `next_attempt_at`.
- **Responses and outcomes:**

| Postmark response | Recorded as | Retry | Human message (Sent emails / status) |
|---|---|---|---|
| 200, `ErrorCode 0` | `sent` | — | — |
| 401 / `ErrorCode 10` | `failed` | no | "Postmark didn't accept the email key. Replace POSTMARK_SERVER_TOKEN where Focus Log is hosted." (status panel: key rejected) |
| 422, `ErrorCode 400` or `401` (sender not confirmed) | `failed` | no | "The sending address isn't verified in Postmark yet. Finish the domain or sender check in Postmark." |
| 422, `ErrorCode 406` (inactive recipient) | `failed` | no | "Postmark has paused sending to this address after a bounce. Reactivate it in Postmark's Suppressions list." |
| 422, other codes | `failed` | no | "Postmark refused this email (code N): <Postmark message, max 200 chars>." |
| 429, 5xx, timeout or network error | `failed` | yes: after 5 minutes, then after 30 minutes (3 attempts total) | "Postmark couldn't be reached. Focus Log will retry." (after the final attempt: "Postmark couldn't be reached after 3 tries.") |
| `POSTMARK_SERVER_TOKEN` unset | no send | — | Scheduler: emails are not attempted, no rows are written, and the status panel shows red. Test email: 503 `EMAIL_NOT_CONFIGURED`. Password link: the row is logged as `failed` with "Email isn't set up yet." |

- **Retrying nudges:** a failed nudge is retried only while its session is still running. Otherwise `next_attempt_at` is cleared.
- **Claiming a retry:** before re-sending a `failed` row, the scheduler claims it with `UPDATE email_log SET status = 'sending', next_attempt_at = now() + interval '10 minutes' WHERE id = $1 AND status = 'failed' AND attempts < 3 AND next_attempt_at <= now() RETURNING id`. It sends only when a row comes back. Two overlapping passes therefore never send the same retry twice, for example during a deploy, when the old and new process run side by side for a moment. While a claimed retry is `sending`, `next_attempt_at` holds its 10-minute deadline.
- **Rows stuck in sending:** a row still `sending` past its deadline becomes `failed` ("Interrupted before sending.") and joins the retry path. The deadline is 10 minutes after creation for a first attempt, or the `next_attempt_at` its retry claim set. This happens when the process died mid-send. There is a small, accepted risk of one duplicate if Postmark had already accepted it.
- **Logging:** logs record the kind, `ref_key`, status and Postmark code only. They never record the email body, the token or the link.

**The scheduler (inside the web service; no extra service)**
- **Startup:** `instrumentation.ts` starts it once when `NEXT_RUNTIME === 'nodejs'` and `SCHEDULER_ENABLED !== 'false'`. The process start time is recorded either way, for `GET /api/health` (§7).
- **Loop:** `setTimeout`-chained every `SCHEDULER_INTERVAL_SECONDS` (default 60). A `ticking` flag skips a tick if the previous one is still running. The next tick is scheduled in a `finally` block, so a tick that throws still schedules the next one. The error is kept as `lastTickError` and logged.
- **Each tick:**
  1. Record `lastTickStartedAt`.
  2. **Nudge emails.** Using the service role, select running sessions (`ended_at IS NULL`) joined with `user_settings` (where `nudge_email_enabled`), `tasks` and `projects`, where `now() − started_at ≥ nudge_after_minutes`. Insert the `email_log` row (`kind 'nudge'`, `ref_key 'session:<id>'`, status `skipped_acknowledged` if `nudge_acknowledged_at` is set, else `sending`). Send if inserted as `sending` and under the cap.
  3. **Nudge pop-ups.** This step is skipped when `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` is unset.
     - Using the service role, select running sessions past `nudge_after_minutes`, as in step 2, where `user_settings.nudge_browser_enabled` is on and `nudge_acknowledged_at` is null.
     - For each of that user's `push_subscriptions` rows, claim the row for this session, send the nudge alert, and record the outcome on the row (*Pop-up alerts*, below).
  4. **Weekly.** For each `user_settings` row with `weekly_email_enabled`, compute local now. If it's Monday between 08:00 and 23:59, insert the `week:<prev Monday>` row as `sending`. If inserted, compute the summary (§6). A total of 0 sets `skipped_empty`; otherwise send.
  5. **Retries.**
     - Email rows that are `failed`, have `attempts < 3` and `next_attempt_at ≤ now()` are claimed (above) and re-sent.
     - Failed pop-up alerts are claimed and re-sent the same way (below).
     - Stale `sending` rows of both kinds are recovered.
  6. **Heartbeat.** Store `lastTickAt` and `lastTickError` in process memory. `GET /api/status` and `GET /api/health` read them, together with the process start time, and a tick older than 3 minutes is reported as unhealthy.
- **Why this works without a second service:** the scheduler writes only `email_log` and the delivery fields of `push_subscriptions`. It never creates, edits or deletes sessions, projects or tasks. Railway runs the web service continuously (app sleeping off, §10), so the loop keeps running between visits. If the app is ever moved to serverless hosting, this loop must move to a scheduled job.

**Email templates** (HTML plus a plain-text part; table layout; inline CSS)
- **Shared design:**
  - Colours: `bgcolor="#0C0E16"` on the body and `#121522` on the 560px card, text `#F4F1E8`, links `#E8C468`, with `<meta name="color-scheme" content="dark">`.
  - A 4px header band using `--gradient-ribbon` (solid `#1546C9` fallback), and below it the wordmark "Focus Log" with a gold sparkle.
  - Font stack `Archivo, Arial, Helvetica, sans-serif`.
  - Footer (12px, `#7F849A`): "Sent by your Focus Log at power-in-numbers.net. Turn these emails off in Settings: <APP_URL>/settings".
- **Reminder:**
  - Subject: `Your timer has been running for 4h 00m`.
  - Eyebrow `STILL RUNNING`, heading "Still on Invoice prep?"
  - Body: "Your Focus Log timer for Invoice prep (Power in Numbers — Admin) started at 9:02 AM and has been running for 4h 00m without a pause."
  - Gold button **Open Focus Log** → `<APP_URL>/?nudge=<session_id>`.
  - Line: "If you forgot to stop it, you can pick when you really stopped."
- **Weekly summary:**
  - Subject per §6.
  - Eyebrow `WEEK OF SEP 29 – OCT 5, 2026`, big total `23h 15m`, then `+2h 10m vs the week before`.
  - Tables: projects (colour square, name, time, share), top tasks (name, project, time), and days (Mon–Sun, each with its time).
  - Gold button **Open this week in Reports** → `<APP_URL>/reports?period=week&start=2026-09-29`.
  - Link: "Missed something? Add time" → `<APP_URL>/history?add=1&date=2026-09-29`.
- **Password link:**
  - Subject: `Set your Focus Log password`.
  - Body: "Use this link to set your password. It works once and expires in 60 minutes."
  - Gold button **Set my password**.
  - Line: "Didn't ask for this? You can ignore this email — your password hasn't changed."
- **Test:**
  - Subject: `Focus Log test email`.
  - Body: "Email is working. Reminders and your Monday summary will arrive at this address."

**Deliverability:** a DKIM- and Return-Path-verified domain, the transactional message stream only, a plain-text part on every email, no open or link tracking, a stable From address, and no marketing content.

**Env vars:**
- `POSTMARK_SERVER_TOKEN`: the owner supplies it.
- `EMAIL_FROM`: default `Focus Log <jdavis@power-in-numbers.net>`. This works with either the domain verification or the single-sender option in the owner's checklist.
- `EMAIL_MONTHLY_CAP`: default `90`.
- `SCHEDULER_ENABLED`: default `true`.
- `SCHEDULER_INTERVAL_SECONDS`: default `60`.

**Duty split**
- **What the build agents do:**
  - Implement the Postmark client, templates, `email_log` idempotency, retries, the cap, the scheduler loop, the status panel and the Sent emails tab.
  - Write the Supabase migrations and Auth configuration (email provider on, **sign-ups disabled**, minimum password length 10, email OTP expiry 3600s).
  - Create the seed script.
- **What is wired after deploy, against the live URL:**
  - Set `APP_URL` to the Railway URL, and set the Supabase Auth Site URL to the same value.
  - Run the seed once to create the owner's account and the example data.
  - Confirm `GET /api/health` returns 200.
  - Confirm System status shows "Background checks: Running".
  - With the owner's token in place, send a **Send a test email** and confirm it appears as `Sent` in Your data → Sent emails.
- **Your part (only the owner can do these):**
  1. Create a free Postmark account, create a server named "Focus Log", and add the domain `power-in-numbers.net` under Sender Signatures.
  2. Add the two DNS records Postmark shows (DKIM and Return-Path) at your domain's DNS host and click **Verify**. If you can't edit DNS, add a single sender signature for `jdavis@power-in-numbers.net` and click Postmark's confirmation email instead.
  3. Copy the Server API token and paste it when VibeStack asks for **Postmark (email sending key)**. Account approval isn't needed, because Focus Log only emails your own power-in-numbers.net address.
  4. Open the live site, click **First time here? Set your password**, and set your password from the email.
  5. Optional: turn on pop-up alerts on each computer you use (the steps are under *Pop-up alerts* below), so a long-running timer shows a pop-up even with Focus Log closed.
  6. Optional, recommended: upgrade Supabase to Pro (about $25/month) for daily backups you can restore from.
  - If the set-password email ever can't reach you (for example, Postmark isn't set up yet), the platform operator can set a temporary password for you through Supabase Auth admin. You then change it in Settings → Account.

### Accepted extra: Pop-up alerts (the browser's built-in Web Push)
**Why Web Push, with no service account.** The owner asked for a reminder "in your browser" that reaches them even when no Focus Log tab is open. Web Push is the standard built into Chrome, Edge, Firefox and Safari for exactly that.
- Each browser's maker runs a free delivery service for its own browser.
- Focus Log signs every alert with its own key pair (VAPID) and encrypts the contents so that only the receiving browser can read them.
- There is no vendor account, no key to request and no fee.

A hosted push service such as OneSignal would add an account, a third-party script on every page and a second place where the owner's data lives, for nothing a one-owner app needs.

**What it can and can't do**
- **When the browser is running:** a pop-up appears even with every Focus Log tab closed.
- **When the browser is fully quit:** the alert waits at the push service for up to 1 hour (`TTL`) and appears when the browser next opens. After that it is dropped, and the email is the reminder.
- **On iPhone and iPad** (iOS/iPadOS 16.4 or later): pop-ups work only from the Home Screen copy of the site.
- **Hidden alerts:** Do Not Disturb, Windows Focus Assist, full-screen apps, the operating system's own notification switch for the browser, and Chrome's quieting of often-ignored sites can hide an alert that was delivered. Focus Log can't detect that, so the email always goes too, and Settings has **Send a test alert**.

**Pieces the app ships**
- **Service worker** `/sw.js`: plain JavaScript in `public/`, scope `/`, served with `Cache-Control: no-cache` and without sign-in.
  - **Lifecycle:** `install` calls `self.skipWaiting()`, and `activate` calls `self.clients.claim()`.
  - **No fetch handler:** it creates no caches, so it never serves pages or stale data.
  - **`push`:** parses the JSON payload and calls `self.registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png', data: { url }, requireInteraction })` inside `event.waitUntil`. If the payload is missing or unreadable, it still shows "Focus Log" / "Open Focus Log to see what's happening." (tag `fl-generic`, url `/`), because browsers penalise a push that shows nothing.
  - **`notificationclick`:**
    1. It closes the notification.
    2. It looks for an open Focus Log window (`clients.matchAll({ type: 'window', includeUncontrolled: true })`).
    3. If one exists, it focuses that window and posts `{ type: 'fl-open', url }`. The page's message listener routes to that URL in-app, which opens Stop at… for `/?nudge=<id>`.
    4. Otherwise it calls `clients.openWindow(self.location.origin + url)`.
  - **`pushsubscriptionchange`:**
    1. It subscribes again with the same application server key: `event.oldSubscription.options.applicationServerKey`, or the `public_key` from `GET /api/push/subscriptions`.
    2. It sends the new sign-up with `PUT /api/push/subscriptions`.
    3. If that answers 401 (signed out), it stops, and the next signed-in visit re-saves the sign-up (§5 F21).
    4. The old row is removed the first time its push service answers 404 or 410.
- **App manifest** `/manifest.webmanifest`:
  ```
  {"name":"Focus Log","short_name":"Focus Log","start_url":"/","scope":"/","display":"standalone",
   "background_color":"#07080D","theme_color":"#07080D",
   "icons":[{"src":"/icons/icon-192.png","sizes":"192x192","type":"image/png"},
            {"src":"/icons/icon-512.png","sizes":"512x512","type":"image/png"},
            {"src":"/icons/icon-512-maskable.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
  ```
  `display: standalone` is what lets the iPhone/iPad Home Screen copy receive alerts.
- **Icons:** `/icons/icon-192.png`, `/icons/icon-512.png` and `/icons/icon-512-maskable.png`, the §2 mark rendered from its SVG (§9).
- **Routes:** `GET` and `PUT /api/push/subscriptions`, `DELETE /api/push/subscriptions/:id` and `POST /api/push/test` (§7).
- **No webhooks:** the result of each delivery comes back in the response to that send.

**Sending an alert** (server, `web-push` library)
- **Call:** `webpush.sendNotification({ endpoint, keys: { p256dh, auth: auth_secret } }, JSON.stringify(payload), { vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }, TTL, urgency: 'high', contentEncoding: 'aes128gcm', timeout: 10000 })`.
- **Payload** (JSON, under 1 KB, encrypted end to end so the push service can't read it):
  - **Nudge:** `{ "v": 1, "type": "nudge", "title": "Focus Log: timer still running", "body": "Invoice prep has been running for 4h 00m.", "tag": "fl-nudge-<session_id>", "url": "/?nudge=<session_id>", "requireInteraction": true }`, sent with `TTL` 3600 seconds. The duration is computed at the moment of sending.
  - **Test:** `{ "v": 1, "type": "test", "title": "Focus Log test alert", "body": "Pop-up alerts are working on this computer.", "tag": "fl-test", "url": "/settings", "requireInteraction": false }`, sent with `TTL` 60 seconds.
- **Once per browser per session:** before sending a nudge, the scheduler claims the browser's row with the statement below, and sends only when a row comes back. While a row is `sending`, `nudge_next_attempt_at` holds the claim's 10-minute deadline.
  ```
  UPDATE push_subscriptions
     SET nudge_session_id = $session, nudge_status = 'sending', nudge_attempts = 1,
         nudge_next_attempt_at = now() + interval '10 minutes'
   WHERE id = $sub AND nudge_session_id IS DISTINCT FROM $session
  RETURNING id
  ```
- **Responses and outcomes:**

| Push service response | Recorded as | Retry | Human message (Allowed browsers / status / test toast) |
|---|---|---|---|
| 201, 200 or 202 | `nudge_status 'sent'`, `last_success_at = now()`, `last_error` cleared | — | — |
| 404 or 410 (sign-up gone) | row deleted | — | The browser leaves Allowed browsers. Test alert: 410 `SUBSCRIPTION_GONE` |
| 401 or 403 | `failed`, `last_failure_at`, `last_error` | no | "The push service rejected Focus Log's alert keys. The VAPID keys must stay the ones browsers signed up with." (status: keys rejected) |
| 413 | `failed` | no | "The alert was too large for the push service." |
| 400 or another 4xx | `failed` | no | "The push service refused this alert (code N)." |
| 429, 5xx, timeout or network error | `failed`, with `nudge_next_attempt_at` set to now + 5 minutes after the 1st attempt and now + 30 minutes after the 2nd | yes, while the session is still running and not acknowledged (3 attempts total) | "The push service couldn't be reached. Focus Log will retry." (after the final attempt: "The push service couldn't be reached after 3 tries.") |
| `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` unset | no send | — | Scheduler: pop-ups are not attempted. Status red: "Not set up — VAPID keys are missing". `PUT` and test alert: 503 `PUSH_NOT_CONFIGURED` |

  The test alert updates `last_success_at`, `last_failure_at` and `last_error` the same way, but never touches the `nudge_*` fields.
- **Retry claim:** a failed nudge alert is claimed with the statement below and then re-sent. A failed alert whose session has stopped or been acknowledged gets `nudge_next_attempt_at = null` instead.
  ```
  UPDATE push_subscriptions
     SET nudge_status = 'sending', nudge_attempts = nudge_attempts + 1,
         nudge_next_attempt_at = now() + interval '10 minutes'
   WHERE id = $1 AND nudge_session_id = $session AND nudge_status = 'failed'
     AND nudge_attempts < 3 AND nudge_next_attempt_at <= now()
  RETURNING id
  ```
- **Stuck in sending:** a row still `sending` after its deadline becomes `failed` ("Interrupted before sending.") and joins the retry path.
- **Logging:** logs record the push service's host (e.g. `fcm.googleapis.com`), the status code and the row id only. They never record the endpoint, the keys or the payload.

**The key pair (VAPID).**
- **Creation:** generated once with `npx web-push generate-vapid-keys` and stored as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
- **Never changed:** every browser's sign-up is tied to the public key. A new pair makes every send fail with 401/403, and every browser then has to allow alerts again.
- **If it is ever lost:** generate a new pair, set both variables, and allow alerts again on each computer. System status shows the red "keys were rejected" line until then.

**Env vars:**
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: the key pair, generated by the build agents. The owner supplies nothing.
- `VAPID_SUBJECT`: `mailto:jdavis@power-in-numbers.net`, the contact the push services can reach about this sender.
- `SCHEDULER_ENABLED=false` pauses pop-up alerts along with automatic emails.

**Duty split**
- **What the build agents do:**
  - Write the service worker, the manifest and the icons.
  - Write the `push_subscriptions` migration and its RLS policies, and the four routes.
  - Build the scheduler's pop-up step, with its retries and recovery.
  - Build the Timer prompt, the Settings readouts, the Allowed browsers list and the System status line.
  - Generate the VAPID key pair once, and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` on the Railway service before the first deploy.
- **What is wired after deploy, against the live URL:**
  - Confirm `${APP_URL}/sw.js` and `${APP_URL}/manifest.webmanifest` load over HTTPS without signing in. Push needs HTTPS, which Railway provides.
  - Confirm System status shows no red Pop-up alerts line.
  - Note for later: alert sign-ups belong to the site's address. If Focus Log ever moves to a new address (for example a custom domain), each computer must allow alerts again there.
- **Your part (only the owner can do these):**
  1. On each computer where you want pop-ups, open Focus Log and click **Allow alerts**, either on the Timer screen's prompt or in Settings → Reminders. Choose **Allow** when the browser asks.
  2. Click **Send a test alert**. If nothing appears, check two things:
     - Do Not Disturb (Mac) or Focus Assist (Windows) is off.
     - Your computer allows notifications from your browser. On a Mac: System Settings → Notifications → your browser. On Windows: Settings → System → Notifications → your browser.
  3. To get pop-ups with Focus Log closed, leave the browser running. It doesn't need a Focus Log tab open. In Chrome on Windows, keep "Continue running background apps when Google Chrome is closed" turned on (Chrome → Settings → System).
  4. On an iPhone or iPad:
     1. Open Focus Log in Safari.
     2. Tap **Share**, then **Add to Home Screen**.
     3. Open Focus Log from the new icon and sign in.
     4. Click **Allow alerts** in Settings → Reminders.

### Skipped extras (and what that means)
- **Uptime-monitoring service** (e.g. UptimeRobot). Without it, you only learn the site is down when you open it. Railway still restarts the app automatically after a crash, and `GET /api/health` is ready if you add a monitor later.
- **Error-tracking/alert service** (e.g. Sentry). Without it, errors go only to the hosting logs and the Settings status panel, not to alerts sent to you.
- **A backup email provider** (e.g. Resend). Without it, a Postmark outage delays an email. It retries up to 3 times instead of switching providers.
- **No payments, texting, maps, file storage, analytics, or generated images, video or audio.** The app doesn't need them, so they aren't included.

## 9. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Language / framework | **TypeScript + Next.js 15 (App Router) + React 19**, run with `next start` | One deployable for pages, API routes and the in-process scheduler; server-rendered auth redirects |
| Database & auth | **Supabase** (Postgres 15+, Supabase Auth), `@supabase/supabase-js` + `@supabase/ssr` | RLS, exclusion constraints for no-overlap, database-clock timer functions, built-in email/password auth |
| Migrations | **Supabase CLI** (`supabase/migrations/*.sql`) | Versioned schema, RLS policies, functions and triggers in the repo |
| Validation | **Zod** | One schema per request body, shared with the forms |
| Time zones | **date-fns v4 + `@date-fns/tz`** (`TZDate`) | Correct local day/week/month boundaries across DST |
| Styling / tokens | **Tailwind CSS v4**, with every token in `src/styles/tokens.css` as CSS custom properties and mapped in `@theme` | Delivers the §2 tokens with no raw hex or px in components |
| Accessible primitives | **shadcn/ui on Radix** (Dialog, DropdownMenu, Popover, Tabs, Tooltip, Switch, Checkbox, RadioGroup, Select) | The state matrix, focus management and keyboard support come built in |
| Command palette | **cmdk** | ⌘K palette with grouped, fuzzy-filtered commands |
| Toasts | **Sonner**, styled to the tokens | Stacking limit, Undo actions, aria-live |
| Motion | CSS transitions + **Motion** (`motion/react`) for `AnimatePresence` list insert/remove | Signature moment 2 and the reduced-motion fallbacks |
| Icons | **lucide-react** | The only icon set, 16px in UI and 14px inline |
| Charts | **Recharts** | Stacked daily bars with token colours and custom tooltips |
| Fonts | **@fontsource-variable/archivo** (wdth axis), **@fontsource/jetbrains-mono** | Self-hosted, no render-blocking third-party fonts |
| Email | Postmark REST API via `fetch` (or the `postmark` npm client); templates as typed functions returning HTML + text | No vendor lock beyond one endpoint |
| Pop-up alerts | **web-push** (npm) on the server; a hand-written service worker `public/sw.js` and a static `public/manifest.webmanifest` | Standard VAPID signing and aes128gcm encryption to each browser's built-in push service, with no third-party account or script |
| App icons | **sharp**, in a one-off script `scripts/icons.ts` that renders the §2 mark's SVG to the three PNGs committed under `public/icons/` | The icons come from the same SVG as the mark, so they match the brief exactly |
| Logging | **pino** (JSON to stdout) | Structured logs in Railway with no bodies or secrets |
| Tests | **Vitest** (unit), **Playwright** + **@axe-core/playwright** (end-to-end + accessibility) | Covers §12 |
| CI | **GitHub Actions** | Typecheck, lint, unit, end-to-end and axe on every push; deploy only from a green `main` |

VibeStack Builder builds Focus Log on GitHub (code), Railway (hosting) and Supabase (database and login). The spec itself is portable to any equivalent stack: any Node host that keeps one process always on, any Postgres with `btree_gist`, and any auth that issues per-user sessions.

## 10. Deployment

**Shape: one always-on web service.** No additional services. The scheduler loop runs inside the web process (§8), which is why Railway's app-sleeping ("Serverless") setting must stay **off** for this service.

**Steps**
1. **Supabase project.**
   - Create the project in the owner's Supabase account (region near the owner, e.g. US East).
   - Enable the extensions `pgcrypto` and `btree_gist`.
   - Run `supabase db push` to apply the migrations in this order:
     1. extensions;
     2. tables, including `push_subscriptions`;
     3. constraints and indexes;
     4. `set_updated_at` triggers;
     5. RLS enable + policies;
     6. functions: `fl_timer_*`, `fl_timer_view`, `fl_timer_undo_stop`, `fl_admin_delete_user_data`, and the trigger functions `fl_detach_moved_session`, `fl_claim_example_on_session` and `fl_claim_example_on_task`;
     7. triggers: `fl_handle_new_user` on `auth.users`, and the three on `sessions` and `tasks`.
   - Revoke `EXECUTE` on `fl_admin_delete_user_data` from `anon` and `authenticated`.
   - Revoke `EXECUTE` on every `fl_timer_*` function, `fl_timer_view` and `fl_timer_undo_stop` from `anon` and `PUBLIC`, and grant it to `authenticated`.
2. **Supabase Auth settings.**
   - Email provider on.
   - **Allow new users to sign up: off.**
   - Minimum password length 10.
   - Email OTP expiry 3600 seconds.
   - Site URL = `APP_URL`.
   - Supabase's own emails are not used, because Focus Log sends the set-password link itself through Postmark.
3. **Railway service.**
   - Connect the GitHub repo and set the root to `/`.
   - The service settings below live in `railway.json` at the repo root (config as code), so every deploy uses them.
   - Build: `npm ci` (the lockfile is committed) then `npm run build`. Start command `npm run start` (`next start -H 0.0.0.0 -p $PORT`).
   - **Pre-deploy command `npm run migrate`**, which runs `supabase db push --db-url "$SUPABASE_DB_URL"`. This is how every release after launch applies its database changes.
     - `npm run migrate` runs `scripts/migrate.mjs`. When `SUPABASE_DB_URL` is not set on the host, it logs that this deploy ran no migrations and exits 0, and database changes are applied through the platform's migration tool instead. With it set, any migration error exits non-zero and fails the deploy.
     - It uses the Supabase CLI, from the `supabase` npm package, which is listed in `dependencies` so it is present when the deploy runs.
     - Railway runs this command after the build and before the new deployment starts, with the service's variables. Migrations can't run during the build, because the build has no database connection.
     - A migration that is already applied is skipped, so the command is safe to run on every deploy.
     - If the command exits with an error, Railway fails the deploy and the previous deployment keeps serving. A release's code therefore never takes traffic before its migrations have landed.
   - Health check path `/api/health`. It counts a scheduler that hasn't ticked yet in its first 3 minutes as healthy (§7).
   - Restart policy: on failure.
   - One replica.
   - App sleeping off.
4. **Environment variables.** Set them all (table below). The build agents generate the VAPID key pair once (`npx web-push generate-vapid-keys`) before the first deploy, and it is never regenerated (§8).
5. **Seed.** Run `npm run seed` once against production. It creates the owner `jdavis@power-in-numbers.net` (confirmed, no password) and the example rows, and is idempotent.
6. **Verify.**
   - `GET /api/health` → 200.
   - The Railway deploy log shows the pre-deploy step `npm run migrate` finished successfully, with no migration left pending, before the new deployment went live.
   - Sign-in page loads.
   - `/sw.js` and `/manifest.webmanifest` load without signing in.
   - The owner sets their password through the emailed link.
   - Settings → System status shows Email Connected and Background checks Running, and no red Pop-up alerts line.
   - A test email arrives.
7. **Release process.**
   - Every change goes through a pull request. CI runs typecheck, lint, Vitest, Playwright and axe against a disposable Supabase (local CLI stack).
   - Merging to `main` triggers the Railway deploy. Railway switches traffic only after `/api/health` passes.
   - Migrations are additive. Railway's pre-deploy command (step 3) applies each release's new migrations before its code serves any traffic. A failed migration fails the deploy and leaves the previous version serving.
   - Rollback is "Redeploy" on the previous Railway deployment. A destructive migration is never shipped in the same release as code that depends on it.

**Environment variables (complete)**
| Name | Purpose |
|---|---|
| `PORT` | Port the web service binds to (Railway provides it) |
| `APP_URL` | Public base URL (e.g. `https://focus-log.up.railway.app`), used in email links and the same-origin check. Optional on Railway: when unset, the app uses `https://` + Railway's built-in `RAILWAY_PUBLIC_DOMAIN`. Set it when the app moves to a custom domain |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key for user-scoped, RLS-enforced requests (server-side only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for the scheduler, `email_log` writes, `push_subscriptions` delivery writes, password-link generation, the seed and the data-removal function. Never sent to the browser |
| `SUPABASE_DB_URL` | Optional. Postgres connection string for the Supabase database, used only by the pre-deploy migration command (`npm run migrate`), never by the running app. Without it, deploys skip migrations (see step 3). Use the session-pooler connection string (port 5432) from Supabase → Connect, because Supabase's direct database address is IPv6-only. Percent-encode any special characters in the database password. Never sent to the browser |
| `POSTMARK_SERVER_TOKEN` | Postmark Server API token (supplied by the owner) |
| `EMAIL_FROM` | From address, default `Focus Log <jdavis@power-in-numbers.net>` |
| `OWNER_EMAIL` | `jdavis@power-in-numbers.net`, used by the seed script |
| `EMAIL_MONTHLY_CAP` | Monthly email budget, default `90` |
| `SCHEDULER_ENABLED` | `true` by default; `false` pauses all automatic emails and pop-up alerts without a redeploy of code (the kill switch) |
| `SCHEDULER_INTERVAL_SECONDS` | Tick interval, default `60` (tests use `5`) |
| `VAPID_PUBLIC_KEY` | Public half of the pop-up alert key pair (base64url), sent to browsers when they allow alerts. Generated once by the build agents; never changed |
| `VAPID_PRIVATE_KEY` | Private half, used to sign every alert. Never sent to the browser. Never changed, because a new pair makes every browser's sign-up fail until each allows alerts again |
| `VAPID_SUBJECT` | `mailto:jdavis@power-in-numbers.net`, the contact the push services can reach about this sender |
| `NODE_ENV` | `production` |

The commit id shown in Settings comes from Railway's built-in `RAILWAY_GIT_COMMIT_SHA` and needs no setup.

**Reliability and recovery**
- **What the app rides on:**
  - Railway restarts the process on crash and gates deploys on the health check.
  - Supabase runs the database and auth.
  - On Supabase **Pro**, daily backups with 7-day retention can be restored from the Supabase dashboard.
  - On the **Free** plan there are no restorable backups. **Export everything** (CSV) on Your data gives a readable copy of every session, but it isn't a backup:
    - Focus Log can't load it back in.
    - It doesn't hold project colours, archived status or settings.
    - If the database were lost on Free, projects and tasks would have to be re-created and sessions re-entered by hand.
- **Free-plan pausing:** Supabase pauses free projects after a week without activity. The scheduler's minute-by-minute checks keep the project active. If it is ever paused, the owner clicks **Restore** in the Supabase dashboard.
- **When something breaks at 2am:**
  1. Settings → System status shows what failed.
  2. `SCHEDULER_ENABLED=false` stops all automatic emails and pop-up alerts.
  3. Railway "Redeploy previous" rolls the code back.
  4. The timer data is never touched by the scheduler, so a scheduler bug can't corrupt time records.

**Monthly running cost**

| Item | Cost |
|---|---|
| Railway (one web service) | ~$5/mo |
| Supabase Free | $0 |
| Supabase Pro (recommended, for daily backups) | ~$25/mo |
| Postmark | $0 on the free 100 emails/month |
| Pop-up alerts (browsers' built-in push) | $0, no account |

**Total:** ~$5/mo on Supabase Free, or ~$30/mo with Pro. Focus Log runs as **one service**, the website, with its background checks built in.

## 11. Owner/admin toolkit (recommended)
Focus Log has one user, holds no money and accepts nothing from the public. So it needs no moderation tools, no user management and no revenue view. What running it does need:
- **Your data screen**, *recommended, keep or trim*. A friendly in-app place to see, rename, recolour, archive and delete projects and tasks, with sessions editable in History. This is how the owner manages their own data without ever opening Supabase's developer dashboard.
- **Sent emails log**, *recommended, keep or trim*. Every reminder, weekly summary, test and password link with its status and a plain-English failure reason, so a missing email is explainable in seconds.
- **System status panel** (Settings), *recommended, keep or trim*. Shows whether email is connected, whether the background checks are running, whether pop-up alerts are working, the failure count, emails used against the cap, and the version. Any warning or problem also appears as a notice on the Timer screen, the one the owner opens every day. It replaces a separate monitoring service at this size.
- **Allowed browsers and Send a test alert** (Settings → Reminders), *recommended, keep or trim*. Lists every computer that gets pop-up alerts, when each last got one and why one failed, with a way to remove a browser. The test proves pop-ups actually reach this computer, since Do Not Disturb or Focus Assist can hide them silently.
- **Email kill switch** (`SCHEDULER_ENABLED`) and **monthly email cap**, *recommended, keep or trim*. A way to pause automatic emails and pop-up alerts at once, and a guard so a bug can't burn through the Postmark allowance.
- **Export everything (CSV)**, *recommended, keep or trim*. The owner's own readable copy of every session. It is a record, not a backup: Focus Log can't load it back in, so restorable backups come only from Supabase Pro.
- **Remove example data**, *recommended, keep or trim*. One click clears the sample rows once the owner has seen how things work, keeping any sample project or task the owner has logged real time on.
- **Delete all tracked data**, *recommended, keep or trim*. A clean slate without deleting the account, behind a typed confirmation.
- **Help: "How Focus Log works" and Keyboard shortcuts**, *recommended, keep or trim*. The support path for the app's only user: what to do when stuck, with a pointer to System status.

## 12. Test plan
Each test maps to a specced behaviour. "Deploy-verified" means the behaviour is checked once on the live deployment.

**Test environment**
- **End-to-end tests** run Playwright against the built app with:
  - a local Supabase stack;
  - `POSTMARK_SERVER_TOKEN=POSTMARK_API_TEST` (Postmark's test token, which accepts and doesn't deliver);
  - `SCHEDULER_INTERVAL_SECONDS=5`;
  - a test VAPID key pair;
  - a local HTTPS mock push service, whose self-signed certificate is trusted through `NODE_EXTRA_CA_CERTS`.
- **The mock push service** records every delivery, decrypts it with the test sign-up's private key, and can be set to answer 201, 404, 410, 401, 403 or 500. Test sign-ups point at it and are saved through `PUT /api/push/subscriptions`.
- **Unit tests** cover the time math with fixed clocks.

**Auth and account**
- **T-A1:** Signed-out `GET /`, `/reports`, `/history`, `/data` and `/settings` redirect to `/sign-in?next=…`. Every protected API answers 401 `UNAUTHENTICATED`. Signed out, `/sw.js`, `/manifest.webmanifest` and `/icons/icon-192.png` answer 200 (not a redirect), and `/sw.js` carries `Cache-Control: no-cache`.
- **T-A2:** A correct email and password sign in and land on `next`. A wrong password shows "That email and password don't match…". The 11th attempt in 15 minutes answers 429 with its copy.
- **T-A3:** The password-link request answers 202 with identical copy for the owner's address and an unknown address. Only the owner's request writes a `password_link` row. The 4th request in an hour answers 429.
- **T-A4:** Set password with a valid `token_hash` signs in and redirects with the toast "Password set. You're signed in." Reusing the token shows "This link has expired or was already used." A missing token shows "This link is incomplete." Loading the page alone does not consume the token.
- **T-A5:** Password rules: 9 characters → "Use at least 10 characters."; 73 → "Use 72 characters or fewer."; equal to the email → its message; mismatch → "The two passwords don't match."
- **T-A6:** Change password with a wrong current password → "Your current password isn't right."; with the correct one → toast and new credentials work. Sign out everywhere invalidates a second browser context.
- **T-A7:** The public sign-up endpoint (`supabase.auth.signUp`) is rejected (sign-ups disabled). There is no sign-up UI anywhere.
- **T-A8:** The seed creates `jdavis@power-in-numbers.net` with confirmed email and no password, along with its `user_settings` and `timer_state`. Running the seed twice creates no duplicates.

**Security (access rules enforced)**
- **T-S1:** A second auth user is created only in the test database.
  - That user's client reads 0 rows belonging to the owner from `projects`, `tasks`, `sessions`, `email_log`, `user_settings`, `timer_state` and `push_subscriptions`.
  - Its UPDATE and DELETE attempts on the owner's rows affect 0 rows.
  - Its INSERT of a session referencing the owner's task fails the `WITH CHECK`.
- **T-S2:** The `anon` role reads and writes nothing in any table.
- **T-S3:** `authenticated` cannot INSERT, UPDATE or DELETE `email_log`, and cannot execute `fl_admin_delete_user_data`. `anon` cannot execute any `fl_timer_*` function, `fl_timer_view` or `fl_timer_undo_stop`.
- **T-S4:** No response body, page source or client bundle contains `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `POSTMARK_SERVER_TOKEN` or `VAPID_PRIVATE_KEY`. `GET /api/health` returns only `status`, `db`, `scheduler` and `time`.
- **T-S5:** A non-GET request with a foreign `Origin` answers 403. Unknown body fields answer 400.
- **T-S6:** CSV export prefixes a task named `=SUM(A1)` with `'`.
- **T-S7:** `GET /api/push/subscriptions` never returns `endpoint`, `p256dh` or `auth_secret`, and `is_this_browser` is true only for the row matching `X-Push-Endpoint`. A `PUT` with an endpoint already saved by the second test user leaves that user's row unchanged.
- **T-S8:** Per-IP rate limits use the last `X-Forwarded-For` address. Eleven sign-in attempts, each with a different forged first address but the same last address, still get 429 on the 11th.
- **T-S9:** `fl_handle_new_user` is `SECURITY DEFINER` with `search_path=public` (checked in `pg_proc.proconfig`), and creating an auth user still creates both of its rows.

**Timer core (the primary objective)**
- **T-T1:** Start a typed new task. A task is created under the selected project, and a session opens with `started_at` within 2s of the database `now()`, not the client clock (the test skews the browser clock by +10 minutes and verifies). That session and `timer_state` carry the same new `run_id`, and the clock renders gold.
- **T-T2:** Starting the same name again reuses the task, with no duplicate. A name matching an archived task unarchives it and shows its toast.
- **T-T3:** Pause closes the session with `pause`, and the clock freezes. Resume opens a new session on the same task with the same `run_id`, and the clock continues from the frozen value (`run.closed_seconds` correct across 3 pause/resume cycles).
- **T-T4:** Switch closes with `switch` and opens the new session, with a new `run_id`, at the same instant, with no gap and no overlap. The toast shows both names.
- **T-T5:** Stop from running and stop from paused both go idle and clear `run_id`. A stop from paused writes nothing to `sessions`: the last session keeps `end_reason = 'pause'`. A later Start on the same task begins a new run whose clock starts at `0:00:00`.
- **T-T6:** The five-second rule.
  - A session closed in under 5 seconds is deleted, and the toast reads "Under 5 seconds — nothing logged."
  - Pausing within 5 seconds of a run's first start leaves the paused clock at `0:00:00` with `run.started_at` null. Pausing within 5 seconds of a resume leaves it at the run's earlier total.
  - Switching to another task within 5 seconds of starting succeeds with "Under 5 seconds — nothing logged.": the new task is running in a new run, and the first session is gone.
  - Stopping within 5 seconds of starting succeeds with the same toast: the timer is idle and no session remains.
  - None of these answers an error, and in each the database's delete of the short session happens after `timer_state` has moved off it.
- **T-T7:** Undo within the toast restores running (no gap) or paused exactly, with the session's `run_id`. Undo after 30 seconds (counted from `timer_state.stopped_at`) → `FL_UNDO_EXPIRED` copy. Stopping while paused when the run logged nothing shows "Timer stopped. Nothing was logged." with no Undo.
- **T-T8:** Stop at in the future, before the start, or beyond 24 hours each shows its exact message. A valid Stop at stores that `ended_at`. Sending a stop time while paused answers `FL_NOT_RUNNING`. The live line:
  - After a pause and resume, it reads "Logs 4h 00m to Invoice prep (5h 10m on this timer since 9:02 AM).", with the session and run figures matching the chosen time. The "Logged …" toast after confirming shows the bracketed run figure.
  - With no earlier session in the run, the bracket is absent.
- **T-T9:** A session running more than 24 hours (start time edited back 25h in the test DB) makes Pause and Stop open Stop at with the 24-hour line.
- **T-T10:** Single running timer: two parallel `POST /api/timer/start` calls from two browser contexts leave exactly one open session. Inserting a second open session directly violates `sessions_one_running`.
- **T-T11:** Two devices: stopping in context A, then pausing in context B, answers `FL_NOT_RUNNING` with the "may have changed on another device" toast, and B refreshes to idle within 1s. A stale context B updates within 30s, or immediately on focus.
- **T-T12:** Clock accuracy: hide the tab (emulate `visibilitychange`), advance the clock 10 minutes, show it again. The displayed time equals the server-derived elapsed time ±1s, and no tick-counting drift appears after 1 hour of emulated time.
- **T-T13:** Discard while running deletes the open session and leaves earlier sessions. Discard while paused goes idle and keeps the logged sessions.
- **T-T14:** Edit start time while running recalculates the clock. A future start or an overlap with the previous session shows its message. Changing the task of a running session → 409 "Switch tasks from the Timer instead."
- **T-T15:** Document title shows `▶ H:MM:SS · Task — Focus Log` while running, `❚❚ …` while paused, and `Focus Log` while idle.
- **T-T16:** Run accuracy, covering the cases a guessed run would get wrong:
  - Start A, pause, resume, discard: the earlier session stays logged, and starting A again shows `0:00:00`.
  - Start A, pause, Stop, then start A again: the clock shows `0:00:00`.
  - Start A, pause, start B, then switch back to A: the clock shows `0:00:00`.
  - Start A, pause, then start A again, in turn:
    - by typing its name and pressing Start;
    - by picking it in the combobox;
    - by the palette's Start a task item;
    - by **Start this task again** on its Today row.

    Each time:
    - before pressing, the button reads **Resume**;
    - the response has `resumed: true` and the toast reads "Resumed A.";
    - the new session carries the same `run_id`;
    - the clock carries on from the paused value, and STARTED is unchanged.
  - With paused A archived directly in the test database, starting A by name unarchives it and resumes the same run.
  - A manual entry on task A, added mid-run, doesn't change the clock.
  - Moving a closed session of the current run to task B (History → Edit) clears its `run_id` and lowers the clock by its duration at the next refresh.
- **T-T17:** The 24-hour rule for starting. The running session's start is edited back 25 hours.
  - **Every way of starting** (the Start/Switch button, Enter in the combobox, a Recent chip, the palette's Start a task item, and **Start this task again**) opens the pending-start Stop at dialog ("…then Episode outline starts." / **Stop and start Episode outline**).
  - **Confirming** stores the chosen stop time and starts the new task. **Cancel** changes nothing.
  - **A direct `POST /api/timer/start`** for another task answers 409 `FL_STOP_TOO_LONG` and leaves the timer unchanged. From a stale screen, that answer opens the same dialog.

**Today, sessions and History**
- **T-H1:** Today lists sessions overlapping today, newest first. A session from 11:40 PM yesterday to 12:25 AM today shows `FROM YESTERDAY` and contributes 25m to the Today total.
- **T-H2:** Add time: happy path creates a `manual` session with the toast. Overlap (including with the running timer) names the conflicting session. Future, more than 24 hours, under 1 minute and more than 5 years ago each show their exact message.
- **T-H3:** Edit sets the `EDITED` tag and `edited_at`. Timer actions never set `edited_at`.
- **T-H4:** Delete confirm names the session. Deleting removes the row, and the totals update. Delete on the running row is disabled with its tooltip, and the API answers 409 `RUNNING`.
- **T-H5:** Search "acme" matches task names and project names case-insensitively. `%` in the query is treated literally. The presets `7D`/`30D`/`90D`/`ALL` and a custom range filter correctly, and To before From shows its message.
- **T-H6:** Pagination shows 50 rows plus `Showing 50 of N`, and **Show 50 more** appends the next 50 with no duplicates. Sorted by duration, with 120 sessions including many of equal length, paging on (`duration_seconds`, `id`) returns every session exactly once, longest first, with the running session pinned at the top of page 1.
- **T-H7:** CSV export has the exact columns, BOM, local times and filtered set, excludes the running session, and answers 413 above 50,000 rows (unit test with a mocked count).
- **T-H8:** Deep links `?add=1&date=…` and `?session=<id>` open the right dialog.
- **T-H9:** Day totals come from the server. With 60 sessions started on one day, that day's header on the first page shows the total of all 60 before **Show 50 more** is pressed. A session crossing midnight counts in full under the day it started.
- **T-H10:** Entered times use the saved zone. With the browser in `America/Los_Angeles` and the saved zone `America/New_York`, Add time at 9:00 AM on 2026-10-08 stores `13:00Z`, and the dialog shows "Times are in America/New_York." With matching zones the line is absent.

**Reports**
- **T-R1:** Week totals: Monday–Sunday boundaries in the owner's time zone. A session crossing Sunday→Monday is split between the weeks. Share rounding and "No project" sorting last are correct.
- **T-R2:** The month view has 28–31 bars. The delta vs the previous period is correct, with `—` when the previous total is 0. Next is disabled on the current period.
- **T-R3:** The running timer is included up to now in the current period, with the "Includes your running timer…" line.
- **T-R4:** DST (unit test): totals for `America/New_York` on 2026-03-08 and 2026-11-01 use real elapsed seconds. Day boundaries fall at local midnight.
- **T-R5:** Expanding a project row reveals its tasks with correct times.
- **T-R6:** Opening `/reports?period=week&start=2026-10-07` (a Wednesday), a future start, or `start=nonsense` replaces the URL with the current week and shows it, never the error state. `GET /api/reports` with the same values answers 400.

**Projects, tasks and data**
- **T-D1:** Duplicate project and task names show their messages, and the same task name under two projects is allowed.
- **T-D2:** Archiving a project hides it and its tasks from pickers but keeps them in Reports and History. Unarchive restores them. Archiving anything on the clock → 409 copy.
- **T-D3:** Deleting a project or task with sessions → 409 "Archive it instead". Deleting one without sessions succeeds, with the project delete cascading to its tasks. A project whose task is paused on the clock with no logged time (paused within 5 seconds of its first start) answers 409 `ON_CLOCK` with "Stop the timer first — Invoice prep in this project is on the clock.", shown as the error toast, and the project and task remain.
- **T-D4:** Moving a task shows the inline warning with the correct counts, and its sessions move in Reports.
- **T-D5:** Seeded project names all start with `Sample: `, and example sessions 2 and 3 share one `run_id`. Remove example data deletes exactly the rows still marked `is_example`. It leaves the owner's own rows, account, settings, timer state and allowed browsers, and the example notice and the Your data card then disappear.
- **T-D6:** Delete all tracked data requires `DELETE` exactly, then leaves zero projects, tasks, sessions and email rows, an idle timer, and intact settings, allowed browsers and login.
- **T-D7:** Using sample data:
  - Starting a timer on "Invoice prep" sets `is_example = false` and `claimed_from_example_at` on that task and on "Sample: Admin & Billing" in the same request.
  - Add time on a sample task does the same, and so does creating a task under a sample project.
  - The Your data card then names the claimed items.
  - Remove example data succeeds and keeps them, and its toast reads "Example data removed. Kept 1 project and 1 task you've logged time on: Sample: Admin & Billing, Invoice prep."
  - No path through the UI makes it answer 409.
- **T-D8:** The example notice can be dismissed on Timer. That sets `user_settings.example_notice_dismissed_at`, and the notice then stays hidden on Timer, Reports and History after reloads and in a second browser context signed in as the owner. The Example data card on Your data stays.
- **T-D9:** Example email rows don't count. With the seeded `sent` weekly row for last week's Monday present, the real Monday summary for that week still sends (T-E7 setup). System status ("Last email", "Failed emails", "Emails this month"), the monthly cap and the test-email limit ignore example rows.

**Settings, reminders and email (observable in Your data → Sent emails and Settings)**
- **T-E1:** The time zone auto-applies on first load (`time_zone_confirmed` becomes true) with its toast. The mismatch notice appears when the browser zone differs and is dismissable per zone.
- **T-E2:** Nudge threshold options run from 30 minutes to 12 hours in 30-minute steps. The API rejects 29 and 721 with "Pick a time between 30 minutes and 12 hours."
- **T-E3:** Edit a running session's start back past the threshold. The banner appears with the exact copy. Within 2 ticks one `nudge` row is `sent`, and further ticks add no second row.
- **T-E4:** Pressing **Keep going** before the tick produces a `skipped_acknowledged` row and no send, and no allowed browser receives a pop-up. The banner doesn't return for that session.
- **T-E5:** With `nudge_email_enabled` off, no nudge row is written. With the browser switch on, permission granted (Playwright `grantPermissions`) and no push sign-up in this browser, exactly one in-tab Notification fires per session. With a push sign-up saved for this browser, the tab fires none.
- **T-E6:** The title flash alternates while the tab is hidden and the nudge is active, and stops when the tab is visible.
- **T-E7:** Weekly: unit tests of `isWeeklyDue(now, tz)` (due Monday 08:00–23:59 local, not due Sunday or Tuesday) and `buildWeeklySummary` (clipping, delta, top 5 tasks, subject singular/plural, skip at 0, and example sessions ignored).
  - In the end-to-end test, the owner's time zone is set to one where it is currently Monday 08:00–23:59.
    - With real logged time last week, a `sent` row appears, and its figures leave out example sessions from the same week.
    - With none, `skipped_empty` appears.
    - With only example sessions last week, `skipped_empty` appears too.
  - The real Monday 8:00 AM delivery is deploy-verified.
- **T-E8:** Test email: 202 and a `test` row `sent`. A 4th test in an hour → 429 copy. With the token unset → 503 `EMAIL_NOT_CONFIGURED` and System status shows "Not set up".
- **T-E9:** Failure handling (Postmark mocked):
  - 5xx → `failed` with retries after 5 and 30 minutes, then the final message.
  - 401 → no retry, and the status shows "key rejected".
  - A stale `sending` row is recovered, including a claimed retry once its 10-minute deadline passes.
  - Two retry passes running at once (simulated) send a `failed` row only once, because only the pass whose claim `UPDATE` returns the row sends.
- **T-E10:** Cap: with `EMAIL_MONTHLY_CAP=2` and 2 sent rows, the next nudge is `failed` with the cap message, while a password link still sends.
- **T-E11:** Scheduler state:
  - `SCHEDULER_ENABLED=false` → no new rows and no pop-up deliveries, and status shows "Turned off" in grey.
  - With the scheduler running, status shows "Last check N seconds ago", and the line turns red when the tick is older than 3 minutes (simulated).
  - A tick that throws (database error injected) is kept as `lastTickError`, and the next tick still runs.
- **T-E12:** Email content: the reminder and weekly HTML include the exact subjects, the links (`/?nudge=<id>`, `/reports?period=week&start=…`, `/history?add=1&date=…`), a plain-text part, and no tracking. Opening `/?nudge=<id>` for a running session opens Stop at, and for a stopped one shows "That timer was already stopped."
- **T-E13:** Domain verification and inbox placement of real emails (not spam) are deploy-verified.

**Pop-up alerts (observable in Settings → Reminders, System status and the mock push service)**
- **T-P1:** Permission is asked only from a tap. Loading every screen with permission `default` never calls `Notification.requestPermission` (spied), and clicking **Allow alerts** calls it exactly once. The Timer prompt appears once after the first start and not again after **Not now**, and never appears when `PushManager` is missing.
- **T-P2:** `PUT /api/push/subscriptions` creates one row with a label built from the User-Agent. Saving the same endpoint again updates `last_seen_at` and the keys without adding a row.
  - A non-`https` endpoint or missing keys → 400 "That alert sign-up isn't valid."
  - With the VAPID keys unset → 503.
  - Unit test: the label function maps a fixed list of user agents: Chrome on Windows, Edge on Windows, Safari on Mac, Safari on iPhone, Firefox on Linux, Chrome on Android, and an unknown one → "Browser on this device".
- **T-P3:** With notifications granted and `pushManager.getSubscription` stubbed to return a fixed sign-up on the mock push service, every signed-in page load sends one `PUT /api/push/subscriptions` with that sign-up, and Allowed browsers marks it `THIS BROWSER`.
- **T-P4:** Scheduler delivery. Two sign-ups are on the mock push service, and a running session is edited back past the threshold.
  - Within 2 ticks, each sign-up receives exactly one request carrying a VAPID `Authorization` header and `TTL: 3600`.
  - Each decrypted payload has the exact nudge title, body, tag `fl-nudge-<id>` and url `/?nudge=<id>`.
  - Further ticks add none.
  - A sign-up saved after the threshold passed gets its one alert at the next tick.
  - Each row in Allowed browsers then shows "Last alert …", and the System status Pop-up alerts line is green.
- **T-P5:** Alerts are independent of email: with `nudge_email_enabled` off they still send. With `nudge_browser_enabled` off, or after **Keep going**, no sign-up receives one.
- **T-P6:** Gone sign-ups: the mock answering 410 (and separately 404) deletes that row, and the browser disappears from Allowed browsers. The other sign-up still gets its alert.
- **T-P7:** Retries. The mock answers 500.
  - The alert is recorded `failed` and retried after 5 and 30 minutes (clock advanced). The row then shows "The push service couldn't be reached after 3 tries."
  - System status turns orange, and the Timer notice reads "Pop-up alerts are failing on Chrome on Windows."
  - Stopping the timer before a retry cancels it.
  - Two scheduler passes running at once send each claimed alert once.
  - A row left `sending` past its deadline is recovered.
- **T-P8:** Keys:
  - Answers of 401 or 403 are not retried. System status shows "The alert keys were rejected…", and the Timer notice shows the red problem.
  - With the keys unset, System status shows "Not set up — VAPID keys are missing", the Allow alerts buttons are disabled with their tooltip, and no delivery is attempted.
- **T-P9:** Send a test alert:
  - When the mock accepts: 202, the payload has the title "Focus Log test alert" and tag `fl-test`, and the `nudge_*` fields don't change.
  - 410 → the row is deleted and the expired toast shows.
  - 500 → 502 with its toast.
  - Keys unset → 503.
  - The 6th test in an hour → 429 "You've sent 5 test alerts this hour. Try again later."
- **T-P10:** Service worker, in Chromium through the DevTools protocol (`ServiceWorker.deliverPushMessage`):
  - A nudge payload shows exactly one notification (`registration.getNotifications()`) with the exact title, body and tag.
  - A second delivery with the same tag still leaves one.
  - An unreadable payload shows "Focus Log" / "Open Focus Log to see what's happening."
  - `/sw.js` registers no `fetch` handler, and `caches.keys()` stays empty.
- **T-P11:** Service worker handlers (Vitest, with `self`, `clients` and `registration` mocked):
  - `notificationclick` focuses an open Focus Log window and posts `{type:'fl-open', url}`, or opens `/?nudge=<id>` when none is open. The page routes `fl-open` to Stop at….
  - `pushsubscriptionchange` subscribes again with the same key and PUTs the new sign-up, and stops quietly on 401.
- **T-P12:** **Keep going**, Stop, Stop at and Discard each close an open notification tagged `fl-nudge-<id>` in this browser.
- **T-P13:** Removing a browser deletes its row, with the confirm copy. Removing the current browser also calls `unsubscribe()`, and the next page load sends no `PUT`.
- **T-P14:** Settings readouts and manifest:
  - With `PushManager` removed → "This browser can't show pop-up alerts. The reminder email still arrives."
  - With an iPhone Safari user agent outside standalone mode → the Home Screen note.
  - With permission `denied` → the blocked line.
  - Granted with no sign-up → "This browser stopped receiving alerts." with **Turn alerts back on**.
  - `/manifest.webmanifest` has `display: standalone` and the three icons, and each icon URL answers 200.
- **T-P15:** Deploy-verified:
  - On a real computer with every Focus Log tab closed and the browser running, a nudge pop-up appears within 60 seconds of the threshold, and clicking it opens Stop at….
  - On an iPhone, after Add to Home Screen and allowing alerts, the test alert appears.

**Reliability**
- **T-L1:** `GET /api/health`:
  - With the DB up and the scheduler ticking → 200 with `scheduler: "ok"`.
  - With the DB unreachable (stopped local stack) → 503 `degraded` within 3 seconds.
  - With the last tick older than 3 minutes after more than 3 minutes of uptime (simulated) → 503 with `scheduler: "stale"`.
  - In the first 3 minutes, before any tick → 200 with `scheduler: "starting"`.
  - With `SCHEDULER_ENABLED=false` → 200 with `scheduler: "off"`.
- **T-L2:** Any timer action failing on the network shows "Couldn't reach Focus Log. Your timer hasn't changed." and the UI state is unchanged.
- **T-L3:** A 401 mid-session redirects to `/sign-in?next=…&expired=1` with the expired notice. After signing in, the still-running timer shows the correct time.
- **T-L4:** System status notice on Timer:
  - With `POSTMARK_SERVER_TOKEN` unset, the Timer screen shows the red notice "Reminder emails aren't going out — email isn't set up yet.", and **Open System status** goes to `/settings#status`.
  - With two problems, the body reads "And 1 more issue. See Settings → System status for what to do."
  - Dismissing it with a real outage present hides it until a new problem appears or 24 hours pass (clock advanced), and it comes back every 24 hours while the outage remains.
  - With only `emails_failed` present (one failed email), dismissing keeps the notice hidden across reloads and after 24 hours and 6 days (clock advanced). A second failed email raises the count, and the notice comes back. When the count drops back to 0 as old failures age out and then a new failure arrives, the notice comes back too.
  - Settings → System status shows the failed count throughout.
  - With only grey "off" lines (no browsers allowed, scheduler turned off), no notice appears.
- **T-L5:** Migrations on deploy.
  - `npm run migrate`, with `SUPABASE_DB_URL` pointing at the local Supabase stack, applies every migration and exits 0. Running it again applies nothing and exits 0. With a deliberately broken migration added, it exits non-zero. CI runs this before the end-to-end tests.
  - Deploy-verified: a release that adds a migration shows the pre-deploy step applying it in the Railway deploy log before the new deployment goes live. A failing pre-deploy leaves the previous deployment serving.

**Design checks (a failure here is a fix cycle like any bug)**
- **T-X1 Tokens:**
  - `src/styles/tokens.css` defines every §2 token with the exact hex and duration values: the ramp, neutrals, semantics, gradients, project palette, type scale, spacing, radii, shadow, motion and z-index.
  - A lint check fails on any raw hex or `px` value in `src/components` and `src/app` outside tokens.
- **T-X2 State matrix:**
  - Tabbing through every screen shows a visible 2px gold focus ring with 2px offset on every interactive element, and none has `outline:none` without the ring.
  - Disabled buttons (Start with empty input, Next on the current period, Delete everything before typing DELETE) are inert on click and on Enter.
  - The pressed and selected styles match the §4 table.
- **T-X3 Data states:**
  - **Loading:** for Today, the stage, Reports, History, every Your data tab, Settings and its Allowed browsers list, a throttled network shows a skeleton that mirrors the layout, never a lone spinner.
  - **Empty:** an empty database shows each designed empty state with its exact headline, guidance and action.
  - **Error:** a forced 500 shows each error state with its exact copy and a working **Try again**.
- **T-X4 Keyboard:**
  - The core flow works by keyboard alone: `N`, type, Enter starts; `P` pauses and resumes; `S` stops; the Undo toast is reachable.
  - The palette works: `⌘K`/`Ctrl K` opens it, arrows move, Enter runs a command, Esc closes.
  - In dialogs and menus, Esc closes only the topmost layer and focus returns to the trigger.
  - `?` opens the shortcuts dialog. Shortcuts don't fire while typing in inputs.
- **T-X5 Accessibility:**
  - axe (WCAG 2.1 AA) reports zero violations on all 7 screens and on every open dialog, menu and palette state.
  - Every input has a label.
  - Toasts are in an aria-live region.
  - The chart has an `aria-label` summary and a hidden data table.
  - Hit targets are at least 40px, and at least 44px for stage controls and the mobile layout.
- **T-X6 Motion:**
  - Hovers and toggles transition in 140ms. Menus and toasts take 200ms, and dialogs, the drawer and the palette 260ms, using `--ease-out` on entry and `--ease-in` on exit.
  - The digit stagger is 30ms per character at 180ms each. The light pool fades in 300ms, and the on-air halo breathes over 2.4s.
  - The logged sparkle takes 600ms, and the Today total counts up over 400ms.
  - The chart grows only on first render.
  - With `prefers-reduced-motion: reduce`, every translate, scale and stagger becomes a 120ms fade, with no sparkle and no grow, and the halo is static.
- **T-X7 Responsive:**
  - At 360px and 1440px widths there is no horizontal overflow on any screen (`document.documentElement.scrollWidth ≤ innerWidth`).
  - History and Your data tables become cards below 768px.
  - The sidebar becomes a rail at 768–1023px and a drawer below 768px.
- **T-X8 Brief fidelity:**
  - The stage renders gold-gradient digits, the light pool and the cyan on-air dot only while running.
  - The flank labels and the gold hairline (40% width, 16px below) are present.
  - The stage is framed by a 1px `--color-rim` border with an 8px radius. It is the only gold-edged surface: no other card, panel or dialog has a gold border.
  - Gold gradient lettering appears on the wordmark, every h1 and the Reports display total, and nowhere else (not on h2, h3, body text, buttons or charts). It carries no `text-shadow`, glow or filter.
  - The sign-in sparkle field is identical across reloads and avoids the card.
  - The stage's 10-sparkle field is identical across reloads, avoids the clock box, task bar and controls row, is `aria-hidden`, never animates, and is hidden under `forced-colors`.
  - The ribbon gradient appears only on the auth card edge, the 2px band at the top of every signed-in screen, and the email header band.
  - The app icons in `/icons/` are rendered from the §2 mark.
  - Gold never appears on a page background or a chart series.
  - Fonts load from self-hosted files only, with no requests to third-party font hosts.
  - Contrast pairs from §2 measure at or above the stated ratios.

<!-- stackbuilder:requires_auth=true -->

<!-- stackbuilder:public_tables=(none) -->

<!-- stackbuilder:public_write_tables=(none) -->

<!-- stackbuilder:owner_account={"email":"jdavis@power-in-numbers.net","role":"Owner"} -->

<!-- stackbuilder:platform_target=web -->
