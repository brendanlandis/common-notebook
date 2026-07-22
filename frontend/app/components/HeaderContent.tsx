"use client";

import { usePathname } from "next/navigation";
import LayoutSelector from "../(main)/todo/components/LayoutSelector";
import PracticeSelector from "../(main)/practice/components/PracticeSelector";
import { getDefaultViewSlug } from "../lib/views";
import { useViews } from "../hooks/useViews";
import { useStuffProjects } from "../contexts/StuffProjectsContext";
import { usePractice } from "../contexts/PracticeContext";
import { useTaskActions } from "../contexts/TaskActionsContext";
import {
  PlusCircleIcon,
  FolderSimplePlusIcon,
  PlanetIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import MoonPhaseIcon from "./MoonPhaseIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, swallow } from "../lib/apiFetch";
import { TASKS_ROOT } from "../(main)/todo/hooks/useTasks";

export default function HeaderContent() {
  const pathname = usePathname();
  const { views } = useViews();
  const { stuffProjectsEnabled } = useStuffProjects();
  const { selectedPracticeType, setSelectedPracticeType } = usePractice();
  const { openTaskForm, openProjectForm, openWorlds, openViews } = useTaskActions();
  const queryClient = useQueryClient();

  // Resetting the moon phase changes which tasks are due, so the lists have to be
  // re-read. This header sits outside TaskDataProvider and so had no way to call
  // refetch — it dispatched a `moon-phase-reset` CustomEvent that useTasks listened
  // for. The cache is the shared state now, so the bus is just an invalidate, and
  // one keyed on the ['tasks'] root refreshes every list rather than only the one
  // the old listener knew about.
  const resetMoonPhaseMutation = useMutation({
    mutationFn: () => apiSend("/api/reset-moon-phase", "POST"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_ROOT }),
  });

  const handleResetMoonPhase = () =>
    swallow("reset moon phase", resetMoonPhaseMutation.mutateAsync());

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
          onClick={openWorlds}
          className="tooltip tooltip-bottom"
          data-tip="worlds"
        >
          <PlanetIcon size={25} />
        </button>
        <button
          onClick={openViews}
          className="tooltip tooltip-bottom"
          data-tip="views"
        >
          <SquaresFourIcon size={25} />
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
