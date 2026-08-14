import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchOpenSession } from '@/app/lib/practiceSessionServer';

/**
 * "Is anything running?" — the question the practice modal asks from every page.
 *
 * It needs a route of its own because the session list is filtered by material,
 * and on /todo or /review there is no material in scope: "the open log among
 * this material's logs" is not a question that can be asked there. The old
 * per-type query had the same shape and the same limitation, which is also why
 * two sessions on different types could both be open at once.
 *
 * Answers `{ success: true, data: null }` when nothing is running. That is not
 * an error, and it is by far the common case.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: true, data: await fetchOpenSession(token) });
  } catch (error) {
    console.error('Error fetching the active practice session:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
