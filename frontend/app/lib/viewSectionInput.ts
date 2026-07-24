import type { View, ViewSection, ViewSectionInput } from "@/app/types/index";

// Section write-shape helpers for the views editor. View sections are Strapi
// components (replace-on-write): every section edit or reorder PUTs the WHOLE
// rebuilt `sections` array, so `sectionToInput` must reproduce every field of a
// section faithfully — a dropped field here silently loses that data on the next
// section write. Kept here (out of the component) so it can be unit-tested.

export const defaultSection = (): ViewSectionInput => ({
  worldMode: "all",
  worlds: [],
  importance: "any",
  projectType: "any",
  recurrence: "both",
  longOnly: false,
});

export const sectionToInput = (s: ViewSection): ViewSectionInput => ({
  name: s.name ?? undefined,
  worldMode: s.worldMode,
  worlds: s.worlds.map((w) => w.documentId),
  importance: s.importance,
  projectType: s.projectType,
  recurrence: s.recurrence,
  longOnly: s.longOnly,
});

export const viewSections = (view: View): ViewSectionInput[] =>
  view.sections.map(sectionToInput);
