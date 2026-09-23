# overview

`common-notebook` is a suite of no-brand, personal utilities: primarily a **task list** (shown on the *To Do*
page), plus a **review** feature (periodic planning + a daily page, with subscribed calendars) and
**practice and study**, which runs on the same task substrate. Two independent npm projects (no
workspace tooling):

- `frontend/` — Next.js 16 (App Router), React 19, TypeScript. The UI. Runs on `localhost:3000`.
- `backend/`  — Strapi 5 headless CMS/API (`common-notebook-api`). The data layer. Runs on `localhost:1337`.

License: AGPL v3.

# Frontend

## Stack
- Next.js `^16` App Router, React `^19`, TypeScript strict, import alias `@/` → frontend root.
- Styling: Tailwind CSS v4 (PostCSS/CSS-based config, no `tailwind.config`) + daisyUI 5 (themes
  `retro`, and `dim` for dark). No CSS modules. **Styling goes on the markup**, through the shared
  components below where a look repeats; `app/css/` holds only what markup can't carry.
  - **Shared components carry the app's look**, rather than a repeated string of utilities:
    `components/ui/FormControls.tsx` (`Field`, `Input`, `Select`, `Checkbox`, `CheckboxInput`,
    `Toggle` — daisyUI's controls with the app's square corners and full-strength border),
    `components/ui/Button.tsx` (the outlined text button), `components/ui/tooltip.ts` (`TOOLTIP`, the
    class string for a `data-tip` tooltip in each theme's colors),
    `components/ui/DrawerHeader.tsx`, `components/ui/DisclosureToggle.tsx`, `components/auth/Auth.tsx`,
    `(main)/(todo)/components/TaskSection.tsx` (`TaskGrid`, `TaskSection`,
    `TaskSectionHeading`, `TaskList`, and `TaskSubsections`/`TaskSubsection` for labeled lists
    stacked in one column), and `(main)/review/components/ReviewParts.tsx` (the
    review pages' column, sections, project groups, notes and put-back arrow).
  - **Anything that opens over the page is Radix Dialog** (`@radix-ui/react-dialog`), styled by us:
    `components/ui/Drawer.tsx` for the main menu (`chrome/MainMenu`) and the task actions drawer
    (`(todo)/components/TaskForms.tsx`), and `PracticeSessionModal`. Radix gives Escape, focus
    kept inside and returned, scroll lock, and exit animations (`animate-drawer-*`/`animate-fade-*`
    in `screen.css`, keyed on `data-state`). No other Radix primitives until one is needed; daisyUI's
    checkbox drawers are gone.
  - **Colors are daisyUI's tokens, by their own names** (`base-content` for ink, `base-100` for
    paper, `success` for "yes, this one"). Where the two themes need different tokens, say so with
    `dim:` (or `light-dark()` in a string handed to a chart).
  - **The type scale is six roles, and a heading's element is its role.** Tokens in `screen.css`,
    all in rem: `text-title` and `text-section` (Sweetheart, fluid between 393px and 1440px wide),
    `text-label` (Lato bold caps), `text-body` (17px), `text-small` (15px), `text-tiny` (12px, the
    calendar and charts only). `type.css` gives `<h1>` the title, `<h2>` the section, and `<h3>`
    (and below) the label, so headings need no size class, only margins. Same size means same
    element: pick the element by role, never for its look. Rich-text notes
    (`.slate-editor-editable`, `.rich-text-content`) are skipped and keep their own headings.
    Inputs, selects and buttons are body size, never smaller: iOS Safari zooms the page on focus
    below 16px. `text-sm`/`text-base`/`text-xs` and arbitrary sizes are off the scale; add a role
    rather than a one-off. **A page opens on its highest heading, never a lower one.** One title
    is an `<h1>`, as on a project or review page. Where a page opens on several peers (a view's
    columns, the done view's days), they're `<h2>`s and there's no `<h1>`. Columns under a group's
    name (home's "recurring") are a level down, `<h3>` labels, and so are the everything view's
    months, which are all it has. A title never repeats the header's view selector, which already
    names the view or world.
  - **Spacing is five steps, 4 · 8 · 16 · 32 · 64px** (Tailwind's 1, 2, 4, 8, 16), and nothing
    between. A kind of gap that recurs is a role token in `screen.css`, listed there with what it
    separates: `gap-icons`, `gap-rows`, `mb-heading`, `gap-controls`, `gap-lists`, `mb-title`,
    `gap-fields`, `gap-x-columns`, `gap-sections`, `mb-blocks`. Moving a role to another step
    moves it everywhere at once. A one-off takes a step directly. The header's 12px gaps predate
    the scale, as does padding inside boxes.
  - **Sweetheart's metrics are overridden so a line's box is its letters**: cap height to the
    lowercase descenders (`declarations` on the font in `app/layout.tsx`). Its size is therefore the
    height of its letters. Titles and sections space lines at `--heading-leading` (1.175, so G/Y tails
    clear the next line) and trim that back off their top and bottom with `::before`/`::after`
    margins in `type.css`. So a heading's edges sit on its letters, wrapped or not. One that sets
    its own line-height must use `leading-(--heading-leading)`. A flex heading breaks the trim,
    since the pseudo-elements become flex items.
  - **`screen.css` also holds** the `--transition-time` every animation uses (450ms), and two custom
    variants: `dim:` for the dark theme, and `touch:` for `(hover: none) and (pointer: coarse)`,
    which is how a control revealed on hover stays put on a phone.
  - **The sheets, and why each is a sheet:** `task-grid.css` (how many columns a view gets depends
    on which children actually rendered, which only `:has()` can ask), `review-calendar.css`
    (FullCalendar's DOM, event states, keyframes and view-transition rules), `SlateEditor.css` and
    `rich-text.css` (editor and rendered rich text), `print.css`, and `type.css`.
  - **They sit in `@layer utilities.legacy`**, declared in `screen.css`: above daisyUI's own
    sublayers, below Tailwind's utility classes. So a utility on an element beats them — which is
    why a default a utility would override (the task grid's single column) lives in the sheet
    rather than as a class. `SlateEditor.css` is imported by its component and is unlayered.
  - **Within a sheet, rank rules by order, not specificity: prod's CSS is not dev's.** `next build`
    minifies and `next dev` doesn't. Tailwind merges neighboring rules with the same declarations
    into one list, and Next's minifier (targets include Firefox 111, which lacks `:has()`) wraps a
    list holding `:has()` in `:is()`, which takes its most specific selector's specificity. That
    put one-section views in three columns on prod only; `task-grid.css` wraps its `:has()` counts
    in `:where()` for this. When prod and local look different, `next build` and diff
    `.next/static/chunks/*.css` against what commonnotebook.com serves.
  - **A class name with no CSS behind it is a hook, not a leftover.** `task-section`,
    `tasks-container`, `group-section`, `tasks-list`, `completed`, `worked-on` and the
    `layout-<slug>` names are read by browser specs, unit tests, or the `[.layout-done_&]:`
    variants; so are the review pages' `review-section`, `review-pick-list` and `is-selected`.
    `review-calendar`, `review-calendar-frame`, `is-arriving`, `is-leaving` and the `cal-*` event
    classes are what `review-calendar.css` hangs on. Renaming one breaks tests, not styling.
  - **Don't butt a bracketed class against `${` in a template literal.** Tailwind's scanner
    misses `` `text-[0.85rem]${x}` `` and silently generates nothing (a plain `mb-4` in the same spot
    is fine). Put the arbitrary class first, or a space after it.
  - **Deleting a sheet, or adding to an `@theme` block, needs `rm -rf .next/dev` and a dev-server
    restart** — and so does anything that swaps `screen.css` under a running server (a `git stash`
    round trip dropped the `text-h*` tokens until restart). Turbopack keeps serving the old CSS
    otherwise, which looks exactly like a change that didn't work.
- Editor: TipTap 3 (`@tiptap/*` all `^3.27.1`) + `@strapi/blocks-react-renderer`.
- Forms: react-hook-form 7 + zod 4. Charts: recharts 3. Icons: `@phosphor-icons/react`.
- Calendar: **FullCalendar 6** (`@fullcalendar/{core,react,timegrid,daygrid}`) renders the review grid;
  **`ical.js` 2** parses subscribed ICS feeds. Both are review-only — nothing in `(todo)/` touches them.
- Dates: **`temporal-polyfill`** (the TC39 Temporal API; Node/browsers don't ship it natively yet) — all
  zone- and calendar-aware date logic goes through it. `date-fns`/`date-fns-tz` were removed. Also
  `astronomy-engine` (moon-phase / solstice recurrence, and sunset in `lib/sunset.ts`).
- **Server state lives in TanStack Query** (`@tanstack/react-query` 5): `useQuery` for reads,
  `useMutation` + `invalidateQueries` for writes, optimistic `onMutate`/`onError` where a failure
  would otherwise leave the wrong thing on screen. Context is for **UI state only** (drawer,
  selection) and for values the server hands down as props (`DateTimeSettingsProvider`).
  *Migration in progress:* `useViews`/`useWorlds`/`useBetaAccess`, `practice/hooks/usePracticeLogs`,
  `hooks/useProjects`, `(todo)/hooks/useTasks` and `(todo)/hooks/useTaskLists` are query-backed; all of
  `(todo)/`'s reads and mutations now go through the cache. What remains is shrinking
  `(todo)/contexts/TaskDataContext.tsx` to `editingTask`/`editingProject` and pointing its five consumers
  at the hooks. New server state goes in the cache — don't add a fetching Context.
- **Related keys share a prefix so one invalidate covers them.** `['practice-logs','list',<type>]` and
  `['practice-logs','stats']` both sit under `['practice-logs']`, so stopping a session refreshes the
  list *and* the chart. Tasks mirror this: `['tasks','active']`, `['tasks','completed',<days>]`,
  `['tasks','upcoming']`, `['tasks','long-with-sessions',<days>]` and `['tasks','stats',<days>]` all sit
  under `['tasks']`, with `['projects']` a sibling root. Nest new keys the same way rather than
  invalidating several by hand.
- **A mutation that writes what an open editor is holding must not invalidate.** `saveNotes` in
  `usePracticeLogs` is the case: the notes editor is controlled local state, and a refetch would hand
  it the server's copy and drop whatever was typed since. Same reason `practice/page.tsx` seeds the
  editor only when the active session's `documentId` changes, not on every query result — queries
  refetch on window focus now, and re-seeding on each result would wipe in-progress text.
  The task-complete mutation is the same shape for a different reason: it invalidates the `['tasks']`
  root with a `predicate` that **excludes `['tasks','active']`**, because `/api/tasks` applies the
  completed-visibility window server-side. On an account whose `completedTaskVisibilityMinutes` is 0
  (Brendan's), a refetch would drop the row the user just ticked — it would vanish mid-click instead of
  fading, and un-completing it would be impossible. The optimistic write already holds the new state.
- **A local `setQueryData` must pin `updatedAt` when anything derives from the query's clock.**
  `setQueryData(key, updater)` stamps the cache with the current time by default. `useTasks` filters on
  `tasksQuery.dataUpdatedAt` — "when the server last told us this" — so an unpinned local write drags
  that clock to the moment of the write, and a task completed at that instant is instantly older than a
  0-minute visibility window. The row vanished on click, and only when Strapi's `completedAt` happened
  to land a few ms *behind* the browser's clock, which made it fail about one run in three. Only a real
  fetch may advance `now`: see `withPinnedTimestamp` in `useTasks.ts`.
- Tests: Vitest 4 + jsdom + Testing Library; co-located as `*.test.ts(x)` siblings next to the
  code under test. No Prettier config.
- **E2E: Playwright, `frontend/e2e/*.spec.ts`, `npm run test:e2e`** (local only; not CI-gated). It
  exists because the app is client-rendered — SSR returns `loading...`, so curl and unit tests cannot
  prove the UI works, and that is how a `projectType` bug survived 434 green unit tests. Vitest's
  `include` is scoped to `app/**` precisely so it does not swallow these specs. The config starts Strapi
  (with `EMAIL_ENABLED=false`) and **`next dev`** — never `next start`, which sets
  `NODE_ENV=production` and kills `DEV_AUTH_BYPASS`. Specs run against `DEV_AUTH_USER`'s real local data,
  so each creates its own `[e2e] <timestamp>` rows and deletes them; they cannot assert on fixed
  fixtures. See `e2e/helpers.ts` for the shared setup and the waits.

## Layout (`frontend/app/`)
- `(main)/` — authed route group (`layout.tsx`). Features: `(todo)/`, `review/`, `practice/`. `(todo)/` is a route group, so its
  layout (task data plus the task actions drawer) covers home (`/`, the default view), `/view/<slug>`,
  `/world/<slug>` and `/project/<slug>` with no "todo" in the address. The old `/todo/...` addresses
  are gone, not redirected. `app/lib/pages.ts`'s
  `isTodoPath` is the one test for "on a to-do route"; `components/chrome/PageIcon.tsx` gives each page the icon its
  menu link and the header's upper-left icon share.
  **Where a file lives says who uses it.** Each feature colocates its own `components/`, `hooks/`,
  `contexts/`, `utils/`, including pieces other places mount or import: the header's to-do controls
  import from `(todo)/`, and the layout mounts `practice/components/PracticeSessionModal` because it
  covers every page. Only what two or more features share goes in the top-level folders:
  `components/ui/` (building blocks: `Button`, `FormControls`, `Drawer`, the rich-text editor,
  `RecurrencePicker`, …), `components/chrome/` (header, menu, guards, theme toggle),
  `components/settings/` (the settings panel and its parts), `components/auth/`, `components/charts/`,
  and `hooks/`, `contexts/` for the cross-feature ones (date/time settings, the practice session's
  open/dismiss state, beta access, projects, location, review cadence, theme).
  `(todo)/components/layouts/` holds
  the per-layout components + `types.ts`; `review/` holds `periodic/` and `daily/` pages plus
  `WeekCalendar`/`TaskPickList` and the `useReview`/`useDailyPick`/`useCalendarEvents` hooks.
  Settings is a panel inside the menu drawer, not a page (`components/settings/SettingsPanel.tsx`).
- `api/` — Next.js route handlers acting as a BFF/proxy to Strapi (`tasks/`, `projects/`, `views/`,
  `worlds/`, `reviews/`, `daily-picks/`, `calendars/`, `practice-logs/`, `system-settings/`, `auth/`, …).
- `lib/` — pure, unit-tested business logic. Core files: `layoutTransformers.ts` (the task-grouping
  engine), `groupTasks.ts`, `views.ts`/`worlds.ts` (resolve a stored View/World selection to a
  `LayoutRuleset`), `projectPriority.ts`, `recurrence*.ts`, `dateUtils.ts`, `moonPhase*.ts`,
  `dayBoundary*.ts`, `reviewCadence.ts`/`reviewCycle.ts`/`reviewLists.ts`, `sunset.ts`/`location.ts`,
  and `ics/` (`trimIcs` → `expandIcs` → `resolveDecisions`).
- `components/` — shared UI. `contexts/` — `DateTimeSettingsContext`, `TaskActionsContext`,
  `StuffProjectsContext`, `PracticeContext` (**all UI-state or server-provided props; no fetching
  Contexts** — `LayoutRulesetContext` and `TimezoneContext` are gone). `hooks/` — global hooks.
  `types/index.ts` — central domain types.

## Backend communication
Browser never calls Strapi directly. Flow: browser → Next `app/api/*` handler → `getAccessToken(req)`
(`app/lib/strapiAuth.ts`) → `fetch()` to `${STRAPI_API_URL}/api/...` with `Authorization: Bearer <token>`.
API handlers return `{ success: boolean, ... }`.

**Auth is session-based, not a bare JWT.** Strapi runs `jwtManagement: 'refresh'`, so there are two
httpOnly cookies: `auth_token` (access, 30 min) and `refresh_token` (a year, backed by a row in
`strapi_sessions`). Never read `auth_token` directly in a handler — call `getAccessToken(req)`, or
`getCaller(req)` where the handler needs to know *who* is calling. Both verify the access token and
refresh it proactively within 60s of expiry, re-setting both cookies. Logging out calls Strapi
`/auth/logout` with `scope: 'all'`, which is what makes revocation real.

**Nothing trusts a cookie it hasn't verified.** Strapi signs both tokens HS256 with `JWT_SECRET`, and the
frontend holds the *same* secret (`frontend/.env`), so it checks the access token's signature and expiry
itself (`verifyAccessToken`, jose) with no Strapi call. When that fails, Strapi is asked to refresh, which
checks the session row; a refusal ends the session and clears the cookies. Never decode a token's claims
without verifying it — until 2026-09-23 `shows-tasks` did, and a hand-made cookie got the show history.
- `frontend/proxy.ts` gates every page on a verified, live session: a good access token passes with no
  network call; otherwise it refreshes, handing the new cookies to the browser *and* to the same
  request's render; otherwise `/login` with both cookies cleared. At most one Strapi round-trip per browser
  per 30 minutes, the one the first API call used to make — Brendan's requirement: auth must never cost
  noticeable load time. A logout elsewhere reaches a browser when its access token next needs renewing.
- Neither failure is a logout, so neither clears cookies or redirects: Strapi unreachable for a refresh
  is a 503 (`SessionUnavailableError`), and a token the frontend can't verify at all — `JWT_SECRET` unset,
  or not the backend's — is a 500 (`AuthConfigError`) with a log line saying which. A redirect there would
  loop, since every login would fail the same way. Login, reset and invite redemption check the token
  Strapi just issued (`issuedTokenVerifies`) before setting it.
- On the client, any 401 from `app/api/*` ends the session: `QueryProvider` clears the cache and goes to
  `/login`, once, and never retries a 401.

# Backend

Strapi `5.50.2`, TypeScript. Scripts: `npm run develop` / `build` / `start` / `deploy`.
DB via `DATABASE_CLIENT` (mysql | postgres | sqlite), **defaults to SQLite** locally
(`backend/config/database.ts`). Media uploads go to AWS S3.

Content types under `backend/src/api/*/content-types/*/schema.json`: `task`, `project`, `world`, `view`,
`review`, `daily-pick`, `calendar-subscription`, `calendar-event-decision`, `practice-log` (with a
`material` relation to `task` and a `segments` JSON column),
`system-setting`, `invite`. Strapi 5 style — `documentId` is the stable identifier used throughout the
frontend. Every one of them except `invite` carries a `private` `owner` relation and is registered for
the ownership middleware (`backend/src/ownership/`); `invite` has no owner, and only the scoped invite
token can reach it. Node engine constraint: `>=18 <=22.x`.

**The ownership middleware also checks every row a write links to.** Strapi resolves relation targets,
and populates them, with no owner filter, so a link to someone else's row would cross tenants and hand
that row back in the response. `relations.ts` reads the relation shapes Strapi 5 accepts and rejects
any other; a foreign or missing target is a 404, like a foreign row. `disconnect` is never checked: it
only unlinks. `scripts/audit-cross-owner-links.js` lists any link that crosses owners (read-only).

**Auth and ownership go only through Strapi's documented extension points** — the document-service
middleware, `strapi.db.query`, `strapi.getModel`, config — never a patch or an override of its built-in
controllers or plugin schemas. Brendan's rule: updating Strapi's package must not break our code. Where
we lean on Strapi's behavior, fail closed and loudly. **After every Strapi upgrade**, run
`npm run test:run` in both apps and `scripts/verify-isolation.sh` against a running Strapi
(`relations.test.ts` also runs Strapi's own relation parser, so a changed parser fails there first).

**Never edit a `schema.json` by hand to change a content type** — add fields and enum values through the
Strapi Admin UI (see the standing note in Brendan's memory). Editing the file skips the migration Strapi
runs on save and leaves the DB and the schema disagreeing.

# Domain model (task app)

- **World** — a top-level bucket a project belongs to (`day job`, `life stuff`, `make music`, `stuff`, …).
  A **per-user row** of `api::world.world`, *not* a hardcoded enum — users add/rename/reorder their own.
  Reached from a task via its project (`task.project.world`, normalized from Strapi's `worldRef` by the
  projects BFF).
  **`systemKey` is what makes a world special, and it also hides it.** `resolveVisibleWorldIds`
  (`app/lib/worlds.ts`) excludes *any* world with a `systemKey` from `worldMode: 'all'` and `'except'` — a
  system world surfaces only when a section names it under `'only'`. Today that's just `stuff`, and it's
  the mechanism for "a world that shouldn't compete with everything else in ordinary views".
- **Importance** — project tier: `top of mind`, `normal`, `later`. World views order projects
  top-of-mind → priority (`pN` title marker) → normal → later, creation-date within each. **One project
  at a time is top-of-mind**, enforced server-side on write by `demoteTopOfMindProjects` — a convention,
  not a DB constraint, so readers take the first rather than assuming exactly one.
- **Project type** — a project's `projectType` (`app/types/index.ts`): `default`, `chores`, `instrument`
  and `study` (the practice subjects), plus the four
  `STUFF_PROJECT_TYPES` (`wishlist`, `errands`, `in the mail`, `buy stuff`) that live in the `stuff` world
  and are gated by the `enableStuffProjects` setting (`app/lib/stuffProjectsConfig.ts`). This **replaced the
  old per-task `category` enum** — see `backend/scripts/migrate-categories-to-projects.js`. That config
  file is the template for "extra fields whose options depend on the project's type": one flat enum in
  Strapi, a frontend map of which values are offered where.
- **View / ruleset** — a view is a **per-user row** of `api::view.view` (`LAYOUT_PRESETS` is gone),
  composed from a fixed menu of layout engines (`projects` | `chronological` | `roulette`) plus ordered
  `sections`, each a filter set (`worldMode`/`worlds`/`importance`/`projectType`/`recurrence`/`longOnly`).
  Routed as `/` (the default view), `/view/<slug>` and `/world/<slug>`; `viewToRuleset` (`app/lib/views.ts`) reduces a
  View to the runtime `LayoutRuleset` consumed by `transformLayout` (`app/lib/layoutTransformers.ts`) →
  `LayoutRenderer` → a per-layout component. Two `CODE_PRESETS` (`done`, `recurring`) take a bespoke
  branch via `codePreset`.
- **Incidentals** — tasks with no project. `worldMode: 'all'` and `'except'` surface them; only `'only'` hides them (an incidental has no world for an except-list to name).
- **Task flags worth knowing** — `soon` (a one-off you've flagged for this cycle), `long` (a task worked
  at over days rather than finished in one go), `onHold` (practice material set aside — neither finished
  nor due), `materialCategory` (free text on material: scales, arpeggios…), and `workSessions`, a JSON
  array of `{date, timestamp}`
  recording "worked on today without completing". `transformDone` synthesises a virtual "worked on" entry
  per session date, which is how the Done view shows progress on something not yet finished.
  `workSessions` is a **JSON column**, so it can't be filtered server-side and rides along on every read
  of the task — fine for a ~30-entry flag, wrong for anything you want to aggregate or chart.

# Domain model (review)

The review is a **planning surface**, and it is opinionated in ways the code comments defend at length —
read `app/lib/reviewLists.ts` before changing what appears there. In short: no dates, no ordering by how
overdue something is, no carry-over from last cycle, no scoring. "If a task has no due date then it has
no due date, and ranking by how overdue something is turns a planning tool into a productivity tool."

- **Cadence** — how often the review comes round, stored as **one JSON `system-setting` row**
  (`reviewCadence`), parsed by `app/lib/reviewCadence.ts`. It is a `RecurrenceRule` — the same pattern
  language tasks speak — plus an `anchorDate` that only `biweekly` needs (nothing completes a cadence, so
  there's no occurrence to infer phase from). `parseReviewCadence` never throws; `cadenceIsUsable` is what
  the settings UI checks so an unusable cadence can't be saved into silence.
- **Period** — `computeReviewPeriod` (`app/lib/reviewCycle.ts`) turns a cadence into an inclusive
  `periodStart`/`periodEnd`, in one of two modes: `upcoming` (the next whole cycle — Sunday-night planning)
  or `remainder` (today through the end of this one). It **delegates to `calculateNextRecurrence`** rather
  than having its own opinion about last-Fridays and new moons; keep it that way.
- **Review** (`api::review.review`) — a `periodStart`/`periodEnd`/`cycleType`/`anchorDate` plus a `tasks`
  relation: the handful you committed to for the cycle. Written **per pick**, not on a submit.
- **Daily pick** (`api::daily-pick.daily-pick`) — a `date` plus a `tasks` relation, narrowing the review's
  selection to today. `/review/daily` is **the only surface in the feature where a task can be completed**;
  everything else is picking, deciding and looking.
- **The pool** — `buildReviewLists` gathers three things and dedupes them: the top-of-mind project's
  tasks, one-offs flagged `soon`, and recurring tasks **showing today** (`isRecurringVisibleToday`, the rule every
  task list uses — something whose date already passed is still on your plate). `partitionSelected` splits the
  grouped pool into picked/remaining; both pages render the same shape.
  **Practice material is split off first**, into `practiceGroups`, so it can never be claimed by both
  lanes — it would otherwise qualify as a `soon` one-off and appear in both steps.
- **Calendars** — `calendar-subscription` (an ICS URL + colour + `defaultState`) and
  `calendar-event-decision` (per-`uid`, optionally per-`recurrenceId`). The chain is
  `trimIcs` (line-scan away the ~93% of a feed that can't be in the window, *before* parsing) →
  `expandIcs` (ical.js) → `resolveDecisions`, which resolves state through
  **instance override → series default → calendar default → unset**. The series tier is the point:
  per-instance-only means re-deciding the same standup every week. `unset` is a real state, so
  "nothing unset" is a definition of done that falls out of the data model.

# Domain model (practice and study)

Practice runs on the **same substrate as tasks**, not beside it:

```
world  "practice and study"   (systemKey: practice)
 └─ subject   = project       (projectType: instrument | study)
     └─ material = task       (+ materialCategory, onHold)
         └─ session = practice-log row
```

The `PRACTICE_SYSTEM_KEY` (`app/lib/worlds.ts`) is load-bearing twice over: it keeps material out of
everyday to-do views (`resolveVisibleWorldIds` excludes any system world from `all`/`except`, so
material is reachable only through a view that names the world), and it is how `isPracticeMaterial`
(`app/lib/reviewLists.ts`) tells the two review lanes apart. **Match on the world, never on
`projectType` or a flag** — moving a project into practice-and-study brings its material with it.

There was a `PracticeType` enum: six strings in the Strapi schema, `app/types`, a header dropdown and
the stats route, which made adding a seventh instrument a four-file edit. It is gone, along with
`PracticeSelector` and `PracticeContext`. Subjects are data; the chart discovers its series from the
sessions themselves.

**Narrowing is the same three stages tasks use** — shelf → rotation (`soon`) → this cycle (the periodic
review's practice step) → today (the daily page's practice lane). The practice pool is simply "`soon`,
not completed, not `onHold`": no recurrence test and no showing-today filter, because material
has no cadence. `onHold` is the state between "working on it" and "done with it" — scales are never
complete, but a scale exercise can be put down for a month.

**One selection, two lanes.** The practice step writes to the same `review.tasks` / `daily-pick.tasks`
relation as everything else; only the presentation splits. There is no schema change for the lane, and
nothing extra for the daily page to read.

## Sessions

`practice-log` is `{start, stop, duration, date, notes, material, segments}`.

- **`segments`** (`app/lib/practiceSession.ts`) is `[{start, stop|null}]` — the stretches actually
  practised. `duration` is their **sum**, not `stop - start`: a 40-minute sitting with 15 minutes of
  pause is 25 minutes practised. Only the last segment may be open; `parseSegments` normalises anything
  else, because it is a JSON column that can hold whatever a half-written request left behind.
  This is the one place a JSON blob is right: scratch state on the session's own row, never queried
  across rows, collapsed to an integer on stop.
- **`date`** is the **effective day of the session's start** (`getEffectiveDayForTimestamp`), so a
  session begun at 1am under a 4am boundary belongs to the previous day and one that runs past the
  boundary is filed under the day it began.
- **Writes are intent endpoints**, never a client-supplied array: `POST /api/practice-logs` (start),
  and `/pause`, `/resume`, `/stop`, `/correct` on `[documentId]`. Each does its read-modify-write
  server-side under `withSessionLock` (`app/lib/practiceSessionServer.ts`) — chained, not shared, unlike
  the moon-phase mutex, because the callers want different things done rather than the same thing once.
- **Every intent is idempotent, and that is load-bearing.** A session is shared between devices (start
  on the phone, stop on the laptop), so a stale client must only ever be able to re-assert something
  already true. Pause-when-paused does not move the recorded stop; stop-when-stopped does not rewrite
  it; resume-when-running writes nothing. A finished session **refuses to reopen** — `stop` is the one
  irreversible step.
- **One open session at a time, globally.** `GET /api/practice-logs/active` answers "is anything
  running?" without a material in scope, which the old per-type query could not — and which is why two
  sessions on different types used to be able to run at once. A second start returns 409 with the open
  one.
- **There is no heartbeat, deliberately.** It would measure *tab open*, not practising — leave the page
  up while you make coffee and it reports practice with total confidence. Instead the modal offers a
  correction ("call it 30/60/90/120 minutes") once a session has run over four hours or crossed the day
  boundary (`isStale`). `/correct` is the only place a duration comes from the client. It keeps the
  segments as evidence rather than rewriting them to match.

## The practice screen is a modal, not a page

`PracticeSessionModal` is mounted in `(main)/layout.tsx`, so a running session covers the header, the
menu and whatever page is open. Two reasons, both worth keeping: practising is the one thing here that
isn't reading or deciding, and — with no heartbeat — being unable to use the app is what stops a session
dangling. **Pause is the only way out of full screen**; there is deliberately no "hide but keep running",
and `PracticeSessionModal.test.tsx` asserts the absence.

`/practice` is now the read-only *record* — the 30-day chart plus sessions grouped by day. Nothing starts
a session from there: you press play on a piece of material, which lives on the to-do list and the review pages.
`PracticeSessionContext` holds only which material the modal is *offering* (UI state); the session itself
is server state via `useActiveSession`, which polls every 30s **only while something is running**.

# Conventions

- **Feature-colocation:** feature code under its route folder; shared code in top-level
  `app/{components,lib,hooks,contexts}`.
- **Custom hooks own data domains** — e.g. `(todo)/hooks/useTasks.ts` owns active tasks (flat array +
  manual-project overlay + memoized groupings) and centralizes all mutations
  (`addTask/updateTask/updateProject/refetch/…`).
- **Configurable task views** are data-driven by `LayoutRuleset` (`groupBy`/`sortBy`/`visibleWorlds`/
  `visibleProjects`) — presets in `layoutPresets.ts`, applied in `layoutTransformers.ts`.
  World views order projects by tier: top-of-mind → priority (`pN` title marker, see
  `projectPriority.ts`) → normal → later, sorted by creation date within each tier.
- **Date logic takes `TimeZoneSettings`, never reads it ambiently.** `{ timezone, dayBoundaryHour }`
  (`app/lib/timeZoneSettings.ts`) is threaded as a parameter into `getToday`/`parseDate`/
  `toISODate`/`formatInTimezone`/`getTodayForRecurrence` (`app/lib/dateUtils.ts`) and on into
  `recurrence.ts`, `layoutTransformers.ts`, `groupTasks.ts`, `dayBoundaryHelpers.ts`. Server code
  resolves it **per request** from the caller's token via `getTimeZoneSettings(token)`
  (`app/lib/strapiServer.ts`); client code reads `useDateTimeSettings().timeZoneSettings`, which
  `(main)/layout.tsx` fills server-side so the first paint is already in the user's zone. Defaults for
  every setting live in exactly one table, `app/lib/defaultSettings.ts` (EST, 4am boundary) — currently
  `timezone`, `dayBoundaryHour`, `completedTaskVisibilityMinutes`, `autoDeclutter`, `enableStuffProjects`,
  `reviewCadence`, `location`. Rows are per-user and a new account may have none, so that table is also
  what *readers* fall back to; seeding only makes a setting visible in the settings drawer.
  **`TimeZoneSettings` is a function parameter, not a settings bag** — its membership is decided by
  what the pure date math reads, not by what sounds time-related. `completedTaskVisibilityMinutes` is
  time-ish but sits *beside* it on `DateTimeSettingsProvider`, because no date function reads it (only
  `useTasks`, filtering a list) and no server route needs it; folding it in would hand a visibility
  duration to `getTodayForRecurrence` and make ~12 test literals invent a value that cannot affect
  their assertion.
  **Never add a module-level cache for a setting.** Two modules each caching `dayBoundaryHour` with
  different defaults is why the server computed every date in EST at midnight regardless of the user's
  setting, and why completing a recurring task wrote a date the form never predicted. The same shape
  hid just-completed tasks on the first load of the to-do list until you visited /settings. A cache also cannot
  be primed on the server (no localStorage, no mount effect) and, if it were, would leak one user's
  settings to the next request. There are no `NEXT_PUBLIC_*` overrides for these: settings are
  per-user rows, so a build-time env var would override every user at once. Keep date logic pure and
  unit-tested.
- **A `Date` in this codebase is always a real instant; all zone/calendar work goes through Temporal.**
  Wall-clock values live only as ISO strings (`toISODate`/`shiftISODate`/`isoDayDiff`, all in
  `dateUtils.ts`) or as an hour number — never as a `Date`. Zone-aware reads use
  `Temporal.ZonedDateTime` (via `temporal-polyfill`), which names its timezone explicitly and exposes the
  wall clock as plain integer fields (`.hour`, `.day`, `.offset`), so the old footgun **cannot be
  expressed**: `date-fns-tz`'s `toZonedTime` returned a `Date` whose epoch was deliberately shifted so its
  *local* getters read the zone, and reading it with the wrong getter (or zoning it twice) silently
  returned a plausible wrong answer. `date-fns` and `date-fns-tz` are **gone from the codebase**; `getNow`
  is deleted. A **CI-gated architecture test**, `app/lib/dateArchitecture.test.ts`, enforces this: no
  source file may import `date-fns` or `date-fns-tz`, the `toZonedTime`/`fromZonedTime`/`getNow`
  identifiers may not reappear, and no `getUTC*` getter may be read anywhere. The whole class was
  invisible on a machine whose OS zone equals the user's setting (Brendan's laptop) while CI ran only UTC —
  so **the vitest suite runs a `TZ` matrix** (`UTC`, `America/New_York`, `Asia/Kolkata`;
  `npm run test:zones`, and the CI job's `strategy.matrix.tz`) and Playwright pins
  `timezoneId: 'America/New_York'`, deliberately unequal to the UTC server. Historic instances
  (2026-07-16/17, all fixed): `useTasks` fed a zoned `now` into elapsed-minute math;
  `getEffectiveDayForTimestamp` read `getUTCHours()` off a zoned Date, putting the 4am boundary at 9am for
  non-UTC users; and the Done page, the upcoming panel, practice-session day attribution, and full/new-moon
  recurrences all did calendar arithmetic on instants. `getEffectiveDayForTimestamp`/`getWorkedOnPhase` and
  `toISODate` take a **real instant** and convert internally — never hand them an already-zoned value.
  **Any test for this must run in more than one system zone** and must not stub `dateUtils`'
  `parseDate`/`toISODate`/`formatInTimezone` — see the Gotchas note below.
- **Calendar arithmetic runs on the user's wall clock, never on an instant — via `Temporal.PlainDate`.**
  The dates flowing through `recurrence.ts` are real instants (`parseDate('2026-01-13', EST)` is 05:00Z),
  so calendar math on them must first land on the user's *calendar day*: `toPlainDate(instant, settings)`
  (see the header comment there) turns an instant into a `Temporal.PlainDate`, and every step is then
  plain-date arithmetic (`.add({months: 1})`, `.with({day})`, `.dayOfWeek`) — calendar-correct and
  DST-free by construction — read back out with `.toString()`. This replaced a `date-fns` implementation
  whose helpers (`setDate`, `nextDay`, `addWeeks`, `getDay`, `lastDayOfMonth`…) read a Date's **machine-local**
  components: on a UTC server with an EST user the 2nd Tuesday of February came out `2026-02-10T00:00Z`
  (which *is* Feb 9 in New York), so **every monthly and annual recurrence was scheduled a day early in
  production** while being perfect on a laptop whose zone matched the setting. Astronomy calls
  (`Astronomy.Seasons`, `SearchMoonPhase`) are the exception and keep the real instant — a wall-clock value
  would move the event itself. Nothing pins `TZ` for the Next server, and `calculateNextRecurrence` runs
  there (`/api/tasks/[id]/complete` and `/skip`): **prod is UTC and Brendan's laptop is not**, which is
  exactly how this class of bug reaches production unseen.
- **An element that moves between two containers is animated with a view transition, and it needs
  `flushSync`.** `document.startViewTransition` snapshots the page, runs its callback, and snapshots
  again — so the DOM must be updated *inside* it, and React's normal batching would defer the re-render
  past the second snapshot and animate nothing. Always go through `canViewTransition()`
  (`app/lib/viewTransition.ts`), which also honours `prefers-reduced-motion` and Firefox's lack of
  support; `prefersReducedMotion()` is exported separately because a plain fade needs that check and not
  the support one. **Do the network write outside the transition** — holding the second snapshot open
  until the server answers freezes the page mid-morph.
  Two things a view transition can't do, both already solved in `review/`: it dies if a *second*
  asynchronous DOM change removes named elements partway through (hence `useCycleSlide`, a CSS slide), and
  it can't animate a removal that must complete before the element goes (hence `leaveThenUpdate`).
  `--transition-time` in `screen.css` is the single answer to "how fast does anything move"; read it from
  the document via `transitionMs()` rather than duplicating the number in JS.
- Naming: PascalCase components, camelCase lib/util files, `use*` hooks, `*.test.ts(x)` siblings for tests.

# Gotchas
- Run tests with `npm run test:run` (one-shot) — plain `npm test` is Vitest **watch mode** and will
  hang a non-interactive run. Single file: `npx vitest run <path>`.
- CI runs `npm run build` (both apps) + `npm run test:run` (both apps). **Lint and `tsc` are not
  CI-gated.** `npm run lint` (`eslint .`) reports ~168 pre-existing findings and `tsc --noEmit` has
  pre-existing errors in some test files — don't chase these as if new; scope checks to files you touched.
- **Never call `fetch` from a query/mutation function — use `apiFetch`/`apiSend` (`app/lib/apiFetch.ts`).**
  `fetch` resolves on a 401 and the handlers answer `{success:false}`, so a raw `fetch` in a `queryFn`
  turns every failure into a *successful* query holding `undefined` — an empty list where an error
  belongs, silently. `apiFetch` throws on both shapes. `swallow()` is there because the pre-TanStack
  callers didn't try/catch; a screen with real error UI should read `useMutation`'s `error` instead.
  `LogoutButton` must keep calling `queryClient.clear()` — the cache is keyed by URL, not by user.
- Tests co-locate as `*.test.ts(x)` siblings next to their subject. Date-dependent suites pass a
  `TimeZoneSettings` literal rather than mocking config modules. **A date suite may mock only the clock**
  — `vi.setSystemTime`, or `getToday`/`getTodayForRecurrence` via `vi.fn()` — and must leave
  `parseDate`/`toISODate`/`formatInTimezone` real. The `layoutTransformers.*`/`recurrence-routes` suites
  that `vi.mock('./dateUtils')` now spread `...vi.importActual('./dateUtils')` and override only the clock
  functions; seed a mocked `getToday` with the *real* `parseDate('…', EST)`, never a bare
  `new Date('…T00:00:00')` literal (which means whatever zone the machine is in).
  **`vi.mock('./dateUtils')` is not scoped to the file under test:** `dayBoundaryHelpers.ts` imports from
  `./dateUtils`, so mocking it silently rewires `dayBoundaryHelpers`/`layoutTransformers`/`groupTasks`/
  `recurrence`/`moonPhase` too — which is how a stubbed `toISODate` reached `transformDone` and shipped
  the Done bug. That is why the stubs are gone.
  `app/lib/dayBoundaryHelpers.test.ts` is the cautionary tale: it once mocked `toZonedTime` as the
  identity function and `toISODate` as a reader of UTC components, true only when the timezone *and* the
  machine are UTC — so it hard-coded the bug into the fixture and passed for months while the day boundary
  sat five hours off. It is now unmocked, and **a timezone-sensitive suite must be run in more than one
  system zone** (`TZ=UTC`, `TZ=America/New_York`, and a half-hour offset like `TZ=Asia/Kolkata`;
  `npm run test:zones`) — a green run on one zone proves nothing. `app/lib/dateUtils.test.ts` asserts the
  `parseDate`↔`toISODate` round-trip across zones (it had **zero** assertions before), and
  `app/lib/dateArchitecture.test.ts` is the CI-gated guard that keeps the stubs and `toZonedTime` from
  creeping back.
  Components/hooks reading `useDateTimeSettings()` need a `DateTimeSettingsProvider` wrapper in tests;
  pass `initial` so the provider doesn't fetch (see `app/(main)/(todo)/hooks/useTasks.test.ts`).
  Query-backed hooks need a `QueryClientProvider` wrapper with a **per-test client** and
  **`retry: false`** — the app default of 1 makes every failure case sit through a backoff before the
  assertion runs (see `app/(main)/(todo)/hooks/useWorlds.test.ts`). Component tests that only care about a hook's
  *output* should `vi.mock` the hook instead (see `app/components/chrome/HeaderContent.test.tsx`); there is
  no global fetch mock, so an unmocked query in a component test hits a real relative URL.
  **A cache write is not visible to `result.current` when `act()` returns.** TanStack notifies observers
  on a microtask, so `act(() => result.current.addTask(t))` followed by a bare `expect` reads the *old*
  render — where the pre-query `setState` version flushed synchronously. Assert with `await waitFor(...)`
  after any mutator; an `await act(async ...)` alone is not enough.
- **A failing request in a browser is not one thing.** An aborted request rejects; a 500 *resolves*.
  Code guarded by `if (!response.ok) return` therefore does nothing on a 500 while an abort still lands
  in `catch`, so a Playwright test using `route.abort()` can pass against code that mishandles a real
  server error. Use `route.fulfill({ status: 500 })` to test a rejected write, and `route.abort()` only
  where a network failure is the actual case (see `e2e/task-lifecycle.spec.ts` vs `e2e/view-reorder.spec.ts`).
- **Everything runs Node 25 / npm 11** — prod, local, and all four CI jobs — even though
  `backend/package.json` still declares `engines: >=18 <=22.x` (harmless `EBADENGINE` warnings).
  Don't "fix" a CI job back to Node 22: Node 22 ships npm 10, which rejects an npm 11 lockfile with
  `Missing: yaml@2.9.0 from lock file` (npm 11 omits optional peer deps such as `vite`'s `yaml`).
- **`npm install` will not catch a broken lockfile; only `npm ci` will.** After changing backend deps,
  run `npm ci --dry-run` before pushing — that's the exact check CI performs.
- **Strapi silently clamps `pagination[pageSize]` to `maxLimit: 100`** (`backend/config/api.ts`), and
  applies `defaultLimit: 25` when you pass none. A handler asking for `pageSize=1000` gets 100 rows and
  no error — that shipped wrong practice stats and a project-demotion bug. Never hand-roll a Strapi list
  fetch: use `fetchAllPages()` from `app/lib/strapiServer.ts`, which pages properly and throws instead of
  truncating. Filter server-side (`filters[...]`), never in JS over a partial page.
- **`projectType`'s ordinary value is `default`; `importance`'s is `normal`. Don't mix them up.**
  Fixed 2026-07-16 — until then `ProjectType` and `ProjectForm` used `'normal'` for *both*, so every
  save of an ordinary project sent `projectType: 'normal'`, which Strapi's enum
  (`['default','chores','wishlist','errands','in the mail','buy stuff']`) rejects with
  `400 projectType must be one of the following values: default, …`. It went unnoticed for so long
  because `handleProjectFormSubmit` closes the drawer *before* awaiting and had no `else` on
  `if (response.ok)`: the edit looked saved and wasn't.
  **Most rows store `null`, not `'default'`** — both mean "ordinary", and `getTaskProjectType` returns
  null for them. Nothing backfills; a project picks up `'default'` only when someone saves it. Treat
  `null` and `'default'` as the same thing, and never reintroduce a third spelling.
  A rejected save is still only logged, not shown — surfacing it needs the drawer to stay open until
  the request resolves.
- **Two separate rules reject fields in a content-API request body**, both with the same unhelpful
  `400 ValidationError: Invalid key <field>`:
  1. `throw-private.js` — the attribute is `private: true`.
  2. `throw-restricted-relations.js` — the attribute is *any relation*, and the caller lacks
     `<target>.find` on the relation's target.

  `task.owner` trips both (it's private *and* points at the user model), which is why a client can never
  choose its own owner. `invite.usedBy` trips only the second: writing it requires granting the invite
  token `plugin::users-permissions.user.find`, which also lets that token list every user's email.
  When a relation is mysteriously "invalid", check the caller's `find` permission on the *target* before
  suspecting `private`. A write that is mysteriously a **404** on a row the caller does own is the
  ownership middleware refusing a relation *target*: one of the rows it links to isn't theirs, or doesn't
  exist (`backend/src/ownership/relations.ts`).
- **Strapi has no compare-and-set.** Anything read-then-write (invite redemption, the moon-phase reset)
  needs an in-process guard keyed by the thing being mutated. Correct on the single-process droplet; the
  same caveat as `app/api/auth/rate-limiter.ts`. This is also the argument against appending to a JSON
  column (`task.workSessions`) for anything written often: an append is a read-modify-write and two of
  them race, where a row insert cannot.
- **A page that writes on every click must serialize its saves and seed its state exactly once.** Both
  review pages hit this: picks are individual writes, so `saveQueue` chains them (two overlapping writes
  are a lost update at best, a create racing a create at worst) and `reviewId` is a **ref**, because the
  query cannot keep up with clicking. Seeding the selection is guarded by a `seededFor` key rather than a
  dependency list — the query refetches after every save, and re-seeding from it would overwrite a pick
  made while the save was in flight.
- **`.env` is only loaded once `createStrapi()` runs.** A script reading `process.env` *before* booting
  Strapi sees nothing from the file — which silently broke `seed-dev.js`'s "refuse unless local SQLite"
  guard on prod (`DATABASE_CLIENT` read as `undefined`, defaulted to `sqlite`) and made `test-email.js`
  warn about an `EMAIL_ENABLED` that was in fact set. Any script inspecting env before boot must
  `require('dotenv').config({ path: process.env.ENV_PATH || path.resolve(__dirname, '..', '.env') })`
  first. dotenv never overwrites an existing variable, so shell overrides still win.
- **A script that boots Strapi needs the running backend stopped.** SQLite allows one writer, so
  `strapi develop` holding the file makes any `createStrapi()` script die with `SQLITE_BUSY` partway
  through — after some of its writes have landed. Stop the backend, run the script, start it again.
  `scripts/sample-practice.js` is the one to reach for when a local database has nothing to look at:
  it writes a month of practice across three subjects, tagged `[sample]`, and `--reset` removes them.
  Note that a project's world relation is **`worldRef`** (`world` is what the app's own API calls it);
  passing the wrong name sets nothing and leaves projects in no world at all.
- **Imported datetimes in the local SQLite copy are text; Strapi's are epoch-ms integers.** Strapi
  on SQLite writes and filters datetimes as integers, and SQLite sorts any text above any integer,
  so a `$gte` filter on an imported text column matches every row (the done view's "recently" charts
  counted every task ever completed). `tasks.completed_at` was converted 2026-09-18 with
  `cast(round((julianday(col) - 2440587.5)*86400000) as integer)`; other datetime columns
  (`created_at`, `updated_at`, other tables) are still text. Suspect this before the code when a date
  filter over-includes locally. A write to the file directly with `sqlite3` works while the backend runs.
- **Email sending is opt-in, via `EMAIL_ENABLED=true`.** `backend/.env` holds the *production* SMTP
  credentials, and any local boot — `strapi develop`, a forgotten `strapi start`, a script — picks them up;
  that has already sent real password-reset mail to a seed address by accident. `config/plugins.ts`
  therefore installs a nodemailer `jsonTransport` **sink** unless `EMAIL_ENABLED=true` (defaulting to
  `NODE_ENV === 'production'`). **`strapi start` does not set `NODE_ENV`** — Strapi reports
  `development` — so production must set `EMAIL_ENABLED=true` explicitly. `bootstrap()` logs the chosen
  transport at every boot; look for `[email] transport:`.
  Do not "fix" a sink by falling back to Strapi's default `sendmail` provider: it calls `sendDirectSmtp`
  and delivers straight to the recipient's MX, so any machine can put mail on the wire.
  `scripts/test-email.js` opts itself in, and warns when the *server* would not send — a pass there is not
  proof that resets are delivered. Seed users live at `@example.com`, which publishes an RFC 7505 null MX,
  so a stray send is refused permanently instead of retried for days.
- **DigitalOcean blocks outbound SMTP on 25/465/587.** Forward Email's alternates (2465 implicit TLS,
  2587/2525 STARTTLS) work. `node scripts/check-smtp.js` probes all six and then authenticates.
- **nodemailer resolves A *and* AAAA itself and picks one at random**, deciding to resolve AAAA if any
  non-internal interface has an IPv6 address — a link-local `fe80::` counts. On a droplet with no IPv6
  route that makes ~half of sends fail with `ENETUNREACH`, intermittently. `config/plugins.ts` detects the
  absence of a globally-routable IPv6 address and swaps `nodemailer/lib/shared`'s `networkInterfaces` for
  an IPv4-only view before the first DNS lookup. Override with `SMTP_FORCE_IPV4`.
  Node's Happy Eyeballs hides this from a naive probe, so any SMTP diagnostic must pin the family (and
  connect to a AAAA *literal* — a hostname with `family: 6` may return an IPv4-mapped `::ffff:` address).
- **Every `.env*` is gitignored in both apps, so an env var set locally never deploys.** `frontend/.env`
  points `STRAPI_API_URL` at **production** Strapi, so `npm run dev` and any script reading that file talk
  to prod. Check the URL a script printed before trusting "I tested it locally".
- **`STRAPI_INVITE_TOKEN` failures are diagnosable from the error text.** An *unset* token makes
  `/api/auth/redeem-invite` return "Registration is unavailable" (503); a *wrong or revoked* token makes
  the invite lookup 401, which the route cannot distinguish from a bad code, so it returns "That invite
  code is not valid" (400). `node frontend/scripts/check-invite-token.js` reports which env file supplied
  the token and probes all four required scopes without creating an account or consuming an invite (a 403
  means the scope is missing; 401 on *every* probe means the token value itself is unrecognised).
  Nothing else in the frontend loads `.env` — there is no `dotenv` there; Next.js does it.
- **Anything `console.log`'d from `backend/config/*.ts` corrupts scripts that parse stdout**, because
  Strapi evaluates config during `createStrapi()`. Config diagnostics go to `console.warn` (stderr).
- **`showsTaskCreator.ts` reads *one* hardcoded slownames username but writes tasks into whoever is logged
  in.** Harmless with one account; with tenants it hands every invited user Brendan's band chores (and his
  show history). Gated by `SHOW_TASKS_USER_ID` via `app/api/shows-tasks/route.ts`, checked server-side
  against the user id in the verified access token (`getCaller`), and **fails closed when unset** — so the feature is off
  unless deliberately switched on. A stopgap until slownames has per-user identities.
- `backend/tsconfig.json`'s `include` is `"./"`, so it type-checks root files too. `vitest.config.ts` is
  explicitly excluded: it imports a devDependency that production installs omit, and Strapi type-checks on
  boot, so leaving it in fails on prod with `TS2307`.
- **`/practice` and `/review` are both beta-gated** (`BETA_PATHS` in `app/lib/betaConfig.ts`): no menu link
  and a 404 unless the user's Strapi record has `betaAccess: true`. Sub-routes are covered automatically.
  It's a UX gate, not an authorization boundary — a bypass reveals only the caller's own data. New work on
  either feature ships behind the existing gate for free.
- `.npmrc` sets `ignore-scripts=true`.
- Two `types` files exist: `app/types/index.ts` (current domain types) and legacy `app/types.ts`.
