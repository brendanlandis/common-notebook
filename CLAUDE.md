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
- Dates: `date-fns` + `date-fns-tz`; also `astronomy-engine` (moon-phase / solstice recurrence).
- No global state library — React hooks + Context only.
- Tests: Vitest 4 + jsdom + Testing Library; co-located as `*.test.ts(x)` siblings next to the
  code under test. No Prettier config.

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
- **Project type** — a project's `projectType` (`app/types/index.ts`): `normal`, `chores`, plus the four
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
- **EST-centric date logic:** use `getTodayInEST`/`getNowInEST`/`parseInEST` from `app/lib/dateUtils.ts`
  plus configurable day-boundary hour; keep date logic pure and unit-tested.
- Naming: PascalCase components, camelCase lib/util files, `use*` hooks, `*.test.ts(x)` siblings for tests.

# Gotchas
- Run tests with `npm run test:run` (one-shot) — plain `npm test` is Vitest **watch mode** and will
  hang a non-interactive run. Single file: `npx vitest run <path>`.
- CI runs `npm run build` (both apps) + `npm run test:run` (both apps). **Lint and `tsc` are not
  CI-gated.** `npm run lint` (`eslint .`) reports ~168 pre-existing findings and `tsc --noEmit` has
  pre-existing errors in some test files — don't chase these as if new; scope checks to files you touched.
- Tests co-locate as `*.test.ts(x)` siblings next to their subject; `layoutTransformers`/date tests
  mock `./dateUtils` and `./timezoneConfig` via `vi.mock` (see `app/lib/layoutTransformers.*.test.ts`).
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
