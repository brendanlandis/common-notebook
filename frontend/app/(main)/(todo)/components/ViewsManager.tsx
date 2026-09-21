"use client";

import { useState, type ReactNode } from "react";
import type { View, ViewSectionInput, ViewLayout, WorldMode } from "@/app/types/index";
import { useViews } from "@/app/(main)/(todo)/hooks/useViews";
import { useWorlds } from "@/app/(main)/(todo)/hooks/useWorlds";
import {
  sortViewsByPosition,
  LAYOUT_OPTIONS,
  WORLD_MODE_OPTIONS,
  IMPORTANCE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
} from "@/app/lib/views";
import { Checkbox, Input, Select } from "@/app/components/ui/FormControls";
import DisclosureToggle from "@/app/components/ui/DisclosureToggle";
import { SortableProvider, SortableGroup, SortableRow, reorderIds } from "@/app/components/ui/SortableList";
import { defaultSection, sectionToInput, viewSections } from "@/app/lib/viewSectionInput";

// Create / rename / reorder / delete the user's task-list views, and compose
// each from a layout engine + one or more filtered sections. The two review
// presets (done, recurring) are code, not editable here.
//
// Reordering is drag-only, at two levels: views among themselves (N position-only
// PUTs via `reorderViews`) and sections within a view. Sections are Strapi
// components — replace-on-write — so reordering them means PUTting the whole
// rebuilt `sections` array, exactly as the old ↑/↓ buttons did.
//
// Section drag ids are namespaced `section:<viewId>:<index>` so that the nested
// SortableContexts can't confuse one view's sections for another's, or for a
// view row itself.

const sectionId = (viewId: string, index: number) => `section:${viewId}:${index}`;

