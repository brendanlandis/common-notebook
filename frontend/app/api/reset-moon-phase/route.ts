import { NextRequest, NextResponse } from 'next/server';
import {
  performMoonPhaseReset,
  updateMoonPhaseResetDate,
} from '@/app/lib/moonPhaseReset';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { todosUpdated, projectsUpdated } = await performMoonPhaseReset(token);

    // Update the system setting to track the last reset date
    await updateMoonPhaseResetDate(token);

    return NextResponse.json({
      success: true,
      todosUpdated,
      projectsUpdated,
    });
  } catch (error) {
    console.error('Error resetting moon phase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

