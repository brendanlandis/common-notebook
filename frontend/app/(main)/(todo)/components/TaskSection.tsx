import type { ReactNode } from "react";

/*
 * One column of a task view: a heading and its list.
 *
 * A column with a heading spans two of the grid's rows as a subgrid, so its
 * heading and first task line up with its neighbors' however long the headings
 * wrap. A column without one (a chronological view's months, roulette, a
 * project's page) has nothing to line up, and takes one row.
 *
 * How wide a column is, and how many share a row, is the grid's to say (see
 * TaskGrid).
 *
 * `task-section` stays as a name because the browser specs and a unit test
 * address columns by it.
 */
const SECTION =
  "task-section mb-blocks grid grid-cols-1 content-start items-start gap-heading [&_*]:break-words";
const ALIGNED = "row-span-2 [grid-template-rows:subgrid]";

/*
 * A row holds up to 1 column under 640px, 2 from 640, 3 from 900 and 4 from
 * 1100. `--column` is one column's width when the row is full. The 0.1px in
 * the tracks keeps rounding from costing a full row a column. Printing gets
 * one column.
 *
 * The breakpoints are all px. Tailwind can't order `sm:`'s 40rem against
 * `min-[900px]:`, and put `sm:` last, so two columns won at every width.
 *
 * The count is decided here on purpose. It used to be a stylesheet asking
 * with `:has()` how many columns had rendered, and the production build merged
 * its rules into one that put one-column views in three columns, on prod only.
 */
const GRID = "tasks-container grid gap-x-columns text-left print:[--column:100%]";
const COLUMN = [
  "[--column:100%]",
  "min-[640px]:[--column:calc((100%_-_var(--spacing-columns))/2)]",
  "min-[900px]:[--column:calc((100%_-_2*var(--spacing-columns))/3)]",
  "min-[1100px]:[--column:calc((100%_-_3*var(--spacing-columns))/4)]",
];

/*
 * A grid alone on its page shows as many columns as it has: auto-fit drops
 * the tracks nothing fills, so fewer columns share the width among them. A
 * column alone is one column of a full row at most; its grid area is then the
 * whole row, which is what `--column`'s 100% measures on it.
 */
const OWN_COLUMNS = [
  GRID,
  "grid-cols-[repeat(auto-fit,minmax(calc(var(--column)_-_0.1px),1fr))]",
  "*:only:max-w-(--column)",
  ...COLUMN,
].join(" ");

/*
 * Grids sharing a page (a view's sections) all keep as many tracks as the
 * widest has columns, up to a full row, filled or not, so the page's columns
 * line up from one grid to the next. `--column` stops narrowing at that count,
 * and auto-fill keeps the tracks nothing fills. A column alone takes one
 * track, which is already a column's width.
 */
const linedUp = (count: number) =>
  [
    GRID,
    "grid-cols-[repeat(auto-fill,minmax(calc(var(--column)_-_0.1px),1fr))]",
    ...COLUMN.slice(0, count),
  ].join(" ");

/*
 * A view that's one column by design (chronological, roulette): from 640px,
 * centered and as wide as its content, up to a readable measure (65ch, 641px
 * at body size), with its content on the left as usual. Centered, a grid item
 * shrinks to fit its content. `single-column` is how <main> knows to let it
 * center in the window past 1600px (see (main)/layout.tsx). Printing gets the
 * full width, as the grid does.
 */
const SINGLE = [
  "tasks-container single-column grid grid-cols-1 text-left",
  "[--column:65ch] *:only:max-w-(--column) min-[640px]:justify-items-center",
  "print:justify-items-stretch print:[--column:100%]",
].join(" ");

/**
 * The grid a view's columns sit in, or with `single`, its one column.
 *
 * No row gap: the space between one row of columns and the next is each
 * column's bottom margin. A column's rows are a subgrid of these, and a subgrid
 * whose own gap (a heading's 8px) is smaller than its parent's makes up the
 * difference with negative margins, which can't shrink a short heading's row
 * below nothing: a label or a phone-sized heading got 17px under it instead.
 */
export function TaskGrid({
  single = false,
  pageColumns,
  className = "",
  children,
}: {
  /** One column by design (chronological, roulette), centered. */
  single?: boolean;
  /**
   * Where grids share a page, the most columns any of them has. Where none has
   * more than one, their columns line up as they are.
   */
  pageColumns?: number;
  className?: string;
  children: ReactNode;
}) {
  const grid = single
    ? SINGLE
    : pageColumns && pageColumns > 1
      ? linedUp(pageColumns)
      : OWN_COLUMNS;
  return <div className={`${grid} ${className}`}>{children}</div>;
}

export default function TaskSection({
  title,
  headingLevel = "h2",
  className = "",
  children,
}: {
  /** The column's heading. */
  title?: ReactNode;
  /** h3 when the column sits under a group's name (home's "recurring"), a level below it. */
  headingLevel?: "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${SECTION} ${title ? ALIGNED : ""} ${className}`}>
      {title && <TaskSectionHeading as={headingLevel}>{title}</TaskSectionHeading>}
      {children}
    </div>
  );
}

/**
 * A column's heading. Its edit button appears on hover, or always on a touch
 * screen. The button sits inline after the title rather than in a flex row,
 * because a flex row would turn the heading trim's ::before/::after (type.css)
 * into flex items.
 */
function TaskSectionHeading({
  as: Heading,
  children,
}: {
  as: "h2" | "h3";
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
