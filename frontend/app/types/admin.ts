// Strapi Blocks types
export interface StrapiLinkNode {
  type: 'link';
  url: string;
  children: StrapiTextNode[];
}

export interface StrapiTextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export type StrapiInlineNode = StrapiTextNode | StrapiLinkNode;

export interface StrapiParagraphBlock {
  type: 'paragraph';
  children: StrapiInlineNode[];
}

export interface StrapiHeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: StrapiInlineNode[];
}

export interface StrapiQuoteBlock {
  type: 'quote';
  children: StrapiInlineNode[];
}

export interface StrapiListItemBlock {
  type: 'list-item';
  children: StrapiInlineNode[];
}

export interface StrapiListBlock {
  type: 'list';
  format: 'ordered' | 'unordered';
  children: StrapiListItemBlock[];
}

export type StrapiBlock = StrapiParagraphBlock | StrapiListBlock | StrapiHeadingBlock | StrapiQuoteBlock;

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
  | 'computer';

// Todo category types
export type TodoCategory = 
  | 'home chores'
  | 'studio chores'
  | 'band chores'
  | 'life chores'
  | 'work chores'
  | 'web chores'
  | 'data chores'
  | 'computer chores'
  | 'in the mail'
  | 'buy stuff'
  | 'wishlist'
  | 'errands';

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

// Work session type
export interface WorkSession {
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
}

// Todo interface
export interface Todo {
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
  category: TodoCategory | null;
  trackingUrl: string | null;
  purchaseUrl: string | null;
  price: number | null;
  wishListCategory: string | null;
  soon: boolean;
  long: boolean;
  workSessions: WorkSession[] | null;
  project?: Project | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

// Project interface
export interface Project {
  id: number;
  documentId: string;
  title: string;
  description: StrapiBlock[];
  world?: World;
  importance?: ProjectImportance;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  todos?: Todo[];
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

// Note interface
export interface Note {
  id: number;
  documentId: string;
  text: StrapiBlock[];
  noteCategory: string;
  context: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export type ProjectsResponse = StrapiResponse<Project[]>;
export type ProjectResponse = StrapiResponse<Project>;
export type TodosResponse = StrapiResponse<Todo[]>;
export type TodoResponse = StrapiResponse<Todo>;
export type PracticeLogsResponse = StrapiResponse<PracticeLog[]>;
export type PracticeLogResponse = StrapiResponse<PracticeLog>;
export type NotesResponse = StrapiResponse<Note[]>;
export type NoteResponse = StrapiResponse<Note>;

