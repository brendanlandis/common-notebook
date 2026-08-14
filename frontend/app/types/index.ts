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
// `default`/`chores` are ordinary worlds; the four "stuff" types drive
// shopping-list form fields, the price badge, and wishlist sub-grouping.
//
// The ordinary value is `default`, matching the Strapi enum. It is *not* `normal`
// — that is `ProjectImportance`'s ordinary value, and the two were conflated:
// the frontend sent `projectType: 'normal'`, which Strapi rejects, so saving an
// ordinary project failed (silently, since the handler ignored the 400).
export type ProjectType =
  | 'default'
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

// ── Recurrence, as a rule rather than a set of task columns ────────────────
// These two interfaces used to be loose fields on `Task`, which meant the
// recurrence math in `lib/recurrence.ts` could only ever be asked "when does
// this *task* next come up". Anything else wanting the same calendar logic —
// the review cadence, for one — had no way to ask without fabricating a whole
// Task. Splitting them out costs nothing (`Task` extends both, so its shape is
// unchanged) and makes the recurrence engine callable with a bare rule.

// *What* the pattern is. Everything here is user-chosen at edit time and
// unchanged by completing an occurrence.
export interface RecurrenceRule {
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number | null;
  recurrenceDayOfWeek: number | null;
  recurrenceDayOfMonth: number | null;
  recurrenceWeekOfMonth: number | null;
  recurrenceDayOfWeekMonthly: number | null;
  recurrenceMonth: number | null;
}

// *Where the pattern currently sits* — the occurrence already materialised.
// Separate from the rule because it changes on every completion while the rule
// does not, and because the astronomical/calendar types anchor their next
// occurrence on it (see `calculateEventDate`).
export interface RecurrenceAnchor {
  dueDate: string | null;
  displayDate: string | null;
  displayDateOffset: number | null;
}

// Task interface
export interface Task extends RecurrenceRule, RecurrenceAnchor {
  id: number;
  documentId: string;
  title: string;
  description: StrapiBlock[];
  completed: boolean;
  completedAt: string | null;
  trackingUrl: string | null;
  purchaseUrl: string | null;
  price: number | null;
  wishListCategory: string | null;
  soon: boolean;
  long: boolean;
  // "Come back to this sometime" — distinct from `completed` (done) and from a
  // future `displayDate` (come back on a *date*). Practice material is what
  // motivated it, since a piece you've set aside is neither finished nor due.
  onHold: boolean;
  // Free text, autocompleted from siblings within the same project: scales,
  // arpeggios, chords. Deliberately not a reuse of `wishListCategory` — that
  // field is named for wish lists, and giving a field a second meaning is how
  // `projectType` and `importance` both ended up spelled 'normal'.
  materialCategory: string | null;
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
  complete?: boolean; // a "completed" project: hidden from the New Task dropdown and views
  completedAt?: string | null; // stamped server-side when `complete` flips true
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

// A practice session.
//
// `type` is gone — it was a six-value enum duplicated across four files. A
// session now points at the piece of `material` it was spent on (a task, in a
// subject, in the practice world), so "minutes per day per subject" is a sum
// over rows rather than a hardcoded list.
export interface PracticeLog {
  id: number;
  documentId: string;
  start: string; // ISO datetime — the first segment's start
  stop: string | null; // ISO datetime, nullable for in-progress sessions
  /** The task being practised. Populated with its project by the BFF. */
  material?: Task | null;
  /**
   * The stretches actually practised, so a session can be paused and can survive
   * a closed tab. `duration` is their sum, which is why it is no longer
   * `stop - start`. See `app/lib/practiceSession.ts`.
   */
  segments: PracticeSegment[] | null;
  notes: StrapiBlock[];
  duration: number; // minutes
  date: string; // YYYY-MM-DD — the effective day the session *started*
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

/** One uninterrupted stretch of practice. `stop` is null while it is running. */
export interface PracticeSegment {
  start: string;
  stop: string | null;
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
