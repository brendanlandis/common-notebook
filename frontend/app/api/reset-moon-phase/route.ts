import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { performMoonPhaseReset, armDeclutter } from '@/app/lib/moonPhaseReset';

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tasksUpdated, projectsUpdated } = await performMoonPhaseReset(token);

    // Re-arm: the next automatic declutter is the next new moon after today.
    await armDeclutter(token);

    return NextResponse.json({
      success: true,
      tasksUpdated,
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

