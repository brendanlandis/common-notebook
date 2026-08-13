"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/app/(main)/todo/hooks/useTasks";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useReviewCadence } from "@/app/hooks/useReviewCadence";
import { computeReviewPeriod, type ReviewPeriodMode } from "@/app/lib/reviewCycle";
import { cadenceIsUsable } from "@/app/lib/reviewCadence";
import { buildReviewLists, GROUP_LABELS } from "@/app/lib/reviewLists";
import { getToday, toISODate, formatInTimezone, parseDate } from "@/app/lib/dateUtils";
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

  const [mode, setMode] = useState<ReviewPeriodMode>("upcoming");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [committed, setCommitted] = useState(false);

  const period = useMemo(() => {
    if (!cadence) return null;
    return computeReviewPeriod(cadence, timeZoneSettings, {
      mode,
      anchorDate: cadence.anchorDate,
    });
  }, [cadence, timeZoneSettings, mode]);

  const lists = useMemo(() => buildReviewLists(tasks), [tasks]);

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

  const stillUnset = undecided(events);

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

  // `formatInTimezone` throws on an unsupported format rather than guessing, so
  // this uses one of the formats it actually knows.
  const describe = (iso: string) =>
    formatInTimezone(parseDate(iso, timeZoneSettings), "EEEE M/d", timeZoneSettings);
  const today = toISODate(getToday(timeZoneSettings), timeZoneSettings);

  return (
    <div className="review-page">
      <h1>review</h1>

      {period && (
        <p className="review-period">
          {describe(period.periodStart)} – {describe(period.periodEnd)}
        </p>
      )}

      {/* Re-running a review mid-cycle is a first-class thing to do, not a
          recovery path: "I should be able to conduct a review for the rest of my
          week, even though it's Thursday." */}
      <div className="review-mode">
        <label>
          <input
            type="radio"
            className="radio"
            checked={mode === "upcoming"}
            onChange={() => setMode("upcoming")}
          />
          the cycle ahead
        </label>
        <label>
          <input
            type="radio"
            className="radio"
            checked={mode === "remainder"}
            onChange={() => setMode("remainder")}
          />
          the rest of this one
        </label>
      </div>

      {/* The calendar's job here is to show what the week already is, so the
          intentions below get chosen against it rather than in a vacuum. Not to
          hold the tasks — nothing on this page ever becomes a calendar entry. */}
      {period && !calendarLoading && events.length > 0 && (
        <section className="review-section">
          <h2>the week</h2>
          {/* Three glyphs on a grid are a puzzle without a key, and nothing else
              on the page says that clicking is how a decision gets made. */}
          <p className="review-legend">
            <span>
              <i className="swatch swatch-unset" aria-hidden="true" />? undecided
            </span>
            <span>
              <i className="swatch swatch-show" aria-hidden="true" />✓ keeping
            </span>
            <span>
              <i className="swatch swatch-hide" aria-hidden="true" />✕ ignoring
            </span>
            <span>click an event to change it</span>
          </p>
          <WeekCalendar
            events={events}
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

      {lists.topOfMind && (
        <section className="review-section">
          <h2>{lists.topOfMind.projectTitle}</h2>
          <TaskPickList
            tasks={lists.topOfMind.tasks}
            selected={selected}
            onToggle={toggle}
            emptyMessage="nothing on this one right now"
          />
        </section>
      )}

      <section className="review-section">
        <h2>coming up</h2>
        {lists.surfacing.length === 0 && (
          <p className="review-empty">nothing surfacing</p>
        )}
        {lists.surfacing.map((group) => (
          <div key={group.recurrenceType} className="review-group">
            <h3>{GROUP_LABELS[group.recurrenceType] ?? group.recurrenceType}</h3>
            <TaskPickList tasks={group.tasks} selected={selected} onToggle={toggle} />
          </div>
        ))}
      </section>

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
