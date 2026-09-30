'use client';

import PracticeChart from './PracticeChart';
// Co-located with the logs query on purpose: stopping a session invalidates both.
import { usePracticeStats } from '../hooks/usePracticeLogs';

export default function PracticeCharts() {
  const { stats, loading, error } = usePracticeStats();

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <div className="mx-auto">
        <p className="italic">{error}</p>
      </div>
    );
  }

  if (stats.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-heading">
      <h3>last 30 days</h3>
      <PracticeChart stats={stats} />
    </div>
  );
}
