import { NextRequest, NextResponse } from 'next/server';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title');

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title parameter is required' },
        { status: 400 }
      );
    }

    // Fetch system setting by title
    const response = await fetch(
      `${STRAPI_API_URL}/api/system-settings?filters[title][$eq]=${encodeURIComponent(title)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch system setting' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const settings = data.data || [];

    if (settings.length === 0) {
      return NextResponse.json({
        success: true,
        date: null,
        value: null,
      });
    }

    // Return the date and value from the first matching entry
    const setting = settings[0];
    const rawDate = setting.attributes?.date || setting.date || null;
    const rawValue = setting.attributes?.value || setting.value || null;
    
    // Normalize date to YYYY-MM-DD format if it's a full ISO timestamp
    let date: string | null = null;
    if (rawDate) {
      // Extract just the date part (YYYY-MM-DD) if it's a full timestamp
      date = rawDate.split('T')[0].split(' ')[0];
    }

    return NextResponse.json({
      success: true,
      date,
      value: rawValue,
    });
  } catch (error) {
    console.error('Error fetching system setting:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, date, value } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    // First, check if an entry with this title exists
    const getResponse = await fetch(
      `${STRAPI_API_URL}/api/system-settings?filters[title][$eq]=${encodeURIComponent(title)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to check existing setting' },
        { status: getResponse.status }
      );
    }

    const getData = await getResponse.json();
    const existingSettings = getData.data || [];

    if (existingSettings.length > 0) {
      // Update existing entry
      const existingSetting = existingSettings[0];
      const documentId = existingSetting.documentId || existingSetting.id;

      const updateResponse = await fetch(
        `${STRAPI_API_URL}/api/system-settings/${documentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              title,
              ...(date !== undefined && { date }),
              ...(value !== undefined && { value }),
            },
          }),
        }
      );

      if (!updateResponse.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to update system setting' },
          { status: updateResponse.status }
        );
      }

      const updateData = await updateResponse.json();
      return NextResponse.json({
        success: true,
        data: updateData.data,
      });
    } else {
      // Create new entry
      const createResponse = await fetch(`${STRAPI_API_URL}/api/system-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            title,
            ...(date !== undefined && { date }),
            ...(value !== undefined && { value }),
          },
        }),
      });

      if (!createResponse.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to create system setting' },
          { status: createResponse.status }
        );
      }

      const createData = await createResponse.json();
      return NextResponse.json({
        success: true,
        data: createData.data,
      });
    }
  } catch (error) {
    console.error('Error updating system setting:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

