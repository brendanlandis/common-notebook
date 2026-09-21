'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type DrawerContent = 'task' | 'project' | 'projects' | 'worlds' | 'views' | null;

interface TaskActionsContextType {
  /** What the task actions drawer shows. Stays set while the drawer slides out. */
  drawerContent: DrawerContent;
  isOpen: boolean;
  openTaskForm: () => void;
  openProjectForm: () => void;
  openManageProjects: () => void;
  openWorlds: () => void;
  openViews: () => void;
  closeDrawer: () => void;
  /** For the drawer: it has finished closing, so what it showed can go. */
  onDrawerExited: () => void;
}

const TaskActionsContext = createContext<TaskActionsContextType | undefined>(undefined);

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = (content: Exclude<DrawerContent, null>) => {
    setDrawerContent(content);
    setIsOpen(true);
  };

  const openTaskForm = () => open('task');
  const openProjectForm = () => open('project');
  const openManageProjects = () => open('projects');
  const openWorlds = () => open('worlds');
  const openViews = () => open('views');

  const closeDrawer = () => setIsOpen(false);
  const onDrawerExited = () => setDrawerContent(null);

  return (
    <TaskActionsContext.Provider
      value={{
        drawerContent,
        isOpen,
        openTaskForm,
        openProjectForm,
        openManageProjects,
        openWorlds,
        openViews,
        closeDrawer,
        onDrawerExited,
      }}
    >
      {children}
    </TaskActionsContext.Provider>
  );
}

export function useTaskActions() {
  const context = useContext(TaskActionsContext);
  if (!context) {
    throw new Error('useTaskActions must be used within TaskActionsProvider');
  }
  return context;
}
