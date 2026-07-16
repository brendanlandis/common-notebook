"use client";

import { useState } from "react";
import type { View, ViewSection, ViewSectionInput, ViewLayout, WorldMode } from "@/app/types/index";
import { useViews } from "@/app/hooks/useViews";
import { useWorlds } from "@/app/hooks/useWorlds";
import {
  sortViewsByPosition,
  LAYOUT_OPTIONS,
  WORLD_MODE_OPTIONS,
  IMPORTANCE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
} from "@/app/lib/views";

// Create / rename / reorder / delete the user's task-list views, and compose
// each from a layout engine + one or more filtered sections. The two review
// presets (done, recurring) are code, not editable here.

const defaultSection = (): ViewSectionInput => ({
  worldMode: "all",
  worlds: [],
  importance: "any",
  projectType: "any",
  recurrence: "both",
  longOnly: false,
});

const sectionToInput = (s: ViewSection): ViewSectionInput => ({
  name: s.name ?? undefined,
  worldMode: s.worldMode,
  worlds: s.worlds.map((w) => w.documentId),
  importance: s.importance,
  projectType: s.projectType,
  recurrence: s.recurrence,
  longOnly: s.longOnly,
});

const viewSections = (view: View): ViewSectionInput[] => view.sections.map(sectionToInput);

export default function ViewsManager() {
  const { views, loading, createView, updateView, deleteView, reorderViews } = useViews();
  const { worlds } = useWorlds();
  const [newName, setNewName] = useState("");
  const [newLayout, setNewLayout] = useState<ViewLayout>("projects");
  const [busy, setBusy] = useState(false);

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

  const handleMoveView = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const order = ordered.map((v) => v.documentId);
    [order[index], order[target]] = [order[target], order[index]];
    run(() => reorderViews(order));
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

  const moveSection = (view: View, index: number, dir: -1 | 1) => {
    const sections = viewSections(view);
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
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
    <div className="views-manager">
      <ul className="views-list">
        {ordered.map((view, i) => {
          const multiSection = view.layout === "projects";
          return (
            <li key={view.documentId} className="view-row">
              <div className="view-row-header">
                <input
                  type="text"
                  defaultValue={view.name}
                  onBlur={(e) => handleRename(view, e.target.value)}
                  disabled={busy}
                  aria-label="view name"
                />
                <select
                  value={view.layout}
                  onChange={(e) => handleLayout(view, e.target.value as ViewLayout)}
                  disabled={busy}
                  aria-label="layout"
                >
                  {LAYOUT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => handleMoveView(i, -1)} disabled={busy || i === 0} aria-label="move up">↑</button>
                <button type="button" onClick={() => handleMoveView(i, 1)} disabled={busy || i === ordered.length - 1} aria-label="move down">↓</button>
                <button type="button" onClick={() => handleDeleteView(view)} disabled={busy}>delete</button>
              </div>

              <ul className="view-sections">
                {view.sections.map((section, si) => {
                  const input = sectionToInput(section);
                  const showWorlds = input.worldMode !== "all";
                  return (
                    <li key={si} className="view-section-row">
                      {multiSection && (
                        <input
                          type="text"
                          placeholder="section label"
                          defaultValue={section.name ?? ""}
                          onBlur={(e) => patchSection(view, si, { name: e.target.value.trim() || undefined })}
                          disabled={busy}
                          aria-label="section label"
                        />
                      )}
                      <select value={input.worldMode} onChange={(e) => patchSection(view, si, { worldMode: e.target.value as WorldMode })} disabled={busy} aria-label="worlds mode">
                        {WORLD_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {showWorlds && (
                        <span className="view-section-worlds">
                          {worlds.map((w) => (
                            <label key={w.documentId} className="settings-checkbox">
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={input.worlds.includes(w.documentId)}
                                onChange={() => toggleWorld(view, si, w.documentId)}
                                disabled={busy}
                              />
                              {w.title}
                            </label>
                          ))}
                        </span>
                      )}
                      <select value={input.importance} onChange={(e) => patchSection(view, si, { importance: e.target.value as ViewSectionInput["importance"] })} disabled={busy} aria-label="importance">
                        {IMPORTANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <select value={input.projectType} onChange={(e) => patchSection(view, si, { projectType: e.target.value as ViewSectionInput["projectType"] })} disabled={busy} aria-label="project type">
                        {PROJECT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <select value={input.recurrence} onChange={(e) => patchSection(view, si, { recurrence: e.target.value as ViewSectionInput["recurrence"] })} disabled={busy} aria-label="recurrence">
                        {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <label className="settings-checkbox">
                        <input type="checkbox" className="checkbox" checked={input.longOnly} onChange={(e) => patchSection(view, si, { longOnly: e.target.checked })} disabled={busy} />
                        long only
                      </label>
                      {multiSection && view.sections.length > 1 && (
                        <>
                          <button type="button" onClick={() => moveSection(view, si, -1)} disabled={busy || si === 0} aria-label="section up">↑</button>
                          <button type="button" onClick={() => moveSection(view, si, 1)} disabled={busy || si === view.sections.length - 1} aria-label="section down">↓</button>
                          <button type="button" onClick={() => removeSection(view, si)} disabled={busy} aria-label="remove section">✕</button>
                        </>
                      )}
                    </li>
                  );
                })}
                {multiSection && (
                  <li>
                    <button type="button" onClick={() => addSection(view)} disabled={busy}>add section</button>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="views-manager-add">
        <input
          type="text"
          placeholder="new view"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          disabled={busy}
          aria-label="new view name"
        />
        <select value={newLayout} onChange={(e) => setNewLayout(e.target.value as ViewLayout)} disabled={busy} aria-label="new view layout">
          {LAYOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" onClick={handleAdd} disabled={busy || !newName.trim()}>add view</button>
      </div>
    </div>
  );
}
