import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { fetchAllPages } from '@/app/lib/strapiServer';
import { errorResponse } from '@/app/lib/errorResponse';

/**
 * A subject's learned pieces: its material marked completed, however long ago.
 *
 * Its own read because the task list carries only incomplete tasks and ones
 * finished in the last few minutes, and "learned" is meant to be pulled back
 * from months later. `?subject=` is the subject's project documentId.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const subject = new URL(req.url).searchParams.get('subject');
    if (!subject) {
      return NextResponse.json({ success: false, error: 'subject is required' }, { status: 400 });
    }

    const pieces = await fetchAllPages(
      token,
      '/api/tasks?filters[completed][$eq]=true' +
        `&filters[project][documentId][$eq]=${encodeURIComponent(subject)}` +
        '&sort[0]=completedAt:desc&populate=project'
    );
    return NextResponse.json({ success: true, data: pieces });
  } catch (error) {
    return errorResponse('Error fetching learned pieces:', error);
  }
}
