"use client";

import type { Project, ProjectType } from "@/app/types/index";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useWorlds } from "@/app/hooks/useWorlds";
import { useProjects } from "@/app/hooks/useProjects";

interface ProjectSelectorProps {
  value: string | null;
  onChange: (documentId: string | null, projectType: ProjectType | null) => void;
}

export default function ProjectSelector({
  value,
  onChange,
}: ProjectSelectorProps) {
  const { stuffProjectsEnabled } = useStuffProjects();
  const { worlds } = useWorlds();
  // The same ['projects'] query the task views read. This used to be its own fetch
  // on every mount of the form, holding a second copy of the list that a project
  // rename elsewhere would not reach.
  const { projects, loading } = useProjects();

  if (loading) {
    return (
      <select disabled>
        <option>Loading projects...</option>
      </select>
    );
  }

  // Group projects under the user's worlds (in position order), plus a trailing
  // "no world" group. When stuff projects are disabled, hide the stuff world.
  const visibleWorlds = stuffProjectsEnabled
    ? worlds
    : worlds.filter((w) => w.systemKey !== "stuff");
  const visibleProjects = stuffProjectsEnabled
    ? projects
    : projects.filter((p) => p.world?.systemKey !== "stuff");

  const projectsByWorldId = new Map<string, Project[]>();
  const noWorldProjects: Project[] = [];
  for (const project of visibleProjects) {
    const worldId = project.world?.documentId;
    if (!worldId) {
      noWorldProjects.push(project);
      continue;
    }
    if (!projectsByWorldId.has(worldId)) projectsByWorldId.set(worldId, []);
    projectsByWorldId.get(worldId)!.push(project);
  }
  projectsByWorldId.forEach((list) => list.sort((a, b) => a.title.localeCompare(b.title)));
  noWorldProjects.sort((a, b) => a.title.localeCompare(b.title));

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        const documentId = e.target.value || null;
        const project = projects.find((p) => p.documentId === documentId);
        onChange(documentId, project?.projectType ?? null);
      }}
    >
      <option value="">project</option>
      {visibleWorlds.map((world) => {
        const worldProjects = projectsByWorldId.get(world.documentId);
        if (!worldProjects || worldProjects.length === 0) return null;
        return (
          <optgroup key={world.documentId} label={world.title}>
            {worldProjects.map((project) => (
              <option key={project.documentId} value={project.documentId}>
                {project.title}
              </option>
            ))}
          </optgroup>
        );
      })}
      {noWorldProjects.length > 0 && (
        <optgroup key="no-world" label="no world">
          {noWorldProjects.map((project) => (
            <option key={project.documentId} value={project.documentId}>
              {project.title}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
