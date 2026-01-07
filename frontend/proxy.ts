import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page without authentication
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Allow access to API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // For all other routes, check authentication
  const token = request.cookies.get('auth_token');

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Validate token with Strapi
  const STRAPI_API_URL = process.env.STRAPI_API_URL;
  
  try {
    const response = await fetch(`${STRAPI_API_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });

    if (!response.ok) {
      // Token is invalid, clear it and redirect to login
      const loginUrl = new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      return res;
    }

    // Token is valid, allow access
    return NextResponse.next();
  } catch (error) {
    // Network error or other issue - redirect to login
    const loginUrl = new URL('/login', request.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|favicon.ico).*)'],
};

