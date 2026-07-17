# overview

`common-notebook` is a suite of no-brand, personal utilities: primarily a **task list** (shown on the *To Do* page). Two independent
npm projects (no workspace tooling):

- `frontend/` — Next.js 16 (App Router), React 19, TypeScript. The UI. Runs on `localhost:3000`.
- `backend/`  — Strapi 5 headless CMS/API (`common-notebook-api`). The data layer. Runs on `localhost:1337`.

License: AGPL v3.

# Frontend

## Stack
- Next.js `^16` App Router, React `^19`, TypeScript strict, import alias `@/` → frontend root.
- Styling: Tailwind CSS v4 (PostCSS/CSS-based config, no `tailwind.config`) + daisyUI 5, plus
  hand-written CSS in `app/css/`. No CSS modules.
- Editor: TipTap 3 (`@tiptap/*` all `^3.27.1`) + `@strapi/blocks-react-renderer`.
- Forms: react-hook-form 7 + zod 4. Charts: recharts 3. Icons: `@phosphor-icons/react`.
- Dates: **`temporal-polyfill`** (the TC39 Temporal API; Node/browsers don't ship it natively yet) — all
  zone- and calendar-aware date logic goes through it. `date-fns`/`date-fns-tz` were removed. Also
  `astronomy-engine` (moon-phase / solstice recurrence).
- **Server state lives in TanStack Query** (`@tanstack/react-query` 5): `useQuery` for reads,
  `useMutation` + `invalidateQueries` for writes, optimistic `onMutate`/`onError` where a failure
  would otherwise leave the wrong thing on screen. Context is for **UI state only** (drawer,
  selection) and for values the server hands down as props (`DateTimeSettingsProvider`).
  *Migration in progress:* `useViews`/`useWorlds`/`useBetaAccess`, `practice/hooks/usePracticeLogs`,
  `hooks/useProjects`, `todo/hooks/useTasks` and `todo/hooks/useTaskLists` are query-backed; all of
  `todo/`'s reads and mutations now go through the cache. What remains is shrinking
  `todo/contexts/TaskDataContext.tsx` to `editingTask`/`editingProject` and pointing its five consumers
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
- `(main)/` — authed route group (`layout.tsx`). Features: `todo/`, `practice/`, `settings/`, home.
  Each feature colocates its own `components/`, `hooks/`, `utils/`. `todo/components/layouts/` holds
  ~11 view variants + `types.ts`.
- `api/` — Next.js route handlers acting as a BFF/proxy to Strapi (`tasks/`, `projects/`,
  `practice-logs/`, `system-settings/`, `auth/`, …).
- `lib/` — pure, unit-tested business logic. Core files: `layoutTransformers.ts` (the task-grouping
  engine), `groupTasks.ts`, `layoutPresets.ts`, `projectPriority.ts`, `recurrence*.ts`, `dateUtils.ts`,
  `moonPhase*.ts`, `dayBoundary*.ts`.
- `components/` — shared UI. `contexts/` — `LayoutRulesetContext`, `TaskActionsContext`,
  `TimezoneContext`, `PracticeContext`. `hooks/` — global hooks. `types/index.ts` — central domain types.

## Backend communication
Browser never calls Strapi directly. Flow: browser → Next `app/api/*` handler → `getAccessToken(req)`
(`app/lib/strapiAuth.ts`) → `fetch()` to `${STRAPI_API_URL}/api/...` with `Authorization: Bearer <token>`.
API handlers return `{ success: boolean, ... }`.

**Auth is session-based, not a bare JWT.** Strapi runs `jwtManagement: 'refresh'`, so there are two
httpOnly cookies: `auth_token` (access, 30 min) and `refresh_token` (a year, backed by a row in
`strapi_sessions`). Never read `auth_token` directly in a handler — call `getAccessToken(req)`, which
refreshes proactively when the token is within 60s of expiry and re-sets both cookies. Logging out calls
Strapi `/auth/logout` with `scope: 'all'`, which is what makes revocation real.

`frontend/proxy.ts` gates page navigations on the *refresh* cookie's `exp`, decoded locally without
verifying the signature. That is a **UX gate, not an authorization boundary** — a forged cookie renders an
empty shell, because every data call is still authorized by Strapi and scoped by the ownership middleware.

# Backend

Strapi `5.50.0`, TypeScript. Scripts: `npm run develop` / `build` / `start` / `deploy`.
DB via `DATABASE_CLIENT` (mysql | postgres | sqlite), **defaults to SQLite** locally
(`backend/config/database.ts`). Media uploads go to AWS S3.

Content types under `backend/src/api/*/content-types/*/schema.json`: `task`, `project`,
`practice-log`, `system-setting`. Strapi 5 style — `documentId` is the stable identifier used
throughout the frontend. Node engine constraint: `>=18 <=22.x`.

# Domain model (task app)

- **World** — a top-level bucket: `day job`, `life stuff`, `music admin`, `make music`, `computer`,
  `stuff` (`app/types/index.ts`). A project belongs to one world.
- **Importance** — project tier: `top of mind`, `normal`, `later`. World views order projects
  top-of-mind → priority (`pN` title marker) → normal → later, creation-date within each.
- **Project type** — a project's `projectType` (`app/types/index.ts`): `default`, `chores`, plus the four
  `STUFF_PROJECT_TYPES` (`wishlist`, `errands`, `in the mail`, `buy stuff`) that live in the `stuff` world
  and are gated by the `enableStuffProjects` setting (`app/lib/stuffProjectsConfig.ts`). This **replaced the
  old per-task `category` enum** — see `backend/scripts/migrate-categories-to-projects.js`.
- **View / preset / ruleset** — task views are presets in `app/lib/layoutPresets.ts`, chosen via the
  `?view=<id>` URL param (`app/contexts/LayoutRulesetContext.tsx`). Each preset sets
  `groupBy`/`sortBy`/`visibleWorlds`/`visibleProjects`, consumed by `transformLayout`
  (`app/lib/layoutTransformers.ts`) → `LayoutRenderer` → a per-layout component.
- **Incidentals** — tasks with no project.

# Conventions

- **Feature-colocation:** feature code under its route folder; shared code in top-level
  `app/{components,lib,hooks,contexts}`.
- **Custom hooks own data domains** — e.g. `todo/hooks/useTasks.ts` owns active tasks (flat array +
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
  every setting live in exactly one table, `app/lib/defaultSettings.ts` (EST, 4am boundary).
  **`TimeZoneSettings` is a function parameter, not a settings bag** — its membership is decided by
  what the pure date math reads, not by what sounds time-related. `completedTaskVisibilityMinutes` is
  time-ish but sits *beside* it on `DateTimeSettingsProvider`, because no date function reads it (only
  `useTasks`, filtering a list) and no server route needs it; folding it in would hand a visibility
  duration to `getTodayForRecurrence` and make ~12 test literals invent a value that cannot affect
  their assertion.
  **Never add a module-level cache for a setting.** Two modules each caching `dayBoundaryHour` with
  different defaults is why the server computed every date in EST at midnight regardless of the user's
  setting, and why completing a recurring task wrote a date the form never predicted. The same shape
  hid just-completed tasks on the first load of /todo until you visited /settings. A cache also cannot
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
  pass `initial` so the provider doesn't fetch (see `app/(main)/todo/hooks/useTasks.test.ts`).
  Query-backed hooks need a `QueryClientProvider` wrapper with a **per-test client** and
  **`retry: false`** — the app default of 1 makes every failure case sit through a backoff before the
  assertion runs (see `app/hooks/useWorlds.test.ts`). Component tests that only care about a hook's
  *output* should `vi.mock` the hook instead (see `app/components/HeaderContent.test.tsx`); there is
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
  suspecting `private`.
- **Strapi has no compare-and-set.** Anything read-then-write (invite redemption, the moon-phase reset)
  needs an in-process guard keyed by the thing being mutated. Correct on the single-process droplet; the
  same caveat as `app/api/auth/rate-limiter.ts`.
- **`.env` is only loaded once `createStrapi()` runs.** A script reading `process.env` *before* booting
  Strapi sees nothing from the file — which silently broke `seed-dev.js`'s "refuse unless local SQLite"
  guard on prod (`DATABASE_CLIENT` read as `undefined`, defaulted to `sqlite`) and made `test-email.js`
  warn about an `EMAIL_ENABLED` that was in fact set. Any script inspecting env before boot must
  `require('dotenv').config({ path: process.env.ENV_PATH || path.resolve(__dirname, '..', '.env') })`
  first. dotenv never overwrites an existing variable, so shell overrides still win.
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
  against the user id in the signed access token, and **fails closed when unset** — so the feature is off
  unless deliberately switched on. A stopgap until slownames has per-user identities.
- `backend/tsconfig.json`'s `include` is `"./"`, so it type-checks root files too. `vitest.config.ts` is
  explicitly excluded: it imports a devDependency that production installs omit, and Strapi type-checks on
  boot, so leaving it in fails on prod with `TS2307`.
- `.npmrc` sets `ignore-scripts=true`.
- Two `types` files exist: `app/types/index.ts` (current domain types) and legacy `app/types.ts`.
