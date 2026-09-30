"use client";

import { XIcon } from "@phosphor-icons/react";
import TaskForm from "./TaskForm";
import PieceForm from "@/app/(main)/practice/components/PieceForm";
import { isPracticeMaterial } from "@/app/lib/reviewLists";
import ProjectForm from "./ProjectForm";
import WorldsManager from "@/app/(main)/(todo)/components/WorldsManager";
import ViewsManager from "@/app/(main)/(todo)/components/ViewsManager";
import ProjectsManager from "@/app/(main)/(todo)/components/ProjectsManager";
import Drawer, { DrawerClose, DRAWER_PANEL } from "@/app/components/ui/Drawer";
import DrawerHeader from "@/app/components/ui/DrawerHeader";
import { CONTROL_ICON } from "@/app/components/chrome/iconSizes";
import { useTaskActions } from "@/app/(main)/(todo)/contexts/TaskActionsContext";
import { useTaskData } from "../contexts/TaskDataContext";


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
    onDelete,
    onSubmitProject,
    onCancelProjectForm,
  } = useTaskData();

  // A piece of practice material gets its own form: no dates or recurrence, and a
  // place (rotation, shelf, on hold, learned) the task form can't say.
  const editingPiece = editingTask && isPracticeMaterial(editingTask) ? editingTask : null;

  const title =
    drawerContent === "task"
      ? editingPiece ? "edit piece" : editingTask ? "edit task" : "new task"
      : drawerContent === "project"
        ? editingProject ? "edit project" : "new project"
        : drawerContent
          ? `manage ${drawerContent}`
          : "task actions";

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && closeDrawer()}
      title={title}
      onExited={onDrawerExited}
    >
      <div className={`actions-drawer ${DRAWER_PANEL}`}>
        <DrawerHeader title={title}>
          <DrawerClose aria-label="close">
            <XIcon size={CONTROL_ICON} weight="regular" />
          </DrawerClose>
        </DrawerHeader>

        {drawerContent === "task" && editingPiece && (
          <PieceForm
            key={editingPiece.documentId}
            piece={editingPiece}
            onSubmit={onSubmitTask}
            onDelete={() => {
              if (onDelete(editingPiece.documentId)) closeDrawer();
            }}
          />
        )}

        {drawerContent === "task" && !editingPiece && (
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
