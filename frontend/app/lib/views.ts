import type {
  View,
  LayoutRuleset,
  FilterSet,
  ViewLayout,
  WorldMode,
  ImportanceFilter,
  ProjectTypeFilter,
  RecurrenceFilter,
} from "@/app/types/index";

// Views are user-populated data now (the `api::view.view` collection), not the
// hardcoded LAYOUT_PRESETS. These pure helpers work over the user's views; the
// list itself comes from ViewsContext / the /api/views BFF.

/** Ascending by `position`; input order is the stable tiebreaker. */
export function sortViewsByPosition(views: View[]): View[] {
  return views
    .map((v, i) => [v, i] as const)
    .sort((a, b) => (a[0].position ?? 0) - (b[0].position ?? 0) || a[1] - b[1])
    .map(([v]) => v);
}

export function findViewBySlug(slug: string, views: View[]): View | undefined {
  return views.find((v) => v.slug === slug);
}

/** A no-op filter set — every task passes. Used for defaults / code presets. */
export function defaultFilterSet(): FilterSet {
  return {
    worldMode: "all",
    worldIds: [],
    importance: "any",
    projectType: "any",
    recurrence: "both",
    longOnly: false,
  };
}

/**
 * Resolve a persisted View into the runtime LayoutRuleset the transformer
 * consumes. Each section's populated `worlds` relation is reduced to the
 * documentIds it names; the transformer resolves those against the user's full
 * world list (respecting worldMode + the system-world rule).
 */
export function viewToRuleset(view: View): LayoutRuleset {
  const sections: FilterSet[] = (view.sections ?? []).map((s) => ({
    name: s.name ?? undefined,
    worldMode: s.worldMode ?? "all",
    worldIds: (s.worlds ?? []).map((w) => w.documentId),
    importance: s.importance ?? "any",
    projectType: s.projectType ?? "any",
    recurrence: s.recurrence ?? "both",
    longOnly: s.longOnly ?? false,
  }));

  return {
    slug: view.slug,
    name: view.name,
    layout: view.layout,
    systemKey: view.systemKey,
    // A view with no sections (shouldn't happen — the UI enforces ≥1) still gets
    // a passthrough so it renders empty rather than crashing.
    sections: sections.length > 0 ? sections : [defaultFilterSet()],
  };
}

// ── Code presets ───────────────────────────────────────────────────────────
// `done` and `recurring` aren't composable data — they need completed-status
// filtering / completion ordering / a review UI. They live here as fixed
// rulesets and are always available in the picker's "review" group. `codePreset`
// selects their bespoke transformer branch + render component.

export const CODE_PRESETS: LayoutRuleset[] = [
  {
    slug: "done",
    name: "done",
    layout: "chronological", // unused: codePreset wins
    sections: [defaultFilterSet()],
    codePreset: "done",
  },
  {
    slug: "recurring",
    name: "recurring",
    layout: "projects", // unused: codePreset wins
    sections: [defaultFilterSet()],
    codePreset: "recurring",
    ignoreDisplayDate: true,
  },
];

export function findCodePreset(slug: string): LayoutRuleset | undefined {
  return CODE_PRESETS.find((p) => p.slug === slug);
}

// ── Settings-UI option lists (value → friendly label) ────────────────────────

export const LAYOUT_OPTIONS: { value: ViewLayout; label: string }[] = [
  { value: "projects", label: "projects (one column per project)" },
  { value: "chronological", label: "chronological (flat list, oldest first)" },
  { value: "roulette", label: "roulette (one random task)" },
];

export const WORLD_MODE_OPTIONS: { value: WorldMode; label: string }[] = [
  { value: "all", label: "all worlds" },
  { value: "only", label: "only these worlds" },
  { value: "except", label: "all except these worlds" },
];

export const IMPORTANCE_OPTIONS: { value: ImportanceFilter; label: string }[] = [
  { value: "any", label: "any importance" },
  { value: "soonAndTopOfMind", label: "soon & top of mind" },
  { value: "soonAndTopOfMind-regular", label: "soon & top of mind → regular" },
  { value: "regular", label: "regular only" },
  { value: "regular-later", label: "regular → later" },
  { value: "later", label: "later only" },
];

export const PROJECT_TYPE_OPTIONS: { value: ProjectTypeFilter; label: string }[] = [
  { value: "any", label: "any type" },
  { value: "chores", label: "chores" },
];

export const RECURRENCE_OPTIONS: { value: RecurrenceFilter; label: string }[] = [
  { value: "both", label: "recurring & one-off" },
  { value: "recurring", label: "recurring only" },
  { value: "nonRecurring", label: "one-off only" },
];
