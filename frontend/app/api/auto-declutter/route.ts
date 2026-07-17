import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/lib/strapiAuth';
import { setAutoDeclutter } from '@/app/lib/moonPhaseReset';

/**
 * Write the auto-declutter toggle.
 *
 * Separate from the generic `/api/system-settings` handler because switching
 * this setting on is not a plain write: it also arms the declutter watermark,
 * so that "enable" means "wait for the next new moon" rather than "declutter
 * now". `setAutoDeclutter` owns that pairing; the generic handler stays generic.
 */
export async function PUT(req: NextRequest) {
  try {
    const token = await getAccessToken(req);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { enabled } = await req.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    const ok = await setAutoDeclutter(token, enabled);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to save auto-declutter setting' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating auto-declutter setting:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
