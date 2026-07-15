import type { LayoutRuleset } from "@/app/types/index";

// Preset configurations. Per-world views are NOT presets anymore — they are
// generated from the user's worlds (see LayoutSelector) and rendered by the
// /todo/world/[slug] route. `worldScope` says which worlds each preset spans:
//   'combined' → worlds with includeInCombinedViews (day-job-like worlds excluded)
//   'excluded' → worlds without it (invoicing)
//   'all'      → every world (stuff still only shows in its own view)
//   { systemKey } → a specific system world (stuff)
export const LAYOUT_PRESETS: LayoutRuleset[] = [
  {
    id: "good-morning",
    name: "good morning",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "combined",
    sortBy: "creationDate",
    groupBy: "good-morning",
  },
  {
    id: "everything",
    name: "everything",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "combined",
    sortBy: "creationDate",
    groupBy: "single-section",
  },
  {
    id: "chipping-away",
    name: "chipping away",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "combined",
    sortBy: "creationDate",
    groupBy: "single-section",
    longOnly: true,
  },
  {
    id: "roulette",
    name: "roulette",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "combined",
    sortBy: "creationDate",
    groupBy: "roulette",
  },
  {
    id: "stuff",
    name: "stuff",
    showRecurring: false,
    showNonRecurring: true,
    worldScope: { systemKey: "stuff" },
    sortBy: "creationDate",
    groupBy: "category",
  },
  {
    id: "later",
    name: "later",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "all",
    sortBy: "creationDate",
    groupBy: "later",
  },
  {
    id: "chores",
    name: "chores",
    showRecurring: false,
    showNonRecurring: true,
    worldScope: "combined",
    sortBy: "creationDate",
    groupBy: "chores",
  },
  {
    id: "done",
    name: "done",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "all",
    sortBy: "completedAt",
    groupBy: "done",
  },
  {
    id: "invoicing",
    name: "invoicing",
    showRecurring: true,
    showNonRecurring: true,
    worldScope: "excluded",
    sortBy: "completedAt",
    groupBy: "invoicing",
  },
  {
    id: "recurring",
    name: "recurring",
    showRecurring: true,
    showNonRecurring: false,
    worldScope: "all",
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
