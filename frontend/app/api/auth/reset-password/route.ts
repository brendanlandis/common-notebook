import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies } from '@/app/lib/strapiAuth';
import { checkRateLimit } from '../rate-limiter';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

/**
 * Complete a password reset using the token from the emailed link.
 *
 * Strapi rotates the user's sessions on a password change, so the tokens it
 * returns here are the only valid ones. We set them, logging the user straight
 * in — anyone still holding an old refresh token is out.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rateLimit = checkRateLimit(ip, 'reset-password');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { code, password, passwordConfirmation } = await req.json();
    if (!code || !password || !passwordConfirmation) {
      return NextResponse.json(
        { success: false, error: 'Missing reset code or password' },
        { status: 400 }
      );
    }

    const response = await fetch(`${STRAPI_API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, password, passwordConfirmation }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data?.error?.message || 'That reset link is invalid or has expired',
        },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ success: true });

    // In refresh mode Strapi returns both tokens; without the refresh token the
    // user would be logged out again in 30 minutes.
    if (data.jwt && data.refreshToken) {
      setAuthCookies(res, { access: data.jwt, refresh: data.refreshToken });
    } else {
      console.error('reset-password returned no refreshToken; is jwtManagement "refresh"?');
      return NextResponse.json({ success: true, requiresLogin: true });
    }

    return res;
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
