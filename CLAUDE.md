# overview

`common-notebook` is a suite of no-brand, personal utilities: primarily a **Todo list** app. Two independent
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
- Tests: Vitest 4 + jsdom + Testing Library; colocated in `__tests__/` dirs. No Prettier config.

## Layout (`frontend/app/`)
- `(main)/` — authed route group (`layout.tsx`). Features: `todo/`, `practice/`, `settings/`, home.
  Each feature colocates its own `components/`, `hooks/`, `utils/`. `todo/components/layouts/` holds
  ~11 view variants + `types.ts`.
- `api/` — Next.js route handlers acting as a BFF/proxy to Strapi (`todos/`, `projects/`,
  `practice-logs/`, `system-settings/`, `auth/`, …).
- `lib/` — pure, unit-tested business logic. Core files: `layoutTransformers.ts` (the todo-grouping
  engine), `groupTodos.ts`, `layoutPresets.ts`, `projectPriority.ts`, `recurrence*.ts`, `dateUtils.ts`,
  `moonPhase*.ts`, `dayBoundary*.ts`.
- `components/` — shared UI. `contexts/` — `LayoutRulesetContext`, `TodoActionsContext`,
  `TimezoneContext`, `PracticeContext`. `hooks/` — global hooks. `types/index.ts` — central domain types.

## Backend communication
Browser never calls Strapi directly. Flow: browser → Next `app/api/*` handler → reads the `auth_token`
httpOnly cookie → `fetch()` to `${STRAPI_API_URL}/api/...` with `Authorization: Bearer <token>`.
API handlers return `{ success: boolean, ... }`. Unauthenticated requests are redirected to `/login`
by `frontend/proxy.ts`.

# Backend

Strapi `5.50.0`, TypeScript. Scripts: `npm run develop` / `build` / `start` / `deploy`.
DB via `DATABASE_CLIENT` (mysql | postgres | sqlite), **defaults to SQLite** locally
(`backend/config/database.ts`). Media uploads go to AWS S3.

Content types under `backend/src/api/*/content-types/*/schema.json`: `todo`, `project`,
`practice-log`, `system-setting`. Strapi 5 style — `documentId` is the stable identifier used
throughout the frontend. Node engine constraint: `>=18 <=22.x`.

## Conventions

- **Feature-colocation:** feature code under its route folder; shared code in top-level
  `app/{components,lib,hooks,contexts}`.
- **Custom hooks own data domains** — e.g. `todo/hooks/useTodos.ts` owns active todos (flat array +
  manual-project overlay + memoized groupings) and centralizes all mutations
  (`addTodo/updateTodo/updateProject/refetch/…`).
- **Configurable todo views** are data-driven by `LayoutRuleset` (`groupBy`/`sortBy`/`visibleWorlds`/
  `visibleCategories`) — presets in `layoutPresets.ts`, applied in `layoutTransformers.ts`.
  World views order projects by tier: top-of-mind → priority (`pN` title marker, see
  `projectPriority.ts`) → normal → later, sorted by creation date within each tier.
- **EST-centric date logic:** use `getTodayInEST`/`getNowInEST`/`parseInEST` from `app/lib/dateUtils.ts`
  plus configurable day-boundary hour; keep date logic pure and unit-tested.
- Naming: PascalCase components, camelCase lib/util files, `use*` hooks, `__tests__/` for tests.

## Gotchas
- CI Node versions differ from the backend's `<=22.x` cap (frontend CI uses Node 25) — watch for
  engine mismatches.
- `.npmrc` sets `ignore-scripts=true`.
- Two `types` files exist: `app/types/index.ts` (current domain types) and legacy `app/types.ts`.
