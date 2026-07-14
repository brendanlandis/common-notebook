"use client";

import { useEffect, useState } from "react";
import type { Project, World, ProjectType } from "@/app/types/index";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";

interface ProjectSelectorProps {
  value: string | null;
  onChange: (documentId: string | null, projectType: ProjectType | null) => void;
}

export default function ProjectSelector({
  value,
  onChange,
}: ProjectSelectorProps) {
  const { stuffProjectsEnabled } = useStuffProjects();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const result = await response.json();
      if (result.success) {
        setProjects(result.data);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <select disabled>
        <option>Loading projects...</option>
      </select>
    );
  }

  // Group projects by world (the "stuff" world holds the shopping/errands/
  // wishlist projects that used to be categories). When stuff projects are
  // disabled, hide the whole stuff world.
  const worldOrder: (World | null)[] = stuffProjectsEnabled
    ? ['make music', 'music admin', 'life stuff', 'day job', 'computer', 'stuff', null]
    : ['make music', 'music admin', 'life stuff', 'day job', 'computer', null];
  const visibleProjects = stuffProjectsEnabled
    ? projects
    : projects.filter((p) => p.world !== 'stuff');
  const projectsByWorld = visibleProjects.reduce((acc, project) => {
    const world = project.world || null;
    if (!acc[String(world)]) {
      acc[String(world)] = [];
    }
    acc[String(world)].push(project);
    return acc;
  }, {} as Record<string, Project[]>);

  // Sort projects alphabetically within each world
  Object.keys(projectsByWorld).forEach((world) => {
    projectsByWorld[world].sort((a, b) => a.title.localeCompare(b.title));
  });

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
      {worldOrder.map((world) => {
        const worldProjects = projectsByWorld[String(world)];
        if (!worldProjects || worldProjects.length === 0) return null;

        return (
          <optgroup key={String(world)} label={world || "no world"}>
            {worldProjects.map((project) => (
              <option key={project.documentId} value={project.documentId}>
                {project.title}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
