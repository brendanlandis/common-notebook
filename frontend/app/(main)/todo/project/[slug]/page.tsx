"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "@phosphor-icons/react";
import type { LayoutRuleset, Project, Task } from "@/app/types/index";
import { transformLayout } from "@/app/lib/layoutTransformers";
import TaskSections from "../../components/TaskSections";
import FaviconManager from "@/app/components/FaviconManager";
import { useTaskData } from "../../contexts/TaskDataContext";
import { buildRawTaskData } from "../../utils/buildRawTaskData";

export default function ProjectPage() {
  const params = useParams<{ slug: string }>();
  const slugOrId = params.slug;

  const {
    grouped,
    loading,
    error,
    onComplete,
    onEdit,
    onDelete,
    onWorkSession,
    onRemoveWorkSession,
    onSkipRecurring,
    onEditProject,
  } = useTaskData();

  // Resolve the project by slug first, falling back to documentId so any older
  // documentId-based links keep working. Metadata rides along on the loaded
  // tasks' populated `project` relation (empty projects won't resolve — a v1
  // limitation, reachable only by clicking a project that has tasks).
  const project: Project | null = useMemo(() => {
    const all = [
      ...grouped.projects,
      ...grouped.recurringProjects,
      ...grouped.allRecurringProjects,
    ];
    return all.find((p) => p.slug === slugOrId || p.documentId === slugOrId) || null;
  }, [grouped, slugOrId]);

  const documentId = project?.documentId;

  // Reuse the engine to filter/sort just this project's tasks (recurring +
  // non-recurring merged), honoring the same visibility rules as everywhere.
  const projectTasks: Task[] = useMemo(() => {
    if (!documentId) return [];
    const ruleset: LayoutRuleset = {
      id: "project-view",
      name: project?.title || "project",
      showRecurring: true,
      showNonRecurring: true,
      visibleWorlds: null,
      visibleCategories: null,
      visibleProjects: [documentId],
      sortBy: "creationDate",
      groupBy: "merged",
    };
    const transformed = transformLayout(buildRawTaskData(grouped), ruleset);
    const section = (transformed.allSections || []).find(
      (s) => "documentId" in s && s.documentId === documentId
    );
    return section && "documentId" in section ? section.tasks || [] : [];
  }, [grouped, documentId, project?.title]);

  if (loading) {
    return (
      <div id="container-task" className="layout-project-view" suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="container-task" className="layout-project-view" suppressHydrationWarning>
        <p>error: {error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div id="container-task" className="layout-project-view" suppressHydrationWarning>
        <p>
          project not found, or it has no active tasks.{" "}
          <Link href="/todo">back to to do</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <FaviconManager type="broom" />
      <div id="container-task" className="layout-project-view" suppressHydrationWarning>
        <div className="project-view-header">
          <h1>
            {project.title}
            <button
              onClick={() => onEditProject(project)}
              className="tooltip tooltip-bottom"
              data-tip="edit project"
            >
              <PencilIcon size={20} />
            </button>
          </h1>
          {project.world && (
            <Link href={`/todo/world/${encodeURIComponent(project.world)}`}>
              {project.world}
            </Link>
          )}
        </div>

        {projectTasks.length > 0 ? (
          <TaskSections
            sections={[{ title: "all tasks", tasks: projectTasks }]}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onWorkSession={onWorkSession}
            onRemoveWorkSession={onRemoveWorkSession}
            onSkipRecurring={onSkipRecurring}
          />
        ) : (
          <p>nothin' to do in this project</p>
        )}
      </div>
    </>
  );
}
