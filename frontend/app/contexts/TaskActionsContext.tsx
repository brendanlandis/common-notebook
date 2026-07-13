'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type DrawerContent = 'task' | 'project' | null;

interface TaskActionsContextType {
  drawerContent: DrawerContent;
  openTaskForm: () => void;
  openProjectForm: () => void;
  closeDrawer: () => void;
}

const TaskActionsContext = createContext<TaskActionsContextType | undefined>(undefined);

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

  const openTaskForm = () => {
    setDrawerContent('task');
    // Open drawer
    const checkbox = document.getElementById('taskActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = true;
    }
  };
  
  const openProjectForm = () => {
    setDrawerContent('project');
    // Open drawer
    const checkbox = document.getElementById('taskActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = true;
    }
  };
  
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
    <TaskActionsContext.Provider value={{ drawerContent, openTaskForm, openProjectForm, closeDrawer }}>
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

