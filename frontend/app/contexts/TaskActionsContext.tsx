'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type DrawerContent = 'task' | 'project' | 'worlds' | 'views' | null;

interface TaskActionsContextType {
  drawerContent: DrawerContent;
  openTaskForm: () => void;
  openProjectForm: () => void;
  openWorlds: () => void;
  openViews: () => void;
  closeDrawer: () => void;
}

const TaskActionsContext = createContext<TaskActionsContextType | undefined>(undefined);

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

  const open = (content: Exclude<DrawerContent, null>) => {
    setDrawerContent(content);
    const checkbox = document.getElementById('taskActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = true;
    }
  };

  const openTaskForm = () => open('task');
  const openProjectForm = () => open('project');
  const openWorlds = () => open('worlds');
  const openViews = () => open('views');

  const closeDrawer = () => {
    // Close drawer immediately
    const checkbox = document.getElementById('taskActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = false;
    }
    // Clear content after animation completes (1 second delay)
    setTimeout(() => {
      setDrawerContent(null);
    }, 1000);
  };

  return (
    <TaskActionsContext.Provider value={{ drawerContent, openTaskForm, openProjectForm, openWorlds, openViews, closeDrawer }}>
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

