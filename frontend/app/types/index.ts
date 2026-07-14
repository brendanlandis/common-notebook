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

// World types
export type World =
  | 'life stuff'
  | 'music admin'
  | 'make music'
  | 'day job'
  | 'computer'
  | 'stuff';

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
  world?: World;
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

// Layout Ruleset interface  
export interface LayoutRuleset {
  id: string;
  name: string;
  showRecurring: boolean;
  showNonRecurring: boolean;
  visibleWorlds: World[] | null; // null = show all worlds
  visibleProjects?: string[]; // documentIds; omit/undefined = show all projects
  sortBy: "alphabetical" | "creationDate" | "dueDate" | "completedAt";
  groupBy: "recurring-separate" | "recurring-separate-world" | "merged" | "single-section" | "world" | "project" | "category" | "good-morning" | "roulette" | "stuff" | "later" | "done" | "invoicing" | "chores" | "recurring-review";
  longOnly?: boolean;
}
