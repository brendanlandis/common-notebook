'use client';

import { useEffect } from 'react';
import { useTaskActions } from '../contexts/TaskActionsContext';

export default function EscapeKeyHandler() {
  const { closeDrawer } = useTaskActions();

  // Close all drawers on page load to prevent blank drawers after reload
  useEffect(() => {
    const taskActionsCheckbox = document.getElementById('taskActionsDrawer') as HTMLInputElement;
    const mainMenuCheckbox = document.getElementById('mainMenu') as HTMLInputElement;
    
    if (taskActionsCheckbox) {
      taskActionsCheckbox.checked = false;
    }
    if (mainMenuCheckbox) {
      mainMenuCheckbox.checked = false;
    }
  }, []); // Run once on mount

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Check if task actions drawer is open (left drawer)
        const taskActionsCheckbox = document.getElementById('taskActionsDrawer') as HTMLInputElement;
        const isTaskActionsOpen = taskActionsCheckbox?.checked;

        // Check if main menu is open (right drawer)
        const mainMenuCheckbox = document.getElementById('mainMenu') as HTMLInputElement;
        const isMainMenuOpen = mainMenuCheckbox?.checked;

        // Close whichever drawer is open
        if (isTaskActionsOpen) {
          closeDrawer();
        } else if (isMainMenuOpen) {
          mainMenuCheckbox.checked = false;
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleEscape);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeDrawer]);

  // This component doesn't render anything
  return null;
}

