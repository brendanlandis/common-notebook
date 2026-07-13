import PieChart from '@/app/components/charts/PieChart';

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

export default function RecentStats({ stats, loading, title = "recently", noWrapper = false }: RecentStatsProps) {
  if (loading) {
    return null;
  }

  if (!stats || stats.length === 0) {
    return null;
  }

  // Transform data for the pie chart.
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
        <PieChart data={chartData} />
      </div>
    </>
  );

  if (noWrapper) {
    return chartContent;
  }

  return (
    <div className="task-section recent-stats-section">
      {chartContent}
    </div>
  );
}
