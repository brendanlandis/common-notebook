"use client";

import { useState } from "react";
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
  FoldersIcon,
  PlanetIcon,
  SquaresFourIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import MoonPhaseIcon from "./MoonPhaseIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, swallow } from "../lib/apiFetch";
import { TASKS_ROOT } from "../(main)/todo/hooks/useTasks";

/**
 * Can the pointing device on this machine hover?
 *
 * Asked of the device rather than inferred from an event, because synthetic
 * mouse events are unavoidable on touch screens — browsers emit them for
 * compatibility and automation dispatches them too. See the manage cluster
 * below, which is the reason this exists.
 *
 * Read at the moment of the event rather than held in state: it can change under
 * you (a tablet with a keyboard attached), and there is nothing to re-render
 * when it does.
 */
const canHover = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(hover: hover)").matches ?? true);

export default function HeaderContent() {
  const pathname = usePathname();
  const { views } = useViews();
  const { stuffProjectsEnabled } = useStuffProjects();
  const { selectedPracticeType, setSelectedPracticeType } = usePractice();
  const { openTaskForm, openProjectForm, openManageProjects, openWorlds, openViews } =
    useTaskActions();
  const queryClient = useQueryClient();

  // The "manage" buttons (worlds, views, manage projects) are set-and-forget
  // config, so they hide behind a small caret to keep the everyday actions (add
  // task, add project, declutter) uncluttered — revealed on hover where there is
  // a hover, and by pressing the caret everywhere.
  const [showManage, setShowManage] = useState(false);

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
          className="moon-phase-icon tooltip tooltip-bottom"
          data-tip="declutter"
          onClick={handleResetMoonPhase}
        >
          <MoonPhaseIcon size={25} />
        </button>
        {/* Hover to reveal on a mouse; press the caret anywhere else.

            The caret had no `onClick` at all — opening was `onMouseEnter` plus
            `onFocus`, which is no way in on a touch screen. It appeared to work
            on iOS only by accident, because WebKit focuses a button when you tap
            it and Chrome on Android does not: on an Android phone, manage
            projects, manage worlds and manage views could not be reached at all.

            The hover is gated on the *device*, not on the event's `pointerType`.
            That distinction is the whole fix. Synthetic mouse events are
            everywhere on touch devices — browsers emit them for compatibility,
            and automation dispatches them too — so a `pointerType === 'mouse'`
            guard still lets a phone open the cluster on "hover" and then close
            it again the moment the pointer appears to move, which unmounted the
            buttons in the middle of the press and meant no `click` was ever
            delivered. `(hover: hover)` asks the only question that matters: can
            this input device hover at all.

            `onFocus`/`onBlur` are deliberately gone. A keyboard user reaches the
            caret by tabbing and opens it with Enter or Space, which is a click —
            the same path as everyone else. Revealing on focus additionally meant
            the focus opened it and the resulting click closed it again. */}
        <div
          className="manage-cluster"
          onPointerEnter={() => {
            if (canHover()) setShowManage(true);
          }}
          onPointerLeave={() => {
            if (canHover()) setShowManage(false);
          }}
        >
          <button
            type="button"
            className="manage-caret"
            aria-label="more buttons"
            aria-expanded={showManage}
            onClick={() => setShowManage((open) => !open)}
          >
            {showManage ? (
              <CaretLeftIcon size={16} weight="bold" />
            ) : (
              <CaretRightIcon size={16} weight="bold" />
            )}
          </button>
          {showManage && (
            <div className="manage-buttons">
              {/* aria-label as well as data-tip: these are icon-only buttons, so
                  the tooltip is the only thing naming them and it is presentation
                  — a screen reader announced three unlabelled buttons, and no
                  locator could address them by name either. */}
              <button
                onClick={openManageProjects}
                className="tooltip tooltip-bottom"
                data-tip="manage projects"
                aria-label="manage projects"
              >
                <FoldersIcon size={25} />
              </button>
              <button
                onClick={openWorlds}
                className="tooltip tooltip-bottom"
                data-tip="manage worlds"
                aria-label="manage worlds"
              >
                <PlanetIcon size={25} />
              </button>
              <button
                onClick={openViews}
                className="tooltip tooltip-bottom"
                data-tip="manage views"
                aria-label="manage views"
              >
                <SquaresFourIcon size={25} />
              </button>
            </div>
          )}
        </div>
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
