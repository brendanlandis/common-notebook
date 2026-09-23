import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { TOP_OF_MIND, demoteTopOfMindProjects } from '@/app/lib/projectImportance';
import { normalizeProjectWorld, toStrapiProjectWrite } from '@/app/lib/worldNormalize';
import { errorResponse } from '@/app/lib/errorResponse';
import { strapiFetch } from '@/app/lib/strapiServer';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Stamp/clear completedAt here rather than trust the client's clock, so the
    // Revive list's sort has one authoritative time. Only touched when `complete`
    // is present in the write — an ordinary edit (name, world, …) leaves it be.
    const write = { ...body };
    if (body.complete === true) write.completedAt = new Date().toISOString();
    else if (body.complete === false) write.completedAt = null;

    // Only one project may be "top of mind" at a time. The ids come back so the
    // response can name them: these rows change without the client ever asking,
    // and it has no other way to learn they were demoted.
    const demoted =
      body.importance === TOP_OF_MIND ? await demoteTopOfMindProjects(token, documentId) : [];

    const response = await strapiFetch(
      token,
      `/api/projects/${documentId}?populate=worldRef`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: toStrapiProjectWrite(write) }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to update project' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data: normalizeProjectWorld(data.data), demoted });
  } catch (error) {
    return errorResponse('Error updating project:', error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const response = await strapiFetch(
      token,
      `/api/projects/${documentId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Failed to delete project' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('Error deleting project:', error);
  }
}