export default function ViewsManager() {
  const { views, loading, createView, updateView, deleteView, reorderViews } = useViews();
  const { worlds } = useWorlds();
  const [newName, setNewName] = useState("");
  const [newLayout, setNewLayout] = useState<ViewLayout>("projects");
  const [busy, setBusy] = useState(false);
  // Which views have their sections expanded. This is React state rather than a
  // native <details> because collapsed rows must not exist at all: a hidden
  // section row still registers as a dnd-kit droppable, but with no layout box,
  // and sortableKeyboardCoordinates then picks one of those zero-rect ghosts as
  // the drop target for a *view* drag — the keyboard lift worked and the move
  // silently did nothing.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (viewId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(viewId)) next.add(viewId);
      return next;
    });

  const ordered = sortViewsByPosition(views);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await createView({ name, layout: newLayout, position: views.length, sections: [defaultSection()] });
      setNewName("");
      setNewLayout("projects");
    });
  };

  const handleRename = (view: View, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === view.name) return;
    run(() => updateView(view.documentId, { name: trimmed }));
  };

  const handleLayout = (view: View, layout: ViewLayout) => {
    // chronological/roulette use exactly one section — truncate if switching.
    const sections = layout === "projects" ? viewSections(view) : viewSections(view).slice(0, 1);
    run(() => updateView(view.documentId, { layout, sections }));
  };

  // One DndContext serves both levels, so this routes by id shape: section ids
  // are `section:<viewId>:<index>`, view ids are bare documentIds.
  const handleDragEnd = (activeId: string, overId: string) => {
    if (activeId.startsWith("section:")) {
      const viewId = activeId.split(":")[1];
      // Refuse a cross-view drop: the two lists are different `sections` arrays.
      if (!overId.startsWith(`section:${viewId}:`)) return;
      const view = ordered.find((v) => v.documentId === viewId);
      if (!view) return;
      const ids = view.sections.map((_, si) => sectionId(viewId, si));
      const order = reorderIds(ids, activeId, overId);
      if (order) handleReorderSections(view, order);
      return;
    }
    const order = reorderIds(ordered.map((v) => v.documentId), activeId, overId);
    if (order) run(() => reorderViews(order));
  };

  const handleDeleteView = (view: View) => {
    if (!confirm(`Delete the "${view.name}" view?`)) return;
    run(() => deleteView(view.documentId));
  };

  // Section edits rebuild the whole sections array and PUT it (components are
  // replace-on-write).
  const patchSection = (view: View, index: number, patch: Partial<ViewSectionInput>) => {
    const sections = viewSections(view);
    sections[index] = { ...sections[index], ...patch };
    run(() => updateView(view.documentId, { sections }));
  };

  const addSection = (view: View) => {
    run(() => updateView(view.documentId, { sections: [...viewSections(view), defaultSection()] }));
  };

  const removeSection = (view: View, index: number) => {
    const sections = viewSections(view).filter((_, i) => i !== index);
    if (sections.length === 0) return; // keep at least one
    run(() => updateView(view.documentId, { sections }));
  };

  const handleReorderSections = (view: View, orderedIds: string[]) => {
    const current = viewSections(view);
    // Ids carry the section's original index, so the new array is just a lookup
    // in the dragged order.
    const sections = orderedIds.map((id) => current[Number(id.split(":")[2])]);
    run(() => updateView(view.documentId, { sections }));
  };

  const toggleWorld = (view: View, index: number, worldId: string) => {
    const current = viewSections(view)[index].worlds;
    const worlds = current.includes(worldId)
      ? current.filter((id) => id !== worldId)
      : [...current, worldId];
    patchSection(view, index, { worlds });
  };

  if (loading) return <p>loading views…</p>;

  return (
    <div className="flex flex-col gap-6">
      <SortableProvider onDragEnd={handleDragEnd}>
        <SortableGroup groupKey="views" ids={ordered.map((v) => v.documentId)}>
        <ul aria-label="views" className="flex flex-col gap-2">
          {ordered.map((view) => {
            const multiSection = view.layout === "projects";
            return (
              <SortableRow
                key={view.documentId}
                id={view.documentId}
                className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-lg border border-base-300 p-3"
                handleLabel={`reorder ${view.name}`}
                disabled={busy}
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The name has a row to itself; the layout and delete share the next. */}
                    <Input
                      type="text"
                      className="min-w-0 basis-full"
                      defaultValue={view.name}
                      onBlur={(e) => handleRename(view, e.target.value)}
                      disabled={busy}
                      aria-label="view name"
                    />
                    <Select
                      fullWidth={false}
                      value={view.layout}
                      onChange={(e) => handleLayout(view, e.target.value as ViewLayout)}
                      disabled={busy}
                      aria-label="layout"
                    >
                      {LAYOUT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => handleDeleteView(view)} disabled={busy}>delete</button>
                  </div>

                  {/* Collapsed by default. Expanded inline, a view with several
                      sections is ~600px tall, which buries the list under
                      thousands of pixels of scroll in a 500px drawer — and makes
                      keyboard reordering fail outright, because
                      sortableKeyboardCoordinates can't move a row that dwarfs its
                      neighbor. Compact rows keep both usable. */}
                  <div>
                    <DisclosureToggle
                      expanded={expanded.has(view.documentId)}
                      onToggle={() => toggleExpanded(view.documentId)}
                      className="text-sm opacity-75"
                    >
                      {view.sections.length} section{view.sections.length === 1 ? "" : "s"}
                    </DisclosureToggle>
                    {expanded.has(view.documentId) && (
                    <SortableGroup
                      // Its own group, so a section drag can only ever resolve
                      // onto a sibling section — never onto a view row, which
                      // handleDragEnd would refuse.
                      groupKey={`sections:${view.documentId}`}
                      ids={view.sections.map((_, si) => sectionId(view.documentId, si))}
                    >
                      <ul aria-label={`sections of ${view.name}`} className="mt-2 flex flex-col gap-2">
                      {view.sections.map((section, si) => {
                        const input = sectionToInput(section);
                        const showWorlds = input.worldMode !== "all";
                        return (
                          <SortableRow
                            key={si}
                            id={sectionId(view.documentId, si)}
                            className="grid grid-cols-[auto_1fr] items-start gap-2 rounded border-l-[3px] border-base-300 bg-base-200 p-2"
                            handleLabel={`reorder section ${si + 1} of ${view.name}`}
                            disabled={busy || !multiSection || view.sections.length < 2}
                          >
                            <div className="flex min-w-0 flex-col gap-2">
                              {multiSection && (
                                <InlineField label="label">
                                  {/* Keyed by its own value: the row is keyed by
                                      index, so after a reorder React reuses this
                                      DOM node and an uncontrolled input ignores
                                      the new defaultValue — the selects (which
                                      are controlled) would swap while the label
                                      stayed put. The key forces a remount. */}
                                  <Input
                                    key={`${si}-${section.name ?? ""}`}
                                    type="text"
                                    className="min-w-0"
                                    placeholder="section label"
                                    defaultValue={section.name ?? ""}
                                    onBlur={(e) => patchSection(view, si, { name: e.target.value.trim() || undefined })}
                                    disabled={busy}
                                    aria-label="section label"
                                  />
                                </InlineField>
                              )}
                              <InlineField label="worlds">
                                <Select className="min-w-0" value={input.worldMode} onChange={(e) => patchSection(view, si, { worldMode: e.target.value as WorldMode })} disabled={busy} aria-label="worlds mode">
                                  {WORLD_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </Select>
                              </InlineField>
                              {showWorlds && (
                                <div className="flex flex-wrap gap-x-4 gap-y-2 sm:pl-[6.5rem]">
                                  {worlds.map((w) => (
                                    <Checkbox
                                      key={w.documentId}
                                      checked={input.worlds.includes(w.documentId)}
                                      onChange={() => toggleWorld(view, si, w.documentId)}
                                      disabled={busy}
                                    >
                                      {w.title}
                                    </Checkbox>
                                  ))}
                                </div>
                              )}
                              <InlineField label="importance">
                                <Select className="min-w-0" value={input.importance} onChange={(e) => patchSection(view, si, { importance: e.target.value as ViewSectionInput["importance"] })} disabled={busy} aria-label="importance">
                                  {IMPORTANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </Select>
                              </InlineField>
                              <InlineField label="project type">
                                <Select className="min-w-0" value={input.projectType} onChange={(e) => patchSection(view, si, { projectType: e.target.value as ViewSectionInput["projectType"] })} disabled={busy} aria-label="project type">
                                  {PROJECT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </Select>
                              </InlineField>
                              <InlineField label="recurrence">
                                <Select className="min-w-0" value={input.recurrence} onChange={(e) => patchSection(view, si, { recurrence: e.target.value as ViewSectionInput["recurrence"] })} disabled={busy} aria-label="recurrence">
                                  {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </Select>
                              </InlineField>
                              <Checkbox checked={input.longOnly} onChange={(e) => patchSection(view, si, { longOnly: e.target.checked })} disabled={busy}>
                                long only
                              </Checkbox>
                              {multiSection && view.sections.length > 1 && (
                                <button type="button" className="self-end" onClick={() => removeSection(view, si)} disabled={busy} aria-label="remove section">✕</button>
                              )}
                            </div>
                          </SortableRow>
                        );
                      })}
                      </ul>
                    </SortableGroup>
                    )}

                    {expanded.has(view.documentId) && multiSection && (
                      <button type="button" className="mt-2" onClick={() => addSection(view)} disabled={busy}>add section</button>
                    )}
                  </div>
                </div>
              </SortableRow>
            );
          })}
        </ul>
        </SortableGroup>
      </SortableProvider>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          className="min-w-0 flex-[1_1_8rem]"
          placeholder="new view"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          disabled={busy}
          aria-label="new view name"
        />
        <Select fullWidth={false} value={newLayout} onChange={(e) => setNewLayout(e.target.value as ViewLayout)} disabled={busy} aria-label="new view layout">
          {LAYOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <button type="button" onClick={handleAdd} disabled={busy || !newName.trim()}>add view</button>
      </div>
    </div>
  );
}

/** A section setting: its name in a column beside the control, or above it on a phone. */
function InlineField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:items-center sm:gap-2">
      <span className="text-sm opacity-75">{label}</span>
      {children}
    </label>
  );
}
