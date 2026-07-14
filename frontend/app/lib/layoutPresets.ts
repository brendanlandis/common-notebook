import type { LayoutRuleset } from "@/app/types/index";

// Preset configurations
export const LAYOUT_PRESETS: LayoutRuleset[] = [
  {
    id: "good-morning",
    name: "good morning",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    sortBy: "creationDate",
    groupBy: "good-morning",
  },
  {
    id: "everything",
    name: "everything",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    sortBy: "creationDate",
    groupBy: "single-section",
  },
  {
    id: "chipping-away",
    name: "chipping away",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    sortBy: "creationDate",
    groupBy: "single-section",
    longOnly: true,
  },
  {
    id: "day-job",
    name: "day job",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["day job"],
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "roulette",
    name: "roulette",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    sortBy: "creationDate",
    groupBy: "roulette",
  },
  {
    id: "stuff",
    name: "stuff",
    showRecurring: false,
    showNonRecurring: true,
    visibleWorlds: ["stuff"],
    sortBy: "creationDate",
    groupBy: "category",
  },
  {
    id: "life-stuff",
    name: "life stuff",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["life stuff"],
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "music-admin",
    name: "music admin",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["music admin"],
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "make-music",
    name: "make music",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["make music"],
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "computer",
    name: "computer",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["computer"],
    sortBy: "creationDate",
    groupBy: "world",
  },
  {
    id: "later",
    name: "later",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: null,
    sortBy: "creationDate",
    groupBy: "later",
  },
  {
    id: "chores",
    name: "chores",
    showRecurring: false,
    showNonRecurring: true,
    visibleWorlds: ["life stuff", "music admin", "make music", "computer"],
    sortBy: "creationDate",
    groupBy: "chores",
  },
  {
    id: "done",
    name: "done",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: null,
    sortBy: "completedAt",
    groupBy: "done",
  },
  {
    id: "invoicing",
    name: "invoicing",
    showRecurring: true,
    showNonRecurring: true,
    visibleWorlds: ["day job"],
    sortBy: "completedAt",
    groupBy: "invoicing",
  },
  {
    id: "recurring",
    name: "recurring",
    showRecurring: true,
    showNonRecurring: false,
    visibleWorlds: null,
    sortBy: "alphabetical",
    groupBy: "recurring-review",
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
