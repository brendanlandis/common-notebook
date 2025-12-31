import { NextRequest, NextResponse } from 'next/server';
import { getTodayInEST, toISODateInEST } from '@/app/lib/dateUtils';
import type { PracticeType } from '@/app/types/admin';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

const PRACTICE_TYPES: PracticeType[] = ['guitar', 'voice', 'drums', 'writing', 'composing', 'ear training'];

interface DayData {
  date: string;
  minutes: number;
}

interface TypeStats {
  type: PracticeType;
  data: DayData[];
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate date range for past 30 days
    const today = getTodayInEST();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 29 days ago + today = 30 days total
    const startDate = toISODateInEST(thirtyDaysAgo);

    // Fetch all practice logs from the past 30 days
    const response = await fetch(
      `${STRAPI_API_URL}/api/practice-logs?filters[date][$gte]=${startDate}&pagination[pageSize]=1000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch practice logs' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const logs = data.data;

    // Create a map of all dates in the range
    const dateRange: string[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      dateRange.push(toISODateInEST(date));
    }

    // Process logs by type
    const statsByType: TypeStats[] = PRACTICE_TYPES.map(type => {
      // Create a map for this type's data
      const minutesByDate = new Map<string, number>();
      
      // Initialize all dates to 0
      dateRange.forEach(date => {
        minutesByDate.set(date, 0);
      });

      // Sum up durations for each date
      logs.forEach((log: any) => {
        if (log.type === type && log.date && log.duration) {
          const currentMinutes = minutesByDate.get(log.date) || 0;
          minutesByDate.set(log.date, currentMinutes + log.duration);
        }
      });

      // Convert to array format
      const data: DayData[] = dateRange.map(date => ({
        date,
        minutes: minutesByDate.get(date) || 0,
      }));

      return {
        type,
        data,
      };
    });

    return NextResponse.json({
      success: true,
      data: statsByType,
    });
  } catch (error) {
    console.error('Error fetching practice stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

