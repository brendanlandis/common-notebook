// Strapi Blocks types.
//
// We defer to the renderer's own node types (`BlocksContent`) rather than
// hand-maintaining a parallel union — the old hand-written union omitted
// image/code/nested-list nodes, which is exactly how the previous TipTap
// converter silently dropped them. `BlocksContent` is `RootNode[]`, so
// `StrapiBlock` is a single block node and `StrapiBlock[]` is `BlocksContent`.
import type { BlocksContent } from '@strapi/blocks-react-renderer';

export type StrapiBlock = BlocksContent[number];

// Recurrence types
export type RecurrenceType = 
  | 'none' 
  | 'daily' 
  | 'every x days' 
  | 'weekly' 
  | 'biweekly'
  | 'monthly date' 
  | 'monthly day'
  | 'annually'
  | 'full moon'
  | 'new moon'
  | 'every season'
  | 'winter solstice'
  | 'spring equinox'
  | 'summer solstice'
  | 'autumn equinox';

// World — a per-user, user-populated top-level bucket a project lives in.
// Was a hardcoded string union; now a row of the `api::world.world` collection,
// so users add/rename/reorder their own worlds. Reached from a task via its
// project (`task.project.world`).
export interface World {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  position: number;
  // Stable handle for special-cased worlds. Only "stuff" is used today — it
  // drives the enableStuffProjects gating and the stuff project types. null for
  // ordinary user worlds.
  systemKey: string | null;
}

// ── User-configurable views (the `api::view.view` collection) ──────────────
// A view is composed from a fixed menu of layout "engines" plus freely-set
// filter knobs, so users create/rename/reorder/hide/delete their own. See
// ~/.claude/plans/read-the-plan-at-dynamic-hartmanis.md.

// Presentation engine. `projects` = one column per project (with ordered
// sections); `chronological` = a flat list oldest→newest; `roulette` = one
// random task from the filtered set.
export type ViewLayout = 'projects' | 'chronological' | 'roulette';

// How a section selects worlds. `all` also shows incidentals (no-world tasks)
// and never surfaces system worlds (stuff); `only`/`except` name worlds
// explicitly.
export type WorldMode = 'all' | 'only' | 'except';

// Effective-tier importance filter — a contiguous range over the ordered tiers
// soonAndTopOfMind → regular → later. A task's tier: `soonAndTopOfMind` if it's
// `soon` OR its project is top-of-mind; else `later` if its project is later;
// else `regular`. (soon+later skipping regular is intentionally not offered.)
export type ImportanceFilter =
  | 'any'
  | 'soonAndTopOfMind'
  | 'soonAndTopOfMind-regular'
  | 'regular'
  | 'regular-later'
  | 'later';

export type ProjectTypeFilter = 'any' | 'chores';
export type RecurrenceFilter = 'both' | 'recurring' | 'nonRecurring';

// A section as returned by Strapi (the `view.section` component). `worlds` is
// populated as full World rows; `viewToRuleset` reduces them to documentIds.
export interface ViewSection {
  id?: number;
  name: string | null;
  worldMode: WorldMode;
  worlds: World[];
  importance: ImportanceFilter;
  projectType: ProjectTypeFilter;
  recurrence: RecurrenceFilter;
  longOnly: boolean;
}

// A view row. `owner` is private and never serialized to the client.
export interface View {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  position: number;
  systemKey: string | null;
  layout: ViewLayout;
  sections: ViewSection[];
}

// Write shapes for create/update (worlds referenced by documentId; owner/slug
// are stamped server-side).
export interface ViewSectionInput {
  name?: string;
  worldMode: WorldMode;
  worlds: string[];
  importance: ImportanceFilter;
  projectType: ProjectTypeFilter;
  recurrence: RecurrenceFilter;
  longOnly: boolean;
}
export interface ViewInput {
  name?: string;
  slug?: string;
  position?: number;
  systemKey?: string;
  layout?: ViewLayout;
  sections?: ViewSectionInput[];
}

