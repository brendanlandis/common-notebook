import LineChart, { type LineSeries } from '@/app/components/charts/LineChart';
import type { PracticeType } from '@/app/types/index';

interface DayData {
  date: string;
  minutes: number;
}

interface TypeStats {
  type: PracticeType;
  data: DayData[];
}

interface PracticeChartProps {
  stats: TypeStats[];
}

// Base color for each practice type (theme CSS vars that flip with the theme).
const COLORS: Record<PracticeType, string> = {
  'guitar': 'var(--primary-color)',
  'voice': 'var(--secondary-color)',
  'drums': 'var(--tertiary-color)',
  'writing': 'var(--quaternary-color)',
  'composing': 'var(--quinary-color)',
  'ear training': 'var(--senary-color)',
};

export default function PracticeChart({ stats }: PracticeChartProps) {
  if (stats.length === 0) return null;

  // Transform data: combine all practice types into single data points per date
  const dateMap = new Map<string, Record<string, unknown>>();

  // Get all dates from the first type (they should all have the same dates)
  const dates = stats[0]?.data || [];

  dates.forEach(dayData => {
    const [, month, day] = dayData.date.split('-');
    const formattedDate = `${parseInt(month)}/${parseInt(day)}`;
    dateMap.set(dayData.date, { date: formattedDate });
  });

  // Add minutes for each practice type
  stats.forEach(typeStat => {
    typeStat.data.forEach(dayData => {
      const entry = dateMap.get(dayData.date);
      if (entry) {
        entry[typeStat.type] = dayData.minutes;
      }
    });
  });

  const chartData = Array.from(dateMap.values());

  // Calculate max value for Y axis (round up to nearest 30 minutes)
  let maxMinutes = 30;
  stats.forEach(typeStat => {
    const typeMax = Math.max(...typeStat.data.map(d => d.minutes));
    if (typeMax > maxMinutes) maxMinutes = typeMax;
  });
  const yAxisMax = Math.ceil(maxMinutes / 30) * 30;

  const series: LineSeries[] = stats.map(typeStat => ({
    key: typeStat.type,
    label: typeStat.type,
    color: COLORS[typeStat.type],
  }));

  return (
    <div className="practice-chart">
      <LineChart
        data={chartData}
        xKey="date"
        series={series}
        height={400}
        yDomainMax={yAxisMax}
        yLabel="minutes"
      />
    </div>
  );
}
