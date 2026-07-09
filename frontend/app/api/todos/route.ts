import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getUserIdFromAccessToken } from '@/app/lib/strapiAuth';
import { runMoonPhaseResetIfDue } from '@/app/lib/moonPhaseReset';
import { fetchAllPages, getSystemSetting, strapiFetch, upsertSystemSetting } from '@/app/lib/strapiServer';

const VISIBILITY_SETTING = 'completedTaskVisibilityMinutes';
const DEFAULT_VISIBILITY_MINUTES = 15;

/**
 * How long a completed todo stays visible. Reads the caller's own setting, and
 * seeds it on first use — a brand-new account has no settings rows at all, now
 * that they are per-user.
 */
async function getVisibilityMinutes(token: string): Promise<number> {
  const setting = await getSystemSetting(token, VISIBILITY_SETTING);

  if (setting?.value != null) {
    const parsed = parseInt(setting.value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }

  if (!setting) {
    // Non-fatal: a failure here just means we use the default this time.
    const seeded = await upsertSystemSetting(token, VISIBILITY_SETTING, {
      value: String(DEFAULT_VISIBILITY_MINUTES),
    });
    if (!seeded) console.error(`Failed to seed ${VISIBILITY_SETTING}`);
  }

  return DEFAULT_VISIBILITY_MINUTES;
}

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // A read that performs writes. Kept here so the list is never served stale,
    // but guarded: one reset per user at a time, and it never throws.
    const userKey = getUserIdFromAccessToken(token) ?? token;
    await runMoonPhaseResetIfDue(token, userKey);

    const incomplete = await fetchAllPages(
      token,
      '/api/todos?filters[completed][$eq]=false&populate=project'
    );

    const visibilityMinutes = await getVisibilityMinutes(token);
    const cutoffISO = new Date(Date.now() - visibilityMinutes * 60 * 1000).toISOString();

    let recentlyCompleted: unknown[] = [];
    try {
      recentlyCompleted = await fetchAllPages(
        token,
        `/api/todos?filters[completed][$eq]=true&filters[completedAt][$gte]=${cutoffISO}&populate=project`
      );
    } catch (error) {
      // Don't fail the whole request if the visibility window can't be fetched.
      console.error('Failed to fetch recently completed todos:', error);
    }

    return NextResponse.json({
      success: true,
      data: [...incomplete, ...recentlyCompleted],
    });
  } catch (error) {
    console.error('Error fetching todos:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

    const response = await strapiFetch(token, '/api/todos?populate=project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: body }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to create todo' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
