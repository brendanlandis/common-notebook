"use client";

import { usePathname, useRouter } from "next/navigation";
import LayoutSelector from "../(main)/todo/components/LayoutSelector";
import PracticeSelector from "../(main)/practice/components/PracticeSelector";
import { useLayoutRuleset } from "../contexts/LayoutRulesetContext";
import { usePractice } from "../contexts/PracticeContext";
import { useTaskActions } from "../contexts/TaskActionsContext";
import { PlusCircleIcon, FolderSimplePlusIcon } from "@phosphor-icons/react";
import MoonPhaseIcon from "./MoonPhaseIcon";

export default function HeaderContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedRulesetId, setSelectedRulesetId, isHydrated } =
    useLayoutRuleset();
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
    const isTaskIndex = pathname === "/todo";
    return (
      <>
        {isHydrated && (
          <LayoutSelector
            // On a world/project route the current view isn't a preset, so show
            // the blank row; picking a real view sets it and returns to /todo.
            value={isTaskIndex ? selectedRulesetId : ""}
            onChange={(id) => {
              if (!id) return;
              setSelectedRulesetId(id);
              if (!isTaskIndex) router.push("/todo");
            }}
          />
        )}
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
