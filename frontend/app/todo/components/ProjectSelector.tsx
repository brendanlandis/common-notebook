"use client";

import { useEffect, useState } from "react";
import type { Project, World, TodoCategory } from "@/app/types/admin";

interface ProjectSelectorProps {
  value: string | null;
  onChange: (documentId: string | null) => void;
}

export default function ProjectSelector({
  value,
  onChange,
}: ProjectSelectorProps) {
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

  // Group projects by world
  const worldOrder: (World | null)[] = ['make music', 'music admin', 'life stuff', 'day job', 'computer', null];
  const projectsByWorld = projects.reduce((acc, project) => {
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

  // Define all categories in order
  const categories: TodoCategory[] = [
    'home chores',
    'studio chores',
    'band chores',
    'life chores',
    'work chores',
    'web chores',
    'data chores',
    'computer chores',
    'in the mail',
    'buy stuff',
    'wishlist',
    'errands',
  ];

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
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
      <optgroup label="miscellany">
        {categories.map((category) => (
          <option key={category} value={`category:${category}`}>
            {category}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

