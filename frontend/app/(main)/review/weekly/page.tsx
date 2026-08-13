"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTasks } from "@/app/(main)/todo/hooks/useTasks";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useReviewCadence } from "@/app/hooks/useReviewCadence";
import {
  computeReviewPeriod,
  defaultReviewMode,
  type ReviewPeriodMode,
} from "@/app/lib/reviewCycle";
import { cadenceIsUsable, cycleNoun } from "@/app/lib/reviewCadence";
import { buildReviewLists, type ProjectGroup } from "@/app/lib/reviewLists";
import { getToday, toISODate } from "@/app/lib/dateUtils";
import { useReviewCovering, useSaveReview } from "../hooks/useReview";
import { useCalendarEvents, useSetDecision } from "../hooks/useCalendarEvents";
import { isFullyDecided, undecided, type ResolvedInstance } from "@/app/lib/ics/resolveDecisions";
import TaskPickList from "../components/TaskPickList";
import WeekCalendar from "../components/WeekCalendar";

/**
 * One project's worth of pills, under its name.
 *
 * The heading carries the project, so the pills don't repeat it — that muted
 * second label on every pill was a good part of what made the ungrouped list
 * dense. Tasks with no project sit under "incidentals", which is what this app
 * has always called them.
 */
function ProjectGroupList({
  group,
  selected,
  onToggle,
}: {
  group: ProjectGroup;
  selected: Set<string>;
  onToggle: (documentId: string) => void;
}) {
  return (
    <div className="review-group">
      <h3>{group.projectTitle ?? "incidentals"}</h3>
      <TaskPickList
        tasks={group.tasks}
        selected={selected}
        onToggle={onToggle}
        showProject={false}
      />
    </div>
  );
}

/**
 * The review itself: look at what's on your plate and pick a few things.
 *
 * The output is a `review` row holding a period and a task selection, written as
 * you pick rather than on a submit — see `toggle`. The daily page reads it back.
 * There is no scoring, no carry-over from last time, and no "leftovers" list —
 * each review opens on the same blank slate, which is what keeps it a planning
 * ritual rather than a report card.
 */
