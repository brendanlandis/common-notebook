"use client";

import { useMemo, useState } from "react";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { getToday, toISODate } from "@/app/lib/dateUtils";
import { useReviewCovering } from "../hooks/useReview";
import { useDailyPick } from "../hooks/useDailyPick";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import TaskPickList from "../components/TaskPickList";

/**
 * What's on your plate today.
 *
 * Reads the review covering today and shows its selection. Narrowing that to a
 * few things each morning is **optional**: with no pick made, the whole review
 * selection shows. That matters more than it looks — the risk with this page was
 * never conceptual load, it was ritual load, and a daily page that goes blank
 * because you skipped a morning is worse than one that was never filled in.
 */
export default function DailyReviewPage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const today = toISODate(getToday(timeZoneSettings), timeZoneSettings);

  const { review, loading: reviewLoading } = useReviewCovering(today);
  const { pick, loading: pickLoading, savePick } = useDailyPick(today);
  const { events } = useCalendarEvents(today, today);

  // Only what you decided to be at. This is the reading surface, not the
  // deciding one — hidden events are rendered on the review page precisely so
  // you can change your mind there, and filtered here so today reads as today.
  // Anything still undecided shows: better an extra line than a missed thing.
  const todaysEvents = useMemo(
    () => events.filter((event) => event.state !== "hide"),
    [events]
  );

  const [narrowing, setNarrowing] = useState(false);

  const reviewTasks = useMemo(() => review?.tasks ?? [], [review]);
  const pickedIds = useMemo(
    () => new Set((pick?.tasks ?? []).map((task) => task.documentId)),
    [pick]
  );

  // A pick with no tasks is still a pick — it means "I looked and chose none" —
  // but showing an empty page for it would be useless, so an empty selection
  // falls back to the whole review the same way a missing one does.
  const hasNarrowed = pickedIds.size > 0;
  const shown = hasNarrowed
    ? reviewTasks.filter((task) => pickedIds.has(task.documentId))
    : reviewTasks;

  const toggle = (documentId: string) => {
    const next = new Set(pickedIds);
    if (next.has(documentId)) next.delete(documentId);
    else next.add(documentId);
    savePick([...next]);
  };

  if (reviewLoading || pickLoading) return <div className="review-page">loading...</div>;

  if (!review) {
    return (
      <div className="review-page">
        <h1>today</h1>
        <p>no review covers today yet.</p>
      </div>
    );
  }

  return (
    <div className="review-page">
      <h1>today</h1>

      {todaysEvents.length > 0 && (
        <section className="review-section">
          <ul className="review-pick-list">
            {todaysEvents.map((event) => (
              <li key={`${event.uid}:${event.recurrenceId ?? ""}`}>
                {/* Times, because an appointment genuinely has one. This is the
                    only place a clock appears in the feature — tasks never get
                    one, which is the whole distinction between what's imposed
                    on the day and what you chose for it. */}
                <span>{event.allDay ? "all day" : event.start.slice(11, 16)}</span>{" "}
                <span>{event.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {narrowing ? (
        <>
          <p className="review-hint">pick what you&apos;re actually doing today</p>
          <TaskPickList
            tasks={reviewTasks}
            selected={pickedIds}
            onToggle={toggle}
            emptyMessage="this review didn't commit to anything"
          />
          <button className="btn" onClick={() => setNarrowing(false)}>
            done
          </button>
        </>
      ) : (
        <>
          <TaskPickList
            tasks={shown}
            selected={new Set()}
            onToggle={() => {}}
            emptyMessage="this review didn't commit to anything"
          />
          {reviewTasks.length > 0 && (
            <button className="btn" onClick={() => setNarrowing(true)}>
              {hasNarrowed ? "change today's picks" : "narrow to today"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
