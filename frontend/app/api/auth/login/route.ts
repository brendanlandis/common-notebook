import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies } from '@/app/lib/strapiAuth';
import { checkRateLimit, resetRateLimit } from '../rate-limiter';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    // Validate input
    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing identifier or password' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';

    // Check rate limit
    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
      const resetDate = new Date(rateLimitResult.resetAt);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many login attempts. Please try again later.',
          resetAt: resetDate.toISOString(),
        },
        { status: 429 }
      );
    }

    // Authenticate with Strapi
    const response = await fetch(`${STRAPI_API_URL}/api/auth/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Authentication failed
      return NextResponse.json(
        { 
          success: false, 
          error: data.error?.message || 'Authentication failed',
          remaining: rateLimitResult.remaining,
        },
        { status: 401 }
      );
    }

    // Authentication successful - reset rate limit for this IP
    resetRateLimit(ip);

    // Strapi runs in refresh mode, so /auth/local returns both tokens. Without
    // the refresh token the user would be logged out when the short-lived access
    // token expires.
    if (!data.refreshToken) {
      console.error('Login succeeded but Strapi returned no refreshToken. Is jwtManagement set to "refresh"?');
      return NextResponse.json(
        { success: false, error: 'Authentication misconfigured' },
        { status: 500 }
      );
    }

    const res = NextResponse.json({
      success: true,
      user: data.user,
    });

    setAuthCookies(res, { access: data.jwt, refresh: data.refreshToken });

    return res;
  } catch (error) {
    console.error('Error in login route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
