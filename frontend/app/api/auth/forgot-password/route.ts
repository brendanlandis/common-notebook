import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '../rate-limiter';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

/**
 * Ask Strapi to email a password-reset link.
 *
 * Strapi answers `{ ok: true }` whether or not the address has an account, so
 * this endpoint cannot be used to discover who has one. We mirror that: the
 * response never reveals whether the email was found, even when sending fails.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Sending mail is expensive and abusable; rate-limit as hard as login.
    const rateLimit = checkRateLimit(ip, 'forgot-password');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Enter an email' }, { status: 400 });
    }

    const response = await fetch(`${STRAPI_API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });

    if (!response.ok) {
      // Most likely no email provider configured. Log it; don't tell the caller,
      // and don't imply the address was unknown.
      console.error(`Strapi forgot-password failed: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return NextResponse.json({ success: true });
  }
}
