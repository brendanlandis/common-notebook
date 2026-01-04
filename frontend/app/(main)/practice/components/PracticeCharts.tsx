import { useState, useEffect } from 'react';
import PracticeChart from './PracticeChart';
import type { PracticeType } from '@/app/types/admin';

interface DayData {
  date: string;
  minutes: number;
}

interface TypeStats {
  type: PracticeType;
  data: DayData[];
}

export default function PracticeCharts() {
  const [stats, setStats] = useState<TypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/practice-logs/stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error fetching practice stats:', err);
      setError('Failed to fetch practice statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <div className="practice-charts">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (stats.length === 0) {
    return null;
  }

  return (
    <div className="practice-charts">
      <h3>Last 30 Days</h3>
      <PracticeChart stats={stats} />
    </div>
  );
}

