import type { ReactNode } from "react";

/*
 * One column of a task view: a heading and its list.
 *
 * The rows are a subgrid, so every column's heading and first task line up
 * across the grid however long the headings wrap. Four views opt out — they are
 * one long list rather than a row of columns, and spanning two rows would leave
 * a gap where the second row's content isn't.
 *
 * `task-section` stays as a name because the browser specs and a unit test
 * address columns by it.
 */
const SECTION = [
  "task-section grid grid-cols-1 content-start items-start gap-4 [&_*]:break-words",
  "row-span-2 [grid-template-rows:subgrid]",
  "[.layout-everything_&]:row-auto [.layout-everything_&]:[grid-template-rows:none]",
  "[.layout-recurring_&]:row-auto [.layout-recurring_&]:[grid-template-rows:none]",
  "[.layout-chipping-away_&]:row-auto [.layout-chipping-away_&]:[grid-template-rows:none]",
  "[.layout-data-chores_&]:row-auto [.layout-data-chores_&]:[grid-template-rows:none]",
].join(" ");

/** The grid a view's columns sit in; the column counts live in task-grid.css. */
export function TaskGrid({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`tasks-container grid gap-x-8 gap-y-16 text-left ${className}`}>
      {children}
    </div>
  );
}

export default function TaskSection({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${SECTION} ${className}`}>{children}</div>;
}

/**
 * A column's heading. Its edit button appears on hover, or always on a touch
 * screen. The button sits inline after the title rather than in a flex row,
 * because a flex row would turn the heading trim's ::before/::after (type.css)
 * into flex items.
 */
export function TaskSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="group/heading mt-4 mb-0 text-left text-h3 [&_button]:ml-2 [&_button]:align-middle [&_button]:opacity-0 [&_button]:group-hover/heading:opacity-100 touch:[&_button]:opacity-100">
      {children}
    </h3>
  );
}

/** A column's tasks. */
export function TaskList({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <ul className={`tasks-list flex flex-col gap-2 ${className}`}>{children}</ul>;
}
