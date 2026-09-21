'use client';

import { usePathname } from 'next/navigation';
import { isTodoPath } from '@/app/lib/pages';
import { XIcon } from '@phosphor-icons/react';
import DrawerHeader from "./DrawerHeader";
import { useTaskActions } from '../contexts/TaskActionsContext';

export default function TaskActionsDrawer() {
  const pathname = usePathname();
  const { closeDrawer } = useTaskActions();
  
  // Show content on task pages, but drawer-side must always be in DOM
  const showContent = isTodoPath(pathname);

  return (
    <div className="drawer-side z-5">
      <div
        aria-label="close sidebar"
        className="drawer-overlay"
        onClick={closeDrawer}
      ></div>
      {showContent && (
        <div className="actions-drawer min-h-full w-full bg-base-300 p-4 text-base-content min-[500px]:w-[500px]">
          <DrawerHeader>
            <button onClick={closeDrawer}>
              <XIcon size={40} weight="regular" />
            </button>
          </DrawerHeader>
          <div id="drawer-form-container">
            {/* Forms will be portaled here from the page */}
          </div>
        </div>
      )}
    </div>
  );
}

