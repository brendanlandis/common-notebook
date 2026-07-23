"use client";

import { useState } from "react";
import type { Project, ProjectImportance } from "@/app/types/index";
import { useTasks } from "@/app/(main)/todo/hooks/useTasks";
import { useWorlds } from "@/app/hooks/useWorlds";
import { useManageProjects } from "@/app/hooks/useManageProjects";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { saveStuffProjectsEnabledToStrapi } from "@/app/lib/stuffProjectsConfig";
import { doneCandidates, orderDoneCandidates, groupProjectsByWorld } from "@/app/lib/manageProjects";
import { swallow } from "@/app/lib/apiFetch";
import ProjectForm from "@/app/(main)/todo/components/ProjectForm";

const PER_WORLD = 10; // section 3: rows shown per world before "load more"

// The Manage Projects drawer. Four sections:
//   1. "Are these done yet?"   — projects with no incomplete task → mark complete
//   2. "Importance"            — the single top-of-mind slot + the Later list
//   3. "Manage all projects"   — every incomplete project, by world, expand to edit
//   4. "Revive old projects"   — completed projects, paged, → revive
//
// Sections 1-3 read the already-loaded task/project caches (useTasks); section 4
// and every write go through useManageProjects. See that hook for why writes
// invalidate rather than optimistically patch.
export default function ProjectsManager() {
  const { grouped, tasks, loading } = useTasks();
  const { worlds } = useWorlds();
  const { stuffProjectsEnabled, setStuffProjectsEnabled } = useStuffProjects();

  const [search3, setSearch3] = useState("");
  const [search4, setSearch4] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedWorlds, setExpandedWorlds] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Record<string, number>>({});
  const [stuffSaving, setStuffSaving] = useState(false);

  const manage = useManageProjects(search4);

  if (loading) return <p>loading projects…</p>;

  // "stuff"-world projects (wishlist / errands / …) are a special kind and are
  // managed elsewhere — exclude them from sections 1-3.
  const stuffWorldId = worlds.find((w) => w.systemKey === "stuff")?.documentId;
  const projects = grouped.projects.filter(
    (p) => !stuffWorldId || p.world?.documentId !== stuffWorldId
  );

  const candidates = orderDoneCandidates(
    doneCandidates(projects, tasks),
    manage.recentlyCompletedTasks
  );
  const topOfMind = projects.find((p) => p.importance === "top of mind") ?? null;
  const laterProjects = projects.filter((p) => p.importance === "later");
  const worldGroups = groupProjectsByWorld(projects, worlds);

  const setImportance = (documentId: string, importance: ProjectImportance) =>
    swallow("set importance", manage.setImportance(documentId, importance));

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const collapse = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const toggleWorld = (key: string) =>
    setExpandedWorlds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleSave = async (project: Project, data: unknown) => {
    await manage.saveProject(project.documentId, data as Record<string, unknown>);
    collapse(project.documentId);
  };

  const loadMore = (key: string) =>
    setVisible((v) => ({ ...v, [key]: (v[key] ?? PER_WORLD) + PER_WORLD }));

  const handleStuffToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setStuffProjectsEnabled(next);
    setStuffSaving(true);
    const ok = await saveStuffProjectsEnabledToStrapi(next);
    if (!ok) console.error("Failed to save enable-stuff-projects setting");
    setStuffSaving(false);
  };

  // A project label prefixed by its world, e.g. "make music: tethers lp4".
  const worldPrefixed = (p: Project) => (p.world?.title ? `${p.world.title}: ${p.title}` : p.title);

  // Importance-tier <select> options, grouped into <optgroup>s by world.
  const groupedOptions = (list: Project[]) =>
    groupProjectsByWorld(list, worlds).map((g) => (
      <optgroup key={g.key} label={g.label}>
        {g.projects.map((p) => (
          <option key={p.documentId} value={p.documentId}>
            {p.title}
          </option>
        ))}
      </optgroup>
    ));

  const search3Lower = search3.trim().toLowerCase();

  return (
    <div className="projects-manager manager">
      {/* 1 ── Are these done yet? ─────────────────────────────────────────── */}
      <section className="pm-section">
        <h3>are these done yet?</h3>
        {candidates.length === 0 ? (
          <p className="pm-empty">nothing to review</p>
        ) : (
          <ul className="manager-list">
            {candidates.map((p) => (
              <li key={p.documentId} className="pm-row">
                <span className="pm-title">{worldPrefixed(p)}</span>
                <button
                  type="button"
                  onClick={() => swallow("complete project", manage.completeProject(p.documentId))}
                  disabled={manage.busy}
                >
                  mark complete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2 ── Importance ──────────────────────────────────────────────────── */}
      <section className="pm-section">
        <h3>importance</h3>

        <div className="pm-tier">
          <h4>top of mind</h4>
          {topOfMind ? (
            <div className="pm-row">
              <span className="pm-title">{worldPrefixed(topOfMind)}</span>
              <button
                type="button"
                onClick={() => setImportance(topOfMind.documentId, "normal")}
                disabled={manage.busy}
              >
                → normal
              </button>
            </div>
          ) : (
            <p className="pm-empty">none</p>
          )}
          <select
            aria-label="set top of mind"
            value=""
            disabled={manage.busy}
            onChange={(e) => e.target.value && setImportance(e.target.value, "top of mind")}
          >
            <option value="">set top of mind…</option>
            {groupedOptions(projects.filter((p) => p.importance !== "top of mind"))}
          </select>
        </div>

        <div className="pm-tier">
          <h4>later</h4>
          {laterProjects.length === 0 ? (
            <p className="pm-empty">none</p>
          ) : (
            <ul className="manager-list">
              {laterProjects.map((p) => (
                <li key={p.documentId} className="pm-row">
                  <span className="pm-title">{worldPrefixed(p)}</span>
                  <button
                    type="button"
                    onClick={() => setImportance(p.documentId, "normal")}
                    disabled={manage.busy}
                  >
                    → normal
                  </button>
                </li>
              ))}
            </ul>
          )}
          <select
            aria-label="add to later"
            value=""
            disabled={manage.busy}
            onChange={(e) => e.target.value && setImportance(e.target.value, "later")}
          >
            <option value="">add to later…</option>
            {groupedOptions(projects.filter((p) => p.importance !== "later"))}
          </select>
        </div>
      </section>

      {/* 3 ── Manage all projects ─────────────────────────────────────────── */}
      <section className="pm-section">
        <h3>manage all projects</h3>
        <input
          type="text"
          className="pm-search"
          placeholder="search projects"
          value={search3}
          onChange={(e) => setSearch3(e.target.value)}
          aria-label="search projects"
        />
        {worldGroups.map((group) => {
          const matched = search3Lower
            ? group.projects.filter((p) => p.title.toLowerCase().includes(search3Lower))
            : group.projects;
          if (matched.length === 0) return null;
          const cap = visible[group.key] ?? PER_WORLD;
          const shown = search3Lower ? matched : matched.slice(0, cap);
          // Each world is an accordion. A search force-opens every matching world;
          // otherwise the world respects its own collapse state (collapsed default).
          const worldOpen = !!search3Lower || expandedWorlds.has(group.key);
          return (
            <div key={group.key} className="pm-world-group pm-disclosure">
              <button
                type="button"
                className="sections-toggle pm-world-toggle"
                aria-expanded={worldOpen}
                onClick={() => toggleWorld(group.key)}
              >
                {group.label}
              </button>
              {worldOpen && (
                <>
                  <ul className="manager-list">
                    {shown.map((p) => (
                      <li key={p.documentId} className="pm-disclosure">
                        <button
                          type="button"
                          className="sections-toggle"
                          aria-expanded={expanded.has(p.documentId)}
                          onClick={() => toggleExpand(p.documentId)}
                        >
                          {p.title}
                        </button>
                        {expanded.has(p.documentId) && (
                          <ProjectForm
                            project={p}
                            onSubmit={(data) => handleSave(p, data)}
                            onCancel={() => collapse(p.documentId)}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                  {!search3Lower && matched.length > shown.length && (
                    <button type="button" className="pm-more" onClick={() => loadMore(group.key)}>
                      load more
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </section>

      {/* 4 ── Revive old projects ─────────────────────────────────────────── */}
      <section className="pm-section">
        <h3>revive old projects</h3>
        <input
          type="text"
          className="pm-search"
          placeholder="search completed"
          value={search4}
          onChange={(e) => setSearch4(e.target.value)}
          aria-label="search completed projects"
        />
        {manage.completedLoading ? (
          <p className="pm-empty">loading…</p>
        ) : manage.completedProjects.length === 0 ? (
          <p className="pm-empty">none</p>
        ) : (
          <ul className="manager-list">
            {manage.completedProjects.map((p) => (
              <li key={p.documentId} className="pm-row">
                <span className="pm-title">{p.title}</span>
                <button
                  type="button"
                  onClick={() => swallow("revive project", manage.reviveProject(p.documentId))}
                  disabled={manage.busy}
                >
                  revive
                </button>
              </li>
            ))}
          </ul>
        )}
        {manage.hasMoreCompleted && (
          <button
            type="button"
            className="pm-more"
            onClick={() => manage.fetchMoreCompleted()}
            disabled={manage.fetchingMoreCompleted}
          >
            load more
          </button>
        )}
      </section>

      {/* ── stuff projects (moved here from /settings) ─────────────────────── */}
      <section className="pm-section">
        <h3>stuff projects</h3>
        <p className="pm-note">
          show the &quot;stuff&quot; world (shopping, errands, wishlist, and &quot;in the
          mail&quot; projects) and its view? turning this off hides them without deleting
          anything.
        </p>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            className="checkbox"
            checked={stuffProjectsEnabled}
            onChange={handleStuffToggle}
            disabled={stuffSaving}
          />
        </label>
      </section>
    </div>
  );
}
