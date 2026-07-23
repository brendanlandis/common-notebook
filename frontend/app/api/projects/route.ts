import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { TOP_OF_MIND, demoteTopOfMindProjects } from '@/app/lib/projectImportance';
import { fetchAllPages, strapiFetch } from '@/app/lib/strapiServer';
import { normalizeProjectWorld, toStrapiProjectWrite } from '@/app/lib/worldNormalize';

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Was a single page of 100, which silently dropped project 101 onward.
    // Populate the world relation and expose it as `project.world`.
    // Exclude completed projects from the app-wide projects query. This keeps
    // them out of everything driven by useProjects / grouped.projects — the New
    // Task dropdown included — and out of task-view columns. Section 4 of the
    // Manage Projects drawer fetches completed projects via its own paged route.
    // (Backfill made `complete` non-null, so [$eq]=false is safe — no NULL rows.)
    const projects = await fetchAllPages(
      token,
      '/api/projects?populate=worldRef&filters[complete][$eq]=false'
    );
    return NextResponse.json({ success: true, data: projects.map(normalizeProjectWorld) });
  } catch (error) {
    console.error('Error fetching projects:', error);
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

    // Only one project may be "top of mind" at a time. No id to spare — this
    // project does not exist yet. The ids come back so the response can name the
    // incumbent it just displaced.
    const demoted = body.importance === TOP_OF_MIND ? await demoteTopOfMindProjects(token) : [];

    const response = await strapiFetch(token, '/api/projects?populate=worldRef', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: toStrapiProjectWrite(body) }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to create project' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: normalizeProjectWorld(data.data), demoted });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

