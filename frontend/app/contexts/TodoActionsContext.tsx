'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type DrawerContent = 'todo' | 'project' | 'note' | null;

interface TodoActionsContextType {
  drawerContent: DrawerContent;
  openTodoForm: () => void;
  openProjectForm: () => void;
  openNoteForm: () => void;
  closeDrawer: () => void;
}

const TodoActionsContext = createContext<TodoActionsContextType | undefined>(undefined);

export function TodoActionsProvider({ children }: { children: ReactNode }) {
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

  const openTodoForm = () => {
    setDrawerContent('todo');
    // Open drawer
    const checkbox = document.getElementById('todoActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = true;
    }
  };
  
  const openProjectForm = () => {
    setDrawerContent('project');
    // Open drawer
    const checkbox = document.getElementById('todoActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = true;
    }
  };
  
  const openNoteForm = () => {
    setDrawerContent('note');
    // Open drawer
    const checkbox = document.getElementById('todoActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = true;
    }
  };
  
  const closeDrawer = () => {
    // Close drawer immediately
    const checkbox = document.getElementById('todoActionsDrawer') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = false;
    }
    // Clear content after animation completes (1 second delay)
    setTimeout(() => {
      setDrawerContent(null);
    }, 1000);
  };

  return (
    <TodoActionsContext.Provider value={{ drawerContent, openTodoForm, openProjectForm, openNoteForm, closeDrawer }}>
      {children}
    </TodoActionsContext.Provider>
  );
}

export function useTodoActions() {
  const context = useContext(TodoActionsContext);
  if (!context) {
    throw new Error('useTodoActions must be used within TodoActionsProvider');
  }
  return context;
}

