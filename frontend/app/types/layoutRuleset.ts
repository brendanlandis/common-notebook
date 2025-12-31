import type { World, TodoCategory } from "./admin";

export interface LayoutRuleset {
  id: string;
  name: string;
  showRecurring: boolean;
  showNonRecurring: boolean;
  visibleWorlds: World[] | null; // null = show all worlds
  visibleCategories: TodoCategory[] | null; // null = show all categories
  sortBy: "alphabetical" | "creationDate" | "dueDate" | "completedAt";
  groupBy: "recurring-separate" | "recurring-separate-world" | "merged" | "single-section" | "world" | "project" | "category" | "good-morning" | "roulette" | "stuff" | "later" | "done" | "chores";
}

// Preset configurations
export const LAYOUT_PRESETS: LayoutRuleset[] = [
  {
    id: "good-morning",
    name: "good morning",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "good-morning",
  },
  {
    id: "everything",
    name: "everything",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "single-section",
  },
  {
    id: "day-job",
    name: "day job",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["day job"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "roulette",
    name: "roulette",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "roulette",
  },
  {
    id: "stuff",
    name: "stuff",
    showRecurring: false,
    showNonRecurring: true,
    visibleWorlds: null,
    visibleCategories: ["in the mail", "buy stuff", "wishlist", "errands"],
    sortBy: "creationDate",
    groupBy: "category",
  },
  {
    id: "life-stuff",
    name: "life stuff",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "music-admin",
    name: "music admin",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["music admin"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "make-music",
    name: "make music",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["make music"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "computer",
    name: "computer",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["computer"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "later",
    name: "later",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: null,
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "later",
  },
  {
    id: "chores",
    name: "chores",
    showRecurring: false,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    visibleCategories: null,
    sortBy: "creationDate",
    groupBy: "chores",
  },
  {
    id: "done",
    name: "done",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: null,
    visibleCategories: null,
    sortBy: "completedAt",
    groupBy: "done",
  },
];

// Helper function to get a preset by ID
export function getPresetById(id: string): LayoutRuleset | undefined {
  return LAYOUT_PRESETS.find((preset) => preset.id === id);
}

// Helper function to get default preset (first one)
export function getDefaultPreset(): LayoutRuleset {
  return LAYOUT_PRESETS[0];
}

