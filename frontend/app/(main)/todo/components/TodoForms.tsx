"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import TodoForm from "./TodoForm";
import ProjectForm from "./ProjectForm";
import { useTodoActions } from "@/app/contexts/TodoActionsContext";
import { useTodoData } from "../contexts/TodoDataContext";

// Renders the add/edit todo & project forms into the shared drawer
// (#drawer-form-container, hosted app-wide by TodoActionsDrawer). Mounted once
// per /todo route group via the layout, so create/edit is available on every
// todo page without each page re-wiring the portals.
export default function TodoForms() {
  const [drawerContainer, setDrawerContainer] = useState<HTMLElement | null>(
    null
  );
  const pathname = usePathname();
  const { drawerContent } = useTodoActions();
  const {
    editingTodo,
    editingProject,
    onSubmitTodo,
    onCancelTodoForm,
    onSubmitProject,
    onCancelProjectForm,
  } = useTodoData();

  useEffect(() => {
    // Re-resolve the drawer container after mount, on route changes, and each
    // time the drawer opens. It lives in the app-wide drawer (a different
    // layout level) and is (re)rendered per todo route, so a one-time capture
    // on mount can race the DOM commit — leaving the first open blank until the
    // portal target is resolved. Re-resolving on open makes it deterministic.
    setDrawerContainer(document.getElementById("drawer-form-container"));
  }, [pathname, drawerContent]);

  if (!drawerContainer) return null;

  return (
    <>
      {drawerContent === "todo" &&
        createPortal(
          <TodoForm
            key={editingTodo?.documentId || "new"}
            todo={editingTodo || undefined}
            onSubmit={onSubmitTodo}
            onCancel={onCancelTodoForm}
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
    </>
  );
}
