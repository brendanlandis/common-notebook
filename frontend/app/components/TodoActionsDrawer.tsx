'use client';

import { usePathname } from 'next/navigation';
import { XIcon } from '@phosphor-icons/react';
import { useTodoActions } from '../contexts/TodoActionsContext';

export default function TodoActionsDrawer() {
  const pathname = usePathname();
  const { closeDrawer } = useTodoActions();
  
  // Show content on todo pages, but drawer-side must always be in DOM
  const showContent = pathname.startsWith('/todo');

  return (
    <div className="drawer-side">
      <div
        aria-label="close sidebar"
        className="drawer-overlay"
        onClick={closeDrawer}
      ></div>
      {showContent && (
        <div className="actions-drawer bg-base-200 text-base-content min-h-full p-4">
          <div className="main-menu-header mb-4">
            <button onClick={closeDrawer}>
              <XIcon size={40} weight="regular" />
            </button>
          </div>
          <div id="drawer-form-container">
            {/* Forms will be portaled here from the page */}
          </div>
        </div>
      )}
    </div>
  );
}

