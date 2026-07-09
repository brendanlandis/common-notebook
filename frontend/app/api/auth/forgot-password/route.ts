import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '../rate-limiter';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

/** Give up on the SMTP round-trip rather than hold a socket open indefinitely. */
const SEND_TIMEOUT_MS = 15_000;

/**
 * Ask Strapi to email a password-reset link.
 *
 * Answers immediately and unconditionally, without waiting for delivery. Two
 * reasons, and the second is the important one:
 *
 *  1. Sending is slow, and can hang. Strapi awaits the SMTP send inside the
 *     request, and nodemailer's default connection timeout is two minutes — so a
 *     blocked outbound port leaves the user staring at "sending…".
 *
 *  2. Strapi returns `{ok:true}` immediately for an address with no account, and
 *     only pays the SMTP cost for one that exists. Awaiting it would make a
 *     registered address measurably slower to answer than an unregistered one —
 *     a timing oracle for exactly the account enumeration the `{ok:true}` is
 *     meant to prevent.
 *
 * Failures are logged. They cannot be reported to the caller without revealing
 * whether the address exists.
 */
function requestResetEmail(email: string): void {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  fetch(`${STRAPI_API_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(`Strapi forgot-password failed (${response.status}): ${body.slice(0, 300)}`);
      }
    })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        console.error(
          `forgot-password timed out after ${SEND_TIMEOUT_MS}ms. ` +
            'Is outbound SMTP blocked? Try: node scripts/test-email.js --to you@example.com'
        );
      } else {
        console.error('forgot-password request failed:', error);
      }
    })
    .finally(() => clearTimeout(timer));
}

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

    requestResetEmail(String(email));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    // Same answer as success: never reveal whether the address exists.
    return NextResponse.json({ success: true });
  }
}
