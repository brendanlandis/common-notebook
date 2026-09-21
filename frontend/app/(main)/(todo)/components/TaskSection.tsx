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
  "task-section mb-blocks grid grid-cols-1 content-start items-start gap-heading [&_*]:break-words",
  "row-span-2 [grid-template-rows:subgrid]",
  "[.layout-everything_&]:row-auto [.layout-everything_&]:[grid-template-rows:none]",
  "[.layout-recurring_&]:row-auto [.layout-recurring_&]:[grid-template-rows:none]",
  "[.layout-chipping-away_&]:row-auto [.layout-chipping-away_&]:[grid-template-rows:none]",
  "[.layout-data-chores_&]:row-auto [.layout-data-chores_&]:[grid-template-rows:none]",
].join(" ");

/**
 * The grid a view's columns sit in; the column counts live in task-grid.css.
 *
 * No row gap: the space between one row of columns and the next is each
 * column's bottom margin. A column's rows are a subgrid of these, and a subgrid
 * whose own gap (a heading's 8px) is smaller than its parent's makes up the
 * difference with negative margins, which can't shrink a short heading's row
 * below nothing: a label or a phone-sized heading got 17px under it instead.
 */
export function TaskGrid({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`tasks-container grid gap-x-columns text-left ${className}`}>
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
 *
 * Columns under a group's name (home's "recurring") are a level below it, so
 * their headings are labels, `as="h3"`.
 */
export function TaskSectionHeading({
  as: Heading = "h2",
  children,
}: {
  as?: "h2" | "h3";
  children: ReactNode;
}) {
  return (
    <Heading className="group/heading mb-0 text-left [&_button]:ml-2 [&_button]:align-middle [&_button]:opacity-0 [&_button]:group-hover/heading:opacity-100 touch:[&_button]:opacity-100">
      {children}
    </Heading>
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
  return <ul className={`tasks-list flex flex-col gap-rows ${className}`}>{children}</ul>;
}

/**
 * Labeled lists stacked in one column: the done view's months and upcoming
 * days, the recurring review's projects.
 */
export function TaskSubsections({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`flex flex-col gap-lists ${className}`}>{children}</div>;
}

/** One of them: a label and what it labels. */
export function TaskSubsection({
  title,
  className = "",
  children,
}: {
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-heading ${className}`}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