// The resolved filter set a section contributes at transform time: the section's
// world selection reduced to concrete documentIds, plus the other knobs.
export interface FilterSet {
  name?: string;
  worldMode: WorldMode;
  worldIds: string[];
  importance: ImportanceFilter;
  projectType: ProjectTypeFilter;
  recurrence: RecurrenceFilter;
  longOnly: boolean;
}

// Practice type
export type PracticeType = 
  | 'guitar'
  | 'voice'
  | 'drums'
  | 'writing'
  | 'composing'
  | 'ear training';

// Project importance types
export type ProjectImportance =
  | 'normal'
  | 'top of mind'
  | 'later';

// Project type — stable handle that replaces the task `category` enum.
// `normal`/`chores` are ordinary worlds; the four "stuff" types drive
// shopping-list form fields, the price badge, and wishlist sub-grouping.
export type ProjectType =
  | 'normal'
  | 'chores'
  | 'wishlist'
  | 'errands'
  | 'in the mail'
  | 'buy stuff';

// The four stuff project types live in the `stuff` world and are gated by the
// `enableStuffProjects` system setting.
export const STUFF_PROJECT_TYPES: ProjectType[] = [
  'wishlist',
  'errands',
  'in the mail',
  'buy stuff',
];

// Work session type
export interface WorkSession {
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
}

// Task interface
export interface Task {
  id: number;
  documentId: string;
  title: string;
  description: StrapiBlock[];
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  displayDate: string | null;
  displayDateOffset: number | null;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceDayOfWeek: number | null;
  recurrenceDayOfMonth: number | null;
  recurrenceWeekOfMonth: number | null;
  recurrenceDayOfWeekMonthly: number | null;
  recurrenceMonth: number | null;
  trackingUrl: string | null;
  purchaseUrl: string | null;
  price: number | null;
  wishListCategory: string | null;
  soon: boolean;
  long: boolean;
  workSessions: WorkSession[] | null;
  project?: Project | null;
  workedOnPhase?: 1 | 2 | 3; // Added for worked-on state tracking
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

// Project interface
export interface Project {
  id: number;
  documentId: string;
  title: string;
  slug?: string; // URL-friendly, derived from title; unique per owner
  description: StrapiBlock[];
  world?: World | null; // normalized from Strapi `worldRef` by the projects BFF
  importance?: ProjectImportance;
  projectType?: ProjectType;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  tasks?: Task[];
}

// API Response types
export interface StrapiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

// Practice Log interface
export interface PracticeLog {
  id: number;
  documentId: string;
  start: string; // ISO datetime
  stop: string | null; // ISO datetime, nullable for in-progress sessions
  type: PracticeType;
  notes: StrapiBlock[];
  duration: number; // minutes
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export type ProjectsResponse = StrapiResponse<Project[]>;
export type ProjectResponse = StrapiResponse<Project>;
export type TasksResponse = StrapiResponse<Task[]>;
export type TaskResponse = StrapiResponse<Task>;
export type PracticeLogsResponse = StrapiResponse<PracticeLog[]>;
export type PracticeLogResponse = StrapiResponse<PracticeLog>;

// Layout Ruleset — the runtime shape a view resolves to (see app/lib/views.ts
// `viewToRuleset`). Composable views set `layout` + `sections`; the two code
// presets (done, recurring) additionally set `codePreset`, which takes
// precedence over `layout` in the transformer and renderer.
export interface LayoutRuleset {
  slug: string;
  name: string;
  layout: ViewLayout;
  // ≥1 filter set. `chronological`/`roulette` use exactly one; `projects` may
  // have several ordered sections with topmost-wins dedup.
  sections: FilterSet[];
  // "stuff" gates the projectType/wishlist sub-split in the projects layout
  // (replaces the old `ruleset.id === "stuff"` coupling).
  systemKey?: string | null;
  // Per-project route: keep only tasks in these project documentIds (world
  // filtering is skipped when set).
  visibleProjects?: string[];
  // Set only on CODE_PRESETS. Selects a bespoke branch (done/recurring).
  codePreset?: "done" | "recurring";
  // The recurring review preset shows all incomplete recurring tasks regardless
  // of a future displayDate; every other view honours the global gate.
  ignoreDisplayDate?: boolean;
}
