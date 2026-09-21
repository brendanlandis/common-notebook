"use client";

import { useState, type ReactNode } from "react";
import type { Project, ProjectImportance } from "@/app/types/index";
import { useTasks } from "@/app/(main)/(todo)/hooks/useTasks";
import { useWorlds } from "@/app/(main)/(todo)/hooks/useWorlds";
import { useManageProjects } from "@/app/(main)/(todo)/hooks/useManageProjects";
import { useStuffProjects } from "@/app/(main)/(todo)/contexts/StuffProjectsContext";
import { saveStuffProjectsEnabledToStrapi } from "@/app/lib/stuffProjectsConfig";
import { doneCandidates, orderDoneCandidates, groupProjectsByWorld } from "@/app/lib/manageProjects";
import { swallow } from "@/app/lib/apiFetch";
import ProjectForm from "@/app/(main)/(todo)/components/ProjectForm";
import { Checkbox, Input, Select } from "@/app/components/ui/FormControls";
import DisclosureToggle from "@/app/components/ui/DisclosureToggle";

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
    <div className="flex flex-col gap-sections">
      {/* 1 ── Are these done yet? ─────────────────────────────────────────── */}
      <ManagerSection title="are these done yet?">
        {candidates.length === 0 ? (
          <Muted>nothing to review</Muted>
        ) : (
          <ul className="flex flex-col gap-rows">
            {candidates.map((p) => (
              <ProjectRow key={p.documentId} as="li" title={worldPrefixed(p)}>
                <button
                  type="button"
                  onClick={() => swallow("complete project", manage.completeProject(p.documentId))}
                  disabled={manage.busy}
                >
                  mark complete
                </button>
              </ProjectRow>
            ))}
          </ul>
        )}
      </ManagerSection>

      {/* 2 ── Importance ──────────────────────────────────────────────────── */}
      <ManagerSection title="importance">
        <div className="flex flex-col gap-lists">
          <div className="flex flex-col gap-heading">
            <h3 className="mb-0">top of mind</h3>
            {topOfMind ? (
              <ProjectRow title={worldPrefixed(topOfMind)}>
                <button
                  type="button"
                  onClick={() => setImportance(topOfMind.documentId, "normal")}
                  disabled={manage.busy}
                >
                  → normal
                </button>
              </ProjectRow>
            ) : (
              <Muted>none</Muted>
            )}
            <Select
              aria-label="set top of mind"
              value=""
              disabled={manage.busy}
              onChange={(e) => e.target.value && setImportance(e.target.value, "top of mind")}
            >
              <option value="">set top of mind…</option>
              {groupedOptions(projects.filter((p) => p.importance !== "top of mind"))}
            </Select>
          </div>

          <div className="flex flex-col gap-heading">
            <h3 className="mb-0">later</h3>
            {laterProjects.length === 0 ? (
              <Muted>none</Muted>
            ) : (
              <ul className="flex flex-col gap-rows">
                {laterProjects.map((p) => (
                  <ProjectRow key={p.documentId} as="li" title={worldPrefixed(p)}>
                    <button
                      type="button"
                      onClick={() => setImportance(p.documentId, "normal")}
                      disabled={manage.busy}
                    >
                      → normal
                    </button>
                  </ProjectRow>
                ))}
              </ul>
            )}
            <Select
              aria-label="add to later"
              value=""
              disabled={manage.busy}
              onChange={(e) => e.target.value && setImportance(e.target.value, "later")}
            >
              <option value="">add to later…</option>
              {groupedOptions(projects.filter((p) => p.importance !== "later"))}
            </Select>
          </div>
        </div>
      </ManagerSection>

      {/* 3 ── Manage all projects ─────────────────────────────────────────── */}
      <ManagerSection title="manage all projects">
        <Input
          type="text"
          className="min-w-0"
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
            <div key={group.key} className="flex flex-col gap-rows">
              <DisclosureToggle
                expanded={worldOpen}
                onToggle={() => toggleWorld(group.key)}
                className="w-full font-semibold opacity-80"
              >
                {group.label}
              </DisclosureToggle>
              {worldOpen && (
                <>
                  <ul className="flex flex-col gap-rows">
                    {shown.map((p) => (
                      <li key={p.documentId} className="flex flex-col gap-rows">
                        <DisclosureToggle
                          expanded={expanded.has(p.documentId)}
                          onToggle={() => toggleExpand(p.documentId)}
                          className="w-full"
                        >
                          {p.title}
                        </DisclosureToggle>
                        {expanded.has(p.documentId) && (
                          <div>
                            <ProjectForm
                              project={p}
                              onSubmit={(data) => handleSave(p, data)}
                              onCancel={() => collapse(p.documentId)}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!search3Lower && matched.length > shown.length && (
                    <button type="button" className="self-start text-small" onClick={() => loadMore(group.key)}>
                      load more
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </ManagerSection>

      {/* 4 ── Revive old projects ─────────────────────────────────────────── */}
      <ManagerSection title="revive old projects">
        <Input
          type="text"
          className="min-w-0"
          placeholder="search completed"
          value={search4}
          onChange={(e) => setSearch4(e.target.value)}
          aria-label="search completed projects"
        />
        {manage.completedLoading ? (
          <Muted>loading…</Muted>
        ) : manage.completedProjects.length === 0 ? (
          <Muted>none</Muted>
        ) : (
          <ul className="flex flex-col gap-rows">
            {manage.completedProjects.map((p) => (
              <ProjectRow key={p.documentId} as="li" title={p.title}>
                <button
                  type="button"
                  onClick={() => swallow("revive project", manage.reviveProject(p.documentId))}
                  disabled={manage.busy}
                >
                  revive
                </button>
              </ProjectRow>
            ))}
          </ul>
        )}
        {manage.hasMoreCompleted && (
          <button
            type="button"
            className="self-start text-small"
            onClick={() => manage.fetchMoreCompleted()}
            disabled={manage.fetchingMoreCompleted}
          >
            load more
          </button>
        )}
      </ManagerSection>

      {/* ── stuff projects (moved here from /settings) ─────────────────────── */}
      <ManagerSection title="stuff projects">
        <p className="m-0 text-small opacity-75">
          show the &quot;stuff&quot; world (shopping, errands, wishlist, and &quot;in the
          mail&quot; projects) and its view? turning this off hides them without deleting
          anything.
        </p>
        <Checkbox
          checked={stuffProjectsEnabled}
          onChange={handleStuffToggle}
          disabled={stuffSaving}
        />
      </ManagerSection>
    </div>
  );
}

function ManagerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-heading">
      <h3 className="m-0">{title}</h3>
      <div className="flex flex-col gap-rows">{children}</div>
    </section>
  );
}

/** A project's name, cut short if it has to be, with its one action at the right. */
function ProjectRow({
  as: Tag = "div",
  title,
  children,
}: {
  as?: "div" | "li";
  title: string;
  children: ReactNode;
}) {
  return (
    <Tag className="flex items-center gap-controls">
      <span className="min-w-0 flex-auto truncate">{title}</span>
      {children}
    </Tag>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="m-0 text-small opacity-60">{children}</p>;
}