export default function WeeklyReviewPage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { tasks, loading: tasksLoading } = useTasks();
  const { cadence, loading: cadenceLoading } = useReviewCadence();
  const { createReview, updateReview, error } = useSaveReview();

  /**
   * The mode, chosen or defaulted.
   *
   * Held as "what the user picked, if they picked" rather than seeded with a
   * default, because the default depends on the cadence and the cadence arrives
   * from a query. Seeding state would mean either an effect that overwrites the
   * mode a moment after the page appears — moving the calendar under the
   * cursor — or a `key` remount. Deriving it costs nothing and is correct on the
   * first paint.
   */
  const [chosenMode, setChosenMode] = useState<ReviewPeriodMode | null>(null);
  const mode =
    chosenMode ??
    (cadence
      ? defaultReviewMode(cadence, timeZoneSettings, { anchorDate: cadence.anchorDate })
      : "remainder");
  const setMode = setChosenMode;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Whether the last pick actually reached the server. Not "has the user picked
  // something" — with no button to press, this line is the only acknowledgement
  // there is, so it must not appear until the write has landed.
  const [saved, setSaved] = useState(false);
  // Ignored events stay out of the way by default. They were kept on the grid so
  // you could change your mind about one, but a week's worth of struck-through
  // things you already dismissed is most of what you'd be looking at — the
  // opposite of seeing what the week actually is.
  const [showIgnored, setShowIgnored] = useState(false);

  const period = useMemo(() => {
    if (!cadence) return null;
    return computeReviewPeriod(cadence, timeZoneSettings, {
      mode,
      anchorDate: cadence.anchorDate,
    });
  }, [cadence, timeZoneSettings, mode]);

  const lists = useMemo(() => buildReviewLists(tasks), [tasks]);
  const hasAnyTasks =
    (lists.topOfMind?.tasks.length ?? 0) + lists.soon.length + lists.recurring.length > 0;

  const { events, calendars, loading: calendarLoading } = useCalendarEvents(
    period?.periodStart ?? null,
    period?.periodEnd ?? null
  );
  const { setDecision } = useSetDecision();

  /**
   * Clicking an event walks unset → show → hide → unset.
   *
   * The decision is written at the tier the user is looking at: for a recurring
   * event whose state came from its series (or from nowhere), the write is
   * series-level, so deciding once about a standup covers every future one.
   * Only an event already carrying its own override keeps overriding.
   */
  const cycleEvent = (instance: ResolvedInstance) => {
    const next =
      instance.state === "unset" ? "show" : instance.state === "show" ? "hide" : null;
    setDecision({
      calendar: instance.calendarDocumentId,
      uid: instance.uid,
      recurrenceId: instance.source === "instance" ? instance.recurrenceId : null,
      state: next,
    });
  };

  // The counts below deliberately read the *whole* set, not the filtered one:
  // hiding the ignored ones is a display choice and must not change what the
  // review says is left to decide.
  const stillUnset = undecided(events);
  const ignoredCount = events.filter((event) => event.state === "hide").length;
  // Memoized because a fresh array each render would rebuild the calendar's
  // event list every time anything else on the page changes.
  const shownEvents = useMemo(
    () => (showIgnored ? events : events.filter((event) => event.state !== "hide")),
    [events, showIgnored]
  );

  // An existing review for this period means we're re-running one; its selection
  // seeds the pills rather than starting empty, and further picks update it
  // instead of leaving two reviews covering the same days.
  const { review: existing, loading: reviewLoading } = useReviewCovering(
    period?.periodStart ?? null
  );

  /**
   * The review being written into, once one exists.
   *
   * A ref rather than the query's answer, because the query cannot keep up with
   * clicking: the first pick creates a review, and a second pick landing before
   * that POST resolves would see no existing review and create a *second* one
   * covering the same days.
   */
  const reviewId = useRef<string | null>(null);

  /**
   * Seed the selection from the stored review, once per period.
   *
   * Guarded by a key rather than a dependency list, because this must happen
   * exactly once for a given period: the query refetches after every save, and
   * re-seeding from it would overwrite a pick made while the save was in flight.
   * Switching modes changes the period, which is a different review, so it seeds
   * again — deliberately.
   */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!period || reviewLoading) return;
    const key = `${period.periodStart}..${period.periodEnd}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    reviewId.current = existing?.documentId ?? null;
    setSelected(new Set((existing?.tasks ?? []).map((task) => task.documentId)));
  }, [period, existing, reviewLoading]);

  /**
   * Saves, serialized.
   *
   * Every pick is its own write, so they have to queue: two overlapping writes
   * would be a lost update at best, and at worst a create racing a create. The
   * chain swallows failures so one rejected save doesn't wedge every later one —
   * the error surfaces through the mutation's own state, which is rendered.
   */
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const persist = (taskIds: string[]) => {
    if (!period || !cadence) return;
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        if (reviewId.current) {
          await updateReview({ documentId: reviewId.current, tasks: taskIds });
        } else {
          const created = await createReview({
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            cycleType: cadence.recurrenceType,
            anchorDate: cadence.anchorDate,
            tasks: taskIds,
          });
          reviewId.current = created?.data?.documentId ?? null;
        }
        setSaved(true);
      });
  };

  /**
   * Picking a task saves it. There is no commit button.
   *
   * The button was a second step that added nothing: a review is a handful of
   * picks, not a form, and having to confirm them made the page feel like
   * something you could get wrong. Every pick is reversible by clicking it
   * again, which is a better guarantee than a submit button ever was.
   */
  const toggle = (documentId: string) => {
    const next = new Set(selected);
    if (next.has(documentId)) next.delete(documentId);
    else next.add(documentId);
    setSelected(next);
    setSaved(false);
    persist([...next]);
  };

  if (cadenceLoading || tasksLoading) return <div className="review-page">loading...</div>;

  if (!cadence || !cadenceIsUsable(cadence)) {
    return (
      <div className="review-page">
        <h1>review</h1>
        <p>
          your review cadence needs a little more detail before it can work out a
          period — have a look in settings.
        </p>
      </div>
    );
  }

  const today = toISODate(getToday(timeZoneSettings), timeZoneSettings);
  // "week", "month", "moon phase" — whatever one period of this cadence is.
  const noun = cycleNoun(cadence);

  return (
    <div className="review-page">
      <h1>review</h1>

      {/* The period used to be spelled out here as a date range. The calendar
          below is a week of labelled day columns, so it was saying the same
          thing twice — and less clearly. */}

      {/* Re-running a review mid-cycle is a first-class thing to do, not a
          recovery path: "I should be able to conduct a review for the rest of my
          week, even though it's Thursday."

          `value` and `name` are what the e2e spec locates these by. The labels
          are cadence-dependent, so a test matching on their text would break the
          moment the account under test changed its review schedule. */}
      <div className="review-mode">
        <label>
          <input
            type="radio"
            className="radio"
            name="review-mode"
            value="remainder"
            checked={mode === "remainder"}
            onChange={() => setMode("remainder")}
          />
          this {noun}
        </label>
        <label>
          <input
            type="radio"
            className="radio"
            name="review-mode"
            value="upcoming"
            checked={mode === "upcoming"}
            onChange={() => setMode("upcoming")}
          />
          next {noun}
        </label>
      </div>

      {/* The calendar's job here is to show what the week already is, so the
          intentions below get chosen against it rather than in a vacuum. Not to
          hold the tasks — nothing on this page ever becomes a calendar entry. */}
      {period && !calendarLoading && events.length > 0 && (
        <section className="review-section">
          {/* No heading. It's a labelled seven-day grid — anything written over
              it is a caption on a photograph of itself. */}
          {/* Three glyphs on a grid are a puzzle without a key, and nothing else
              on the page says that clicking is how a decision gets made. */}
          <div className="review-legend">
            <span>
              <i className="swatch swatch-unset" aria-hidden="true" />? undecided
            </span>
            <span>
              <i className="swatch swatch-show" aria-hidden="true" />✓ keeping
            </span>
            {/* Only while they're on screen — a key to a symbol you can't see is
                just more to read. */}
            {showIgnored && (
              <span>
                <i className="swatch swatch-hide" aria-hidden="true" />✕ ignoring
              </span>
            )}
            <span>click an event to change it</span>
            {/* Only offered when there's something to reveal — an empty checkbox
                promising nothing is just another control to read past. */}
            {ignoredCount > 0 && (
              <label className="review-legend-toggle">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={showIgnored}
                  onChange={(event) => setShowIgnored(event.target.checked)}
                />
                show {ignoredCount} ignored
              </label>
            )}
          </div>
          <WeekCalendar
            events={shownEvents}
            periodStart={period.periodStart}
            periodEnd={period.periodEnd}
            onCycle={cycleEvent}
          />
          {/* A definition of done, which is the thing weekly reviews usually
              lack — so you either fiddle indefinitely or quit early. */}
          <p className="review-hint">
            {isFullyDecided(events)
              ? "every event decided"
              : `${stillUnset.length} still undecided`}
          </p>
          {calendars.some((c) => c.unreachable) && (
            <p className="error">
              couldn&apos;t reach:{" "}
              {calendars.filter((c) => c.unreachable).map((c) => c.name).join(", ")}
            </p>
          )}
        </section>
      )}

      {/* A heading over nothing is a heading you have to read to find out it was
          nothing. Each list appears only when it has something in it — which
          also means the shape of the page tells you what kind of cycle this is
          before you've read a word of it. */}
      {lists.topOfMind && lists.topOfMind.tasks.length > 0 && (
        <section className="review-section">
          <h2>{lists.topOfMind.projectTitle}</h2>
          <TaskPickList
            tasks={lists.topOfMind.tasks}
            selected={selected}
            onToggle={toggle}
          />
        </section>
      )}

      {/* Two lists rather than one subdivided by recurrence type. The old
          headings ("every few days", "weekly", …) described how a task was set
          up, which is nothing a person choosing what to do this week can act
          on, and they broke a dozen tasks into seven stubs. Grouped by project
          within each, because forty pills in one block reads as a quantity
          rather than as things. */}
      {lists.soon.length > 0 && (
        <section className="review-section">
          <h2>soon</h2>
          {lists.soon.map((group) => (
            <ProjectGroupList
              key={group.key}
              group={group}
              selected={selected}
              onToggle={toggle}
            />
          ))}
        </section>
      )}

      {lists.recurring.length > 0 && (
        <section className="review-section">
          <h2>recurring</h2>
          {lists.recurring.map((group) => (
            <ProjectGroupList
              key={group.key}
              group={group}
              selected={selected}
              onToggle={toggle}
            />
          ))}
        </section>
      )}

      {/* Said once, rather than three times over three empty headings. */}
      {!hasAnyTasks && (
        <p className="review-empty">nothing on your plate — enjoy it</p>
      )}

      {/* No commit button: a pick saves itself. What's left is the failure
          case, shown rather than swallowed — losing a pick is the one write here
          a person would actually notice, and with no button to press there is
          nothing else that would tell them. */}
      {error && (
        <p className="error">couldn&apos;t save that — {error.message}</p>
      )}
      {saved && !error && (
        <p className="review-committed">
          saved
          {period && period.periodStart <= today ? " — see you on the daily page" : ""}
        </p>
      )}
    </div>
  );
}
