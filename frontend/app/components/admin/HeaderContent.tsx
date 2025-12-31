"use client";

import { usePathname } from "next/navigation";
import LayoutSelector from "../../todo/components/LayoutSelector";
import PracticeSelector from "../../practice/components/PracticeSelector";
import { useLayoutRuleset } from "../../contexts/LayoutRulesetContext";
import { usePractice } from "../../contexts/PracticeContext";
import { useTodoActions } from "../../contexts/TodoActionsContext";
import { PlusCircleIcon, FolderSimplePlusIcon } from "@phosphor-icons/react";
import MoonPhaseIcon from "../MoonPhaseIcon";

export default function HeaderContent() {
  const pathname = usePathname();
  const { selectedRulesetId, setSelectedRulesetId, isHydrated } = useLayoutRuleset();
  const { selectedPracticeType, setSelectedPracticeType } = usePractice();
  const { openTodoForm, openProjectForm, openNoteForm } = useTodoActions();

  const handleResetMoonPhase = async () => {
    try {
      const response = await fetch("/api/reset-moon-phase", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          window.location.reload();
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

  if (pathname === "/todo") {
    return (
      <>
        {isHydrated && (
          <LayoutSelector
            value={selectedRulesetId}
            onChange={setSelectedRulesetId}
          />
        )}
        <button onClick={openTodoForm}>
          <PlusCircleIcon size={25} />
        </button>
        <button onClick={openProjectForm}>
          <FolderSimplePlusIcon size={25} />
        </button>
        <button className="moon-phase-icon" onClick={handleResetMoonPhase}>
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

  if (pathname === "/notes") {
    return (
      <button onClick={openNoteForm}>
        <PlusCircleIcon size={25} />
      </button>
    );
  }

  // For home or other routes, return null (nothing displayed)
  return null;
}
