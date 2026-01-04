import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import PieChartPatterns from './PieChartPatterns';

interface StatItem {
  type: 'project' | 'category';
  name: string;
  count: number;
}

interface RecentStatsProps {
  stats: StatItem[];
  loading?: boolean;
  title?: string;
  noWrapper?: boolean;
}

// Pattern IDs for pie chart slices (from Hero Patterns)
const PATTERNS = [
  'pattern-1',   // Checkerboard
  'pattern-2',   // Graph Paper
  'pattern-3',   // Charlie Brown
  'pattern-4',   // Hexagons
  'pattern-5',   // Zig Zag
  'pattern-6',   // Autumn
  'pattern-7',   // Squares
  'pattern-8',   // Dominos
  'pattern-9',   // Plus
  'pattern-10',  // Wiggle
  'pattern-11',  // Bubbles
  'pattern-12',  // Triangles
  'pattern-13',  // Arrows
  'pattern-14',  // Diagonal Lines
  'pattern-15',  // Horizontal Stripes
];

// Custom label renderer for pie chart - positions labels outside
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  value,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="pie-chart-label"
      fill="var(--primary-color)"
    >
      {name}
    </text>
  );
};

export default function RecentStats({ stats, loading, title = "recently", noWrapper = false }: RecentStatsProps) {
  if (loading) {
    return null;
  }

  if (!stats || stats.length === 0) {
    return null;
  }

  // Transform data for ReCharts
  // For "last 30 days" chart, group items with count === 2
  // For other charts (7 days), group items with count === 1
  const groupThreshold = title === "last 30 days" ? 2 : 1;
  
  // Separate items by count
  const mainEntries = stats.filter(stat => stat.count > groupThreshold);
  const groupableEntries = stats.filter(stat => stat.count === groupThreshold);

  // If there are 2+ entries at the threshold, group them as "other"
  let chartData;
  if (groupableEntries.length >= 2) {
    const otherCount = groupableEntries.reduce((sum, stat) => sum + stat.count, 0);
    chartData = [
      ...mainEntries.map(stat => ({ name: stat.name, value: stat.count })),
      { name: 'other', value: otherCount }
    ];
  } else {
    // Show all items normally
    chartData = stats.map(stat => ({ name: stat.name, value: stat.count }));
  }

  const chartContent = (
    <>
      <h4>{title}</h4>
      <div className="pie-chart-container">
        <ResponsiveContainer width="100%" height={235}>
          <PieChart margin={{ top: 20, right: 100, bottom: 20, left: 100 }}>
            <PieChartPatterns />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={{ stroke: 'var(--primary-color)', strokeWidth: 1 }}
              label={renderCustomizedLabel}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
              isAnimationActive={false}
              stroke="var(--primary-color)"
              strokeWidth={1}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#${PATTERNS[index % PATTERNS.length]})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  if (noWrapper) {
    return chartContent;
  }

  return (
    <div className="todo-section recent-stats-section">
      {chartContent}
    </div>
  );
}

