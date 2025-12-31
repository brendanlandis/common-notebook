import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, resetRateLimit } from '../rate-limiter';

const STRAPI_API_URL = process.env.STRAPI_API_URL;
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

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

    // Set HTTP-only cookie with JWT token
    const res = NextResponse.json({ 
      success: true, 
      user: data.user 
    });

    res.cookies.set('auth_token', data.jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Error in login route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
