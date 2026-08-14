"use client";

import type { PracticeLog } from "@/app/types/index";
import PracticeSessionItem from "./components/PracticeSessionItem";
import PracticeCharts from "./components/PracticeCharts";
import {
  toISODate,
  getToday,
  shiftISODate,
  parseDate,
  formatInTimezone,
} from "@/app/lib/dateUtils";
import type { TimeZoneSettings } from "@/app/lib/timeZoneSettings";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { usePracticeLogs } from "./hooks/usePracticeLogs";
import FaviconManager from "@/app/components/FaviconManager";

/**
 * What you have practised — a record, not a place you practise.
 *
 * The play button and the subject dropdown used to live here, which made this
 * page both the timer and the history of it. Practising now happens in a modal
 * over whatever you were looking at (see `PracticeSessionModal`), so what is
 * left is the chart and the sessions, grouped by the day they belong to.
 *
 * Read-only apart from editing a session's notes or deleting one outright. There
 * is deliberately no way to start a session from here: the thing you press play
 * on is a piece of material, and material lives on /todo and the review pages.
 */
export default function PracticePage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { logs, loading, error, update, remove } = usePracticeLogs();

  if (loading) {
    return <main id="container-practice"></main>;
  }

  if (error) {
    return (
      <main id="container-practice">
        <p>error: {error}</p>
      </main>
    );
  }

  // Finished sessions from the last 30 days, matching the chart's window.
  // Day arithmetic on the ISO string: setDate() on the instant ran in the
  // machine's calendar and, being midnight-anchored, showed 31 days for ~29 days
  // each spring on a non-matching server zone.
  const todayString = toISODate(getToday(timeZoneSettings), timeZoneSettings);
  const thirtyDaysAgoString = shiftISODate(todayString, -29); // 29 days ago + today = 30 days total

  const completedLogs = logs.filter(
    (log) => log.stop !== null && log.date >= thirtyDaysAgoString
  );

  // Sessions run together in an undifferentiated list once there are more than a
  // handful of them, and "when" is the first thing you want of a practice
  // record. Grouped by effective day — which the server already stamped, so
  // there is no date arithmetic to get wrong here.
  const byDay = new Map<string, PracticeLog[]>();
  for (const log of completedLogs) {
    const day = byDay.get(log.date);
    if (day) day.push(log);
    else byDay.set(log.date, [log]);
  }

  return (
    <>
      <FaviconManager type="metronome" />
      <main id="container-practice">
        <PracticeCharts />

        {completedLogs.length > 0 && (
          <div className="practice-sessions">
            <h3>practice history</h3>
            {[...byDay.entries()].map(([date, sessions]) => (
              <section key={date} className="practice-day">
                <h4>{dayLabel(date, todayString, timeZoneSettings)}</h4>
                {sessions.map((log) => (
                  <PracticeSessionItem
                    key={log.documentId}
                    practiceLog={log}
                    onUpdate={update}
                    onDelete={remove}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {completedLogs.length === 0 && (
          <p className="no-sessions">nothing practised in the last 30 days</p>
        )}
      </main>
    </>
  );
}

/**
 * "today" / "yesterday" / "thu 8/14" — the same wording and format the Done view
 * uses, because they are the same idea and being told the date two ways in one
 * app is worse than either.
 *
 * The *comparisons* are string comparisons: these are `YYYY-MM-DD` wall-clock
 * dates with no time and no zone, and lexicographic order on that format is
 * chronological order. Only the fallback label parses, and it parses through
 * `parseDate`/`formatInTimezone` so the day name is the user's, not the
 * machine's.
 */
function dayLabel(date: string, today: string, settings: TimeZoneSettings): string {
  if (date === today) return "today";
  if (date === shiftISODate(today, -1)) return "yesterday";
  return formatInTimezone(parseDate(date, settings), "EEE M/d", settings).toLowerCase();
}
