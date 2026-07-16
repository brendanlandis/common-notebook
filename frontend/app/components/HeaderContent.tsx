"use client";

import { usePathname } from "next/navigation";
import LayoutSelector from "../(main)/todo/components/LayoutSelector";
import PracticeSelector from "../(main)/practice/components/PracticeSelector";
import { getDefaultViewSlug } from "../lib/views";
import { useViews } from "../contexts/ViewsContext";
import { useStuffProjects } from "../contexts/StuffProjectsContext";
import { usePractice } from "../contexts/PracticeContext";
import { useTaskActions } from "../contexts/TaskActionsContext";
import { PlusCircleIcon, FolderSimplePlusIcon } from "@phosphor-icons/react";
import MoonPhaseIcon from "./MoonPhaseIcon";

export default function HeaderContent() {
  const pathname = usePathname();
  const { views } = useViews();
  const { stuffProjectsEnabled } = useStuffProjects();
  const { selectedPracticeType, setSelectedPracticeType } = usePractice();
  const { openTaskForm, openProjectForm } = useTaskActions();

  const handleResetMoonPhase = async () => {
    try {
      const response = await fetch("/api/reset-moon-phase", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Emit event to trigger task refresh without full page reload
          window.dispatchEvent(new CustomEvent('moon-phase-reset'));
        } else {
          console.error("Failed to reset moon phase:", result.error);
        }
      } else {
        console.error("Failed to reset moon phase:", response.statusText);
      }
    } catch (error) {
      console.error("Error resetting moon phase:", error);
    }
  };

  // Task pages (index + per-world / per-project routes) share one header. The
  // shared TaskForms drawer is mounted for the whole /todo route group, so the
  // add buttons work everywhere.
  if (pathname.startsWith("/todo")) {
    // Keep the picker in sync with the route: /todo shows the default view;
    // /todo/view/<slug> shows that view; /todo/world/<slug> shows that world's
    // option; a per-project route has no matching option, so it falls back to
    // the blank row. LayoutSelector navigates on change.
    const viewMatch = pathname.match(/^\/todo\/view\/(.+)$/);
    const worldMatch = pathname.match(/^\/todo\/world\/(.+)$/);
    const selectorValue =
      pathname === "/todo"
        ? getDefaultViewSlug(views, stuffProjectsEnabled)
        : viewMatch
          ? decodeURIComponent(viewMatch[1])
          : worldMatch
            ? `world:${decodeURIComponent(worldMatch[1])}`
            : "";
    return (
      <>
        <LayoutSelector value={selectorValue} />
        <button
          onClick={openTaskForm}
          className="tooltip tooltip-bottom"
          data-tip="add task"
        >
          <PlusCircleIcon size={25} />
        </button>
        <button
          onClick={openProjectForm}
          className="tooltip tooltip-bottom"
          data-tip="add project"
        >
          <FolderSimplePlusIcon size={25} />
        </button>
        <button
          className="moon-phase-icon tooltip tooltip-bottom"
          data-tip="declutter"
          onClick={handleResetMoonPhase}
        >
          <MoonPhaseIcon size={25} />
        </button>
      </>
    );
  }

  if (pathname === "/practice") {
    return (
      <PracticeSelector
        value={selectedPracticeType}
        onChange={setSelectedPracticeType}
      />
    );
  }

  // For home or other routes, return null (nothing displayed)
  return null;
}
