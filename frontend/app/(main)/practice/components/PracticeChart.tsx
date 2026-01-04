import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PracticeType } from '@/app/types/admin';

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

// Color palette for different practice types
const COLORS: Record<PracticeType, string> = {
  'guitar': 'var(--primary-color)',
  'voice': 'var(--secondary-color)',
  'drums': 'var(--tertiary-color)',
  'writing': 'var(--quaternary-color)',
  'composing': 'var(--quinary-color)',
  'ear training': 'var(--senary-color)',
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Sort payload by value (minutes) in descending order
    const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
    
    return (
      <div className="practice-chart-tooltip">
        <p className="tooltip-label">{label}</p>
        {sortedPayload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PracticeChart({ stats }: PracticeChartProps) {
  if (stats.length === 0) return null;

  // Transform data: combine all practice types into single data points per date
  const dateMap = new Map<string, any>();
  
  // Get all dates from the first type (they should all have the same dates)
  const dates = stats[0]?.data || [];
  
  dates.forEach(dayData => {
    const [year, month, day] = dayData.date.split('-');
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

  return (
    <div className="practice-chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--primary-color)" opacity={0.1} />
          <XAxis 
            dataKey="date" 
            stroke="var(--primary-color)"
            tick={{ fill: 'var(--primary-color)', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="var(--primary-color)"
            tick={{ fill: 'var(--primary-color)', fontSize: 12 }}
            domain={[0, yAxisMax]}
            label={{ value: 'minutes', angle: -90, position: 'insideLeft', fill: 'var(--primary-color)' }}
          />
          <Tooltip 
            content={<CustomTooltip />}
            isAnimationActive={false}
          />
          <Legend 
            wrapperStyle={{ color: 'var(--primary-color)' }}
          />
          {stats.map((typeStat) => (
            <Line 
              key={typeStat.type}
              type="monotone" 
              dataKey={typeStat.type}
              name={typeStat.type}
              stroke={COLORS[typeStat.type]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

