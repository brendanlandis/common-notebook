'use client';

import { useEffect } from 'react';
import { useTodoActions } from '../../contexts/TodoActionsContext';

export default function EscapeKeyHandler() {
  const { closeDrawer } = useTodoActions();

  // Close all drawers on page load to prevent blank drawers after reload
  useEffect(() => {
    const todoActionsCheckbox = document.getElementById('todoActionsDrawer') as HTMLInputElement;
    const adminMenuCheckbox = document.getElementById('adminMenu') as HTMLInputElement;
    
    if (todoActionsCheckbox) {
      todoActionsCheckbox.checked = false;
    }
    if (adminMenuCheckbox) {
      adminMenuCheckbox.checked = false;
    }
  }, []); // Run once on mount

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Check if todo actions drawer is open (left drawer)
        const todoActionsCheckbox = document.getElementById('todoActionsDrawer') as HTMLInputElement;
        const isTodoActionsOpen = todoActionsCheckbox?.checked;

        // Check if admin menu is open (right drawer)
        const adminMenuCheckbox = document.getElementById('adminMenu') as HTMLInputElement;
        const isAdminMenuOpen = adminMenuCheckbox?.checked;

        // Close whichever drawer is open
        if (isTodoActionsOpen) {
          closeDrawer();
        } else if (isAdminMenuOpen) {
          adminMenuCheckbox.checked = false;
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

