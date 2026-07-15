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
    const projects = await fetchAllPages(token, '/api/projects?populate=worldRef');
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

    // Only one project may be "top of mind" at a time.
    if (body.importance === TOP_OF_MIND) {
      await demoteTopOfMindProjects(token);
    }

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
    return NextResponse.json({ success: true, data: normalizeProjectWorld(data.data) });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

