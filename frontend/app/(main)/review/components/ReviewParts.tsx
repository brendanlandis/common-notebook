import type { ComponentProps, ReactNode } from "react";
import { ArrowDownIcon } from "@phosphor-icons/react";
import type { ProjectGroup } from "@/app/lib/reviewLists";
import TaskPickList from "./TaskPickList";

/*
 * The pieces both review pages are built from.
 *
 * Deliberately plain. This feature exists for peace of mind rather than
 * productivity, so there is nothing here that signals urgency — no red, no
 * overdue styling, no counts styled as scores. The only color that carries
 * meaning is "yes, this one": a picked pill and a kept event share one fill.
 *
 * What stays in `review-calendar.css` is FullCalendar's DOM, the keyframes, and
 * the view-transition rules — things no element here can carry as a class.
 */

/** The page's column. */
export function ReviewPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[60rem] p-4">{children}</div>;
}

/**
 * A block of the page under an h2.
 *
 * `review-section` stays as a name because the review spec finds the picks by
 * `.review-section > .review-pick-list`.
 */
export function ReviewSection({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={`review-section my-8 ${className}`}>{children}</section>;
}

/**
 * The practice step, which comes first on both review pages.
 *
 * Set apart by a rule *below* it — it leads, so the line marks where practice
 * ends and the tasks begin. A rule and nothing else: practice is a different
 * question, not a more important one, and anything louder would make it look
 * like the urgent thing.
 */
export const PRACTICE_SECTION = "border-b border-current/15 pb-6";

/**
 * A project, over its pills.
 *
 * Sized and contrasted like a heading — it's what makes a long list navigable —
 * but in the body face: the display face is doing enough work at h1 and h2, and
 * a third size of it turns the page into a stack of signs. The first group sits
 * closer to the section's h2 than to the group before it, so the heading doesn't
 * float free of the list it names.
 */
export function ProjectGroupList({
  group,
  selected,
  onToggle,
}: {
  group: ProjectGroup;
  selected: Set<string>;
  onToggle: (documentId: string) => void;
}) {
  return (
    <div className="my-5 [.review-section>&:first-of-type]:mt-2">
      <h3 className="m-0 mb-[0.35rem]">
        {group.projectTitle ?? "incidentals"}
      </h3>
      <TaskPickList
        tasks={group.tasks}
        selected={selected}
        onToggle={onToggle}
        showProject={false}
      />
    </div>
  );
}

/** A quiet line: an empty list, or how much is left to decide. */
export function ReviewNote({ children }: { children: ReactNode }) {
  return <p className="italic opacity-60">{children}</p>;
}

/**
 * The project's name, trailing the task's.
 *
 * Inline, nested inside the title's span, so it follows the last word of a
 * wrapped title rather than sitting at the right edge of the widest line. On a
 * picked pill it takes the fill's foreground instead of dimming against it.
 */
export function PickProject({ children }: { children: ReactNode }) {
  return (
    <span className="ml-[0.4rem] text-small opacity-50 group-aria-pressed:opacity-80">
      {children}
    </span>
  );
}

/**
 * Send a picked thing back down to the pool.
 *
 * `ml-auto` puts every arrow at the same x — a column of arrows answering the
 * column of checkboxes. Quiet at rest and quieter than the task it belongs to:
 * an escape hatch, not a thing to look at. The practice rows and the task rows
 * share it, so the two halves of the column match.
 */
export function UnpickButton({ title, ...props }: { title: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="ml-auto inline-flex cursor-pointer items-center p-1 opacity-40 transition-opacity duration-(--transition-time) ease-[ease] hover:opacity-100 focus-visible:opacity-100"
      aria-label={`put ${title} back`}
      {...props}
    >
      <ArrowDownIcon aria-hidden="true" />
    </button>
  );
}

/**
 * The spinner over a grid still waiting on its feeds.
 *
 * Translucent: the days and hours underneath are already right and worth
 * reading. `z-[5]` puts it over FullCalendar's own z-indexed furniture, which
 * otherwise drew grid lines through it. Sized and colored explicitly, because
 * daisyUI's default is a faint 1.5rem smudge over a cream grid.
 */
export function CalendarLoading() {
  return (
    <div
      className="absolute inset-0 z-[5] flex items-center justify-center bg-base-100/65"
      role="status"
    >
      <span className="loading loading-spinner size-12 text-base-content" aria-hidden="true" />
      <span className="sr-only">fetching your calendars</span>
    </div>
  );
}

/**
 * The grid's frame. Named for view transitions (`review-grid`) so the grid
 * animates as itself rather than warping with the page's root snapshot when a
 * pick changes the page's height. `review-calendar-frame` is the hook the cycle
 * slide's keyframes hang on.
 */
export const CALENDAR_FRAME = "review-calendar-frame relative [view-transition-name:review-grid]";
