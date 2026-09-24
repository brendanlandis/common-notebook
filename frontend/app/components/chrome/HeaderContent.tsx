"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import LayoutSelector from "@/app/(main)/(todo)/components/LayoutSelector";
import { getDefaultViewSlug } from "@/app/lib/views";
import { useViews } from "@/app/(main)/(todo)/hooks/useViews";
import { useStuffProjects } from "@/app/(main)/(todo)/contexts/StuffProjectsContext";
import { useTaskActions } from "@/app/(main)/(todo)/contexts/TaskActionsContext";
import {
  PlusCircleIcon,
  FolderSimplePlusIcon,
  FoldersIcon,
  PlanetIcon,
  SquaresFourIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import MoonPhaseIcon from "@/app/components/chrome/MoonPhaseIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiSend, swallow } from "@/app/lib/apiFetch";
import { TASKS_ROOT } from "@/app/(main)/(todo)/hooks/useTasks";
import { TOOLTIP } from "@/app/components/ui/tooltip";
import { HEADER_ICON, CARET_ICON, MOON_ICON } from "@/app/components/chrome/iconSizes";
import { isTodoPath } from "@/app/lib/pages";
import { prefersReducedMotion } from "@/app/lib/viewTransition";

/** How the manage cluster slides and its caret turns: at the site's one speed. */
const MOTION = "duration-(--transition-time) ease-[ease] motion-reduce:transition-none";

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
  const { openTaskForm, openProjectForm, openManageProjects, openWorlds, openViews } =
    useTaskActions();
  const queryClient = useQueryClient();

  // The "manage" buttons (worlds, views, manage projects) are set-and-forget
  // config, so they hide behind a small caret to keep the everyday actions (add
  // task, add project, declutter) uncluttered — revealed on hover where there is
  // a hover, and by pressing the caret everywhere.
  const [showManage, setShowManage] = useState(false);

  // They slide out from behind the caret, clipped while they move. Once they're
  // all the way out the clip comes off, or it would cut off their tooltips too.
  const [slidOut, setSlidOut] = useState(false);
  const openManage = () => {
    setShowManage(true);
    // Reduced motion means no slide, so no transitionend to wait for.
    if (prefersReducedMotion()) setSlidOut(true);
  };
  const closeManage = () => {
    setShowManage(false);
    setSlidOut(false);
  };

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

  // Task pages (home + per-view / per-world / per-project routes) share one
  // header. The shared TaskForms drawer is mounted on all of them, so the add
  // buttons work everywhere.
  if (isTodoPath(pathname)) {
    // Keep the picker in sync with the route: home shows the default view;
    // /view/<slug> shows that view; /world/<slug> shows that world's
    // option; a per-project route has no matching option, so it falls back to
    // the blank row. LayoutSelector navigates on change.
    const viewMatch = pathname.match(/^\/view\/(.+)$/);
    const worldMatch = pathname.match(/^\/world\/(.+)$/);
    const selectorValue =
      pathname === "/"
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
          className={TOOLTIP}
          data-tip="add task"
        >
          <PlusCircleIcon size={HEADER_ICON} />
        </button>
        <button
          onClick={openProjectForm}
          className={TOOLTIP}
          data-tip="add project"
        >
          <FolderSimplePlusIcon size={HEADER_ICON} />
        </button>
        <button
          className={`${TOOLTIP} [&_svg]:rounded-full [&_svg]:bg-base-content [&_svg]:text-base-100 dim:[&_svg]:bg-transparent dim:[&_svg]:text-base-content`}
          data-tip="declutter"
          onClick={handleResetMoonPhase}
        >
          <MoonPhaseIcon size={MOON_ICON} />
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
            the focus opened it and the resulting click closed it again.

            Hovering the caret opens it, and leaving the whole cluster closes
            it. The buttons' space is held while they're hidden (below), and
            hovering that empty space shouldn't bring them out. */}
        <div
          className="flex items-center"
          onPointerLeave={() => {
            if (canHover()) closeManage();
          }}
        >
          {/* The gap before the buttons is the caret's padding, so it counts
              as the caret: a bigger target than the caret alone. */}
          <button
            type="button"
            className="flex cursor-pointer items-center self-stretch pr-3"
            aria-label="more buttons"
            aria-expanded={showManage}
            onPointerEnter={() => {
              if (canHover()) openManage();
            }}
            onClick={() => (showManage ? closeManage() : openManage())}
          >
            {/* One caret that turns to point back, rather than two that swap. */}
            <CaretRightIcon
              size={CARET_ICON}
              weight="regular"
              className={`transition-[rotate] ${MOTION} ${showManage ? "rotate-180" : ""}`}
            />
          </button>
          {/* Always mounted, so it can slide shut as well as open, and always
              its full width, so the caret and its buttons wrap to a new line
              together. When the buttons took no room until shown, a caret at
              the end of a line opened on hover, wrapped to the next line out
              from under the pointer, closed, came back and opened again, in a
              loop. The buttons slide out from behind the caret into their
              space; the gap is outside the clip, so an icon half-way out
              doesn't touch the caret. Closed, it's inert: the hidden buttons
              can't be tabbed to or read out. */}
          <div className={slidOut ? "" : "overflow-hidden"} inert={!showManage}>
            <div
              className={`flex items-center gap-3 transition-[translate] ${MOTION} ${
                showManage ? "" : "-translate-x-full"
              }`}
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget && showManage) setSlidOut(true);
              }}
            >
              {/* aria-label as well as data-tip: these are icon-only buttons, so
                  the tooltip is the only thing naming them and it is presentation
                  — a screen reader announced three unlabeled buttons, and no
                  locator could address them by name either. */}
              <button
                onClick={openManageProjects}
                className={TOOLTIP}
                data-tip="manage projects"
                aria-label="manage projects"
              >
                <FoldersIcon size={HEADER_ICON} />
              </button>
              <button
                onClick={openWorlds}
                className={TOOLTIP}
                data-tip="manage worlds"
                aria-label="manage worlds"
              >
                <PlanetIcon size={HEADER_ICON} />
              </button>
              <button
                onClick={openViews}
                className={TOOLTIP}
                data-tip="manage views"
                aria-label="manage views"
              >
                <SquaresFourIcon size={HEADER_ICON} />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // /practice carries no header controls. It held a dropdown of the six
  // practice types, which is the enum that no longer exists — you pick what to
  // practice by pressing play on a piece of material, not by choosing a category
  // up here first.

  // For home or other routes, return null (nothing displayed)
  return null;
}
