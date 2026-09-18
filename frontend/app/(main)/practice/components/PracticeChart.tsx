import LineChart, { type LineSeries } from '@/app/components/charts/LineChart';
import type { SubjectStats } from '../hooks/usePracticeLogs';

/**
 * Minutes per day, one line per subject.
 *
 * Colors are assigned by position rather than by name. They used to be a map
 * keyed on the six enum values, which meant a seventh subject had no color and
 * the map was a seventh place the enum had to be repeated. Subjects are user
 * data now, so the palette cycles: with more subjects than colors two lines
 * will share one, which is a legible chart with a small ambiguity rather than an
 * invisible line.
 */
const PALETTE = [
  'var(--color-base-content)',
  'var(--color-success)',
  // The one slot the two themes fill differently: secondary's pale content
  // color on the light theme's paper, secondary itself on the dark one. Both
  // daisyUI themes set `color-scheme`, which is what `light-dark()` reads.
  'light-dark(var(--color-secondary-content), var(--color-secondary))',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-info)',
];

export default function PracticeChart({ stats }: { stats: SubjectStats[] }) {
  if (stats.length === 0) return null;

  // One row per date, with a column per subject. Every subject carries the same
  // date range from the server, so the first one decides the axis.
  const dateMap = new Map<string, Record<string, unknown>>();
  for (const { date } of stats[0]?.data ?? []) {
    const [, month, day] = date.split('-');
    dateMap.set(date, { date: `${parseInt(month)}/${parseInt(day)}` });
  }

  for (const subject of stats) {
    for (const day of subject.data) {
      const entry = dateMap.get(day.date);
      if (entry) entry[subject.key] = day.minutes;
    }
  }

  // Round the axis up to the next half hour, so a 34-minute day doesn't put the
  // ceiling at 34.
  const busiest = Math.max(
    30,
    ...stats.flatMap((subject) => subject.data.map((day) => day.minutes))
  );

  const series: LineSeries[] = stats.map((subject, index) => ({
    key: subject.key,
    label: subject.label,
    color: PALETTE[index % PALETTE.length],
  }));

  return (
    <div className="w-full">
      <LineChart
        data={Array.from(dateMap.values())}
        xKey="date"
        series={series}
        height={400}
        yDomainMax={Math.ceil(busiest / 30) * 30}
        yLabel="minutes"
      />
    </div>
  );
}
