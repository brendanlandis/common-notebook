"use client";

import { XIcon } from "@phosphor-icons/react";
import TaskForm from "./TaskForm";
import ProjectForm from "./ProjectForm";
import WorldsManager from "@/app/(main)/(todo)/components/WorldsManager";
import ViewsManager from "@/app/(main)/(todo)/components/ViewsManager";
import ProjectsManager from "@/app/(main)/(todo)/components/ProjectsManager";
import Drawer, { DrawerClose } from "@/app/components/ui/Drawer";
import DrawerHeader from "@/app/components/ui/DrawerHeader";
import { useTaskActions } from "@/app/(main)/(todo)/contexts/TaskActionsContext";
import { useTaskData } from "../contexts/TaskDataContext";

const TITLES = {
  task: "task",
  project: "project",
  projects: "manage projects",
  worlds: "manage worlds",
  views: "manage views",
} as const;

// The task actions drawer: the add/edit task and project forms and the three
// managers, opened from the task header. Mounted once per task route by
// TaskShell, so create/edit is available on every task page.
export default function TaskForms() {
  const { drawerContent, isOpen, closeDrawer, onDrawerExited } =
    useTaskActions();
  const {
    editingTask,
    editingProject,
    onSubmitTask,
    onCancelTaskForm,
    onSubmitProject,
    onCancelProjectForm,
  } = useTaskData();

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && closeDrawer()}
      title={drawerContent ? TITLES[drawerContent] : "task actions"}
      onExited={onDrawerExited}
    >
      <div className="actions-drawer min-h-full w-screen bg-base-300 p-4 text-base-content min-[500px]:w-[500px]">
        <DrawerHeader>
          <DrawerClose aria-label="close">
            <XIcon size={40} weight="regular" />
          </DrawerClose>
        </DrawerHeader>

        {drawerContent === "task" && (
          <TaskForm
            key={editingTask?.documentId || "new"}
            task={editingTask || undefined}
            onSubmit={onSubmitTask}
            onCancel={onCancelTaskForm}
          />
        )}

        {drawerContent === "project" && (
          <ProjectForm
            key={editingProject?.documentId || "new"}
            project={editingProject || undefined}
            onSubmit={onSubmitProject}
            onCancel={onCancelProjectForm}
          />
        )}

        {/* The managers own their data through useWorlds/useViews/useManageProjects,
            so unlike the forms above they need no props from TaskDataContext. */}
        {drawerContent === "worlds" && <WorldsManager />}
        {drawerContent === "views" && <ViewsManager />}
        {drawerContent === "projects" && <ProjectsManager />}
      </div>
    </Drawer>
  );
}
