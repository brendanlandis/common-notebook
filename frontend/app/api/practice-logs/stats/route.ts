import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages, getTimeZoneSettings } from '@/app/lib/strapiServer';
import { getTodayForRecurrence, toISODate, shiftISODate } from '@/app/lib/dateUtils';

/**
 * Minutes practised per day, per subject, over the last 30 days.
 *
 * The series used to be a hardcoded list of six enum values, which is what made
 * adding a seventh a four-file edit. They are now whatever subjects the sessions
 * actually mention — so a new instrument appears on the chart by being practised,
 * and one you have not touched in a month does not take up a line saying zero.
 *
 * Grouped by **subject** rather than by material: forty pieces of material would
 * be forty lines, which is a texture rather than a chart. Per-material totals are
 * a drill-down, if it ever turns out to be wanted.
 */

const NO_SUBJECT = '__incidentals__';

interface SessionRow {
  date: string | null;
  duration: number | null;
  material?: {
    documentId?: string;
    project?: { documentId?: string; title?: string } | null;
  } | null;
}

interface DayData {
  date: string;
  minutes: number;
}

interface SubjectStats {
  /** documentId, or a sentinel for material belonging to no subject. */
  key: string;
  label: string;
  data: DayData[];
}

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate date range for past 30 days, respecting day boundary hour. Day
    // arithmetic on the ISO string; filters against `date`, a date-typed field.
    const settings = await getTimeZoneSettings(token);
    const startDate = shiftISODate(toISODate(getTodayForRecurrence(settings), settings), -29); // 29 days ago + today = 30 days total

    // Fetch every practice log in the past 30 days.
    //
    // This used to request `pagination[pageSize]=1000`, which Strapi silently
    // clamps to `maxLimit: 100` (backend/config/api.ts). Past 100 logs in the
    // window the stats were simply wrong, with no error anywhere.
    const logs = await fetchAllPages<SessionRow>(
      token,
      `/api/practice-logs?filters[date][$gte]=${startDate}` +
        '&populate[material][populate][0]=project'
    );

    // Every date in the range, so a day with no practice is a zero on the line
    // rather than a gap in it. shiftISODate walks the calendar from startDate;
    // the old setDate loop could duplicate one key and drop another at day
    // boundary 0 (the instant crossing a DST edge in the machine's zone).
    const dateRange: string[] = [];
    for (let i = 0; i < 30; i++) {
      dateRange.push(shiftISODate(startDate, i));
    }

    // Subjects are discovered from the data, in first-seen order — which, since
    // the list arrives sorted by start, is roughly "most recently practised
    // first" and keeps the legend stable between reloads.
    const labels = new Map<string, string>();
    const minutesByDate = new Map<string, Map<string, number>>();

    for (const log of logs) {
      if (!log.date || !log.duration) continue;

      const project = log.material?.project ?? null;
      const key = project?.documentId ?? NO_SUBJECT;
      if (!labels.has(key)) labels.set(key, project?.title ?? 'incidentals');

      let byDate = minutesByDate.get(key);
      if (!byDate) {
        byDate = new Map<string, number>();
        minutesByDate.set(key, byDate);
      }
      byDate.set(log.date, (byDate.get(log.date) ?? 0) + log.duration);
    }

    const statsBySubject: SubjectStats[] = [...labels.entries()].map(([key, label]) => {
      const byDate = minutesByDate.get(key) ?? new Map<string, number>();
      return {
        key,
        label,
        data: dateRange.map((date) => ({ date, minutes: byDate.get(date) ?? 0 })),
      };
    });

    return NextResponse.json({
      success: true,
      data: statsBySubject,
    });
  } catch (error) {
    console.error('Error fetching practice stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
