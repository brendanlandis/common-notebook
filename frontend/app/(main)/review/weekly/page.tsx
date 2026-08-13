"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/app/(main)/todo/hooks/useTasks";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useReviewCadence } from "@/app/hooks/useReviewCadence";
import {
  computeReviewPeriod,
  defaultReviewMode,
  type ReviewPeriodMode,
} from "@/app/lib/reviewCycle";
import { cadenceIsUsable, cycleNoun } from "@/app/lib/reviewCadence";
import { buildReviewLists } from "@/app/lib/reviewLists";
import { getToday, toISODate } from "@/app/lib/dateUtils";
import { useReviewCovering, useSaveReview } from "../hooks/useReview";
import { useCalendarEvents, useSetDecision } from "../hooks/useCalendarEvents";
import { isFullyDecided, undecided, type ResolvedInstance } from "@/app/lib/ics/resolveDecisions";
import TaskPickList from "../components/TaskPickList";
import WeekCalendar from "../components/WeekCalendar";

/**
 * The review itself: look at what's on your plate, pick a few things, commit.
 *
 * The output is a `review` row holding a period and a task selection. The daily
 * page reads it back. There is no scoring, no carry-over from last time, and no
 * "leftovers" list — each review opens on the same blank slate, which is what
 * keeps it a planning ritual rather than a report card.
 */
export default function WeeklyReviewPage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { tasks, loading: tasksLoading } = useTasks();
  const { cadence, loading: cadenceLoading } = useReviewCadence();
  const { createReview, updateReview, isSaving, error } = useSaveReview();

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
  const [committed, setCommitted] = useState(false);
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
  // seeds the checkboxes rather than starting empty, and committing updates it
  // instead of leaving two reviews covering the same days.
  const { review: existing } = useReviewCovering(period?.periodStart ?? null);

  const toggle = (documentId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });

  const commit = async () => {
    if (!period || !cadence) return;
    const taskIds = [...selected];
    if (existing) {
      await updateReview({ documentId: existing.documentId, tasks: taskIds });
    } else {
      await createReview({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        cycleType: cadence.recurrenceType,
        anchorDate: cadence.anchorDate,
        tasks: taskIds,
      });
    }
    setCommitted(true);
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
          <h2>the {noun}</h2>
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
          on, and they broke a dozen tasks into seven stubs. */}
      {lists.soon.length > 0 && (
        <section className="review-section">
          <h2>soon</h2>
          <TaskPickList tasks={lists.soon} selected={selected} onToggle={toggle} />
        </section>
      )}

      {lists.recurring.length > 0 && (
        <section className="review-section">
          <h2>recurring</h2>
          <TaskPickList tasks={lists.recurring} selected={selected} onToggle={toggle} />
        </section>
      )}

      {/* Said once, rather than three times over three empty headings. */}
      {!hasAnyTasks && (
        <p className="review-empty">nothing on your plate — enjoy it</p>
      )}

      <div className="review-actions">
        <button className="btn" onClick={commit} disabled={isSaving || !period}>
          {existing ? "update this review" : "commit"}
        </button>
        {/* Shown, not swallowed. Losing a committed review is the one write here
            a person would actually notice. */}
        {error && <p className="error">couldn&apos;t save that — {error.message}</p>}
        {committed && !error && (
          <p className="review-committed">
            saved{period && period.periodStart <= today ? " — see you on the daily page" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
