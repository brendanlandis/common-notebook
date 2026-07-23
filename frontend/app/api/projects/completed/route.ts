import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { normalizeProjectWorld } from '@/app/lib/worldNormalize';

const STRAPI_API_URL = process.env.STRAPI_API_URL;
const PAGE_SIZE = 10;

/**
 * Completed projects (`complete === true`), for the Manage Projects drawer's
 * "Revive old projects" section. Deliberately NOT part of the app-wide
 * /api/projects query, which excludes completed projects to stay lean — this
 * list grows unbounded over time, so it pages lazily (one page per request)
 * rather than fetching every page like fetchAllPages. Sorted newest-completed
 * first; optional `q` filters by title.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const q = (req.nextUrl.searchParams.get('q') || '').trim();

    const params = new URLSearchParams();
    params.set('populate', 'worldRef');
    params.set('filters[complete][$eq]', 'true');
    if (q) params.set('filters[title][$containsi]', q);
    params.set('sort', 'completedAt:desc');
    params.set('pagination[pageSize]', String(PAGE_SIZE));
    params.set('pagination[page]', String(page));

    const response = await fetch(`${STRAPI_API_URL}/api/projects?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to fetch completed projects' },
        { status: response.status }
      );
    }

    const body = await response.json();
    const pageCount = body.meta?.pagination?.pageCount ?? page;

    return NextResponse.json({
      success: true,
      data: (body.data ?? []).map(normalizeProjectWorld),
      page,
      hasMore: page < pageCount,
    });
  } catch (error) {
    console.error('Error fetching completed projects:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
