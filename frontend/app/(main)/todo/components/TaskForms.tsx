"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import TaskForm from "./TaskForm";
import ProjectForm from "./ProjectForm";
import WorldsManager from "@/app/components/WorldsManager";
import ViewsManager from "@/app/components/ViewsManager";
import ProjectsManager from "@/app/components/ProjectsManager";
import { useTaskActions } from "@/app/contexts/TaskActionsContext";
import { useTaskData } from "../contexts/TaskDataContext";

// Renders the add/edit task & project forms into the shared drawer
// (#drawer-form-container, hosted app-wide by TaskActionsDrawer). Mounted once
// per /todo route group via the layout, so create/edit is available on every
// task page without each page re-wiring the portals.
export default function TaskForms() {
  const [drawerContainer, setDrawerContainer] = useState<HTMLElement | null>(
    null
  );
  const pathname = usePathname();
  const { drawerContent } = useTaskActions();
  const {
    editingTask,
    editingProject,
    onSubmitTask,
    onCancelTaskForm,
    onSubmitProject,
    onCancelProjectForm,
  } = useTaskData();

  useEffect(() => {
    // Re-resolve the drawer container after mount, on route changes, and each
    // time the drawer opens. It lives in the app-wide drawer (a different
    // layout level) and is (re)rendered per task route, so a one-time capture
    // on mount can race the DOM commit — leaving the first open blank until the
    // portal target is resolved. Re-resolving on open makes it deterministic.
    setDrawerContainer(document.getElementById("drawer-form-container"));
  }, [pathname, drawerContent]);

  if (!drawerContainer) return null;

  return (
    <>
      {drawerContent === "task" &&
        createPortal(
          <TaskForm
            key={editingTask?.documentId || "new"}
            task={editingTask || undefined}
            onSubmit={onSubmitTask}
            onCancel={onCancelTaskForm}
          />,
          drawerContainer
        )}

      {drawerContent === "project" &&
        createPortal(
          <ProjectForm
            key={editingProject?.documentId || "new"}
            project={editingProject || undefined}
            onSubmit={onSubmitProject}
            onCancel={onCancelProjectForm}
          />,
          drawerContainer
        )}

      {/* The managers own their data through useWorlds/useViews/useManageProjects,
          so unlike the forms above they need no props from TaskDataContext. */}
      {drawerContent === "worlds" && createPortal(<WorldsManager />, drawerContainer)}

      {drawerContent === "views" && createPortal(<ViewsManager />, drawerContainer)}

      {drawerContent === "projects" && createPortal(<ProjectsManager />, drawerContainer)}
    </>
  );
}
