import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies } from '@/app/lib/strapiAuth';
import { seedDefaultSettings } from '@/app/lib/defaultSettings';
import { checkRateLimit, resetRateLimit } from '../rate-limiter';

const STRAPI_API_URL = process.env.STRAPI_API_URL;
const STRAPI_INVITE_TOKEN = process.env.STRAPI_INVITE_TOKEN;

interface Invite {
  documentId: string;
  code: string;
  email: string | null;
  expiresAt: string | null;
  usedAt: string | null;
}

/**
 * Look up an invite by its code.
 *
 * The filter is built here, server-side, from the single `code` value. The
 * invite token holds `find` on the collection, so `GET /api/invites` with no
 * filter returns every code — forwarding a caller's query params into this
 * request would turn a code lookup into an invite dump.
 */
async function findInvite(code: string): Promise<Invite | null> {
  const url = `${STRAPI_API_URL}/api/invites?filters[code][$eq]=${encodeURIComponent(code)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${STRAPI_INVITE_TOKEN}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const body = await response.json();
  return body.data?.[0] ?? null;
}

/**
 * The id of the `authenticated` role, cached for the life of the process.
 *
 * `POST /api/users` needs one: despite the controller falling back to
 * `advanced.default_role` when `role` is absent, `validateCreateUserBody` runs
 * first and marks `role` required — so the fallback is unreachable through the
 * content API. Hence the invite token also carries `Role: find` (read-only).
 */
let cachedRoleId: number | null = null;

async function getAuthenticatedRoleId(): Promise<number | null> {
  if (cachedRoleId !== null) return cachedRoleId;

  const response = await fetch(`${STRAPI_API_URL}/api/users-permissions/roles`, {
    headers: { Authorization: `Bearer ${STRAPI_INVITE_TOKEN}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    console.error(`Could not list roles (${response.status}); does the invite token have Role: find?`);
    return null;
  }

  const body = await response.json();
  const role = body.roles?.find((r: { type: string }) => r.type === 'authenticated');
  if (!role) return null;

  cachedRoleId = role.id;
  return cachedRoleId;
}

/**
 * Mark the invite spent, or release it again.
 *
 * `usedBy` is deliberately absent. It is a `private` field, and the content API
 * rejects private fields in a request body outright (`400 Invalid key usedBy`) —
 * the same rule that stops a client choosing its own `owner`. Recording who
 * redeemed an invite needs `usedBy` un-privated in the Content-Type Builder.
 */
async function setInviteUsedAt(invite: Invite, usedAt: string | null): Promise<boolean> {
  const response = await fetch(`${STRAPI_API_URL}/api/invites/${invite.documentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_INVITE_TOKEN}`,
    },
    body: JSON.stringify({ data: { usedAt } }),
    cache: 'no-store',
  });
  return response.ok;
}

/**
 * One redemption per code at a time.
 *
 * Strapi offers no compare-and-set, so two concurrent requests could both read
 * `usedAt: null` before either wrote. In-process, like the moon-phase mutex and
 * the rate limiter; correct on the single-process droplet.
 */
const redeeming = new Set<string>();

export async function POST(req: NextRequest) {
  if (!STRAPI_INVITE_TOKEN) {
    console.error('STRAPI_INVITE_TOKEN is unset; invite redemption is disabled');
    return NextResponse.json(
      { success: false, error: 'Registration is unavailable' },
      { status: 503 }
    );
  }

  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rateLimit = checkRateLimit(ip, 'redeem-invite');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { code, username, email, password } = await req.json();
    if (!code || !username || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing invite code, username, email, or password' },
        { status: 400 }
      );
    }

    const trimmedCode = String(code).trim();

    // One message for every failure mode. Distinguishing "no such code" from
    // "already used" would let someone probe the invite table.
    const invalid = NextResponse.json(
      { success: false, error: 'That invite code is not valid' },
      { status: 400 }
    );

    if (redeeming.has(trimmedCode)) return invalid;
    redeeming.add(trimmedCode);

    try {
      const invite = await findInvite(trimmedCode);

      if (!invite) return invalid;
      if (invite.usedAt) return invalid;
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return invalid;
      if (invite.email && invite.email.toLowerCase() !== String(email).toLowerCase()) return invalid;

      const roleId = await getAuthenticatedRoleId();
      if (roleId === null) {
        return NextResponse.json(
          { success: false, error: 'Registration is unavailable' },
          { status: 503 }
        );
      }

      // Spend the invite BEFORE creating the account. If this write fails we must
      // not proceed: an account paired with a still-valid invite is exactly how a
      // single code gets redeemed twice.
      if (!(await setInviteUsedAt(invite, new Date().toISOString()))) {
        console.error(`Could not consume invite ${invite.documentId}; refusing to create an account`);
        return NextResponse.json(
          { success: false, error: 'Registration is unavailable' },
          { status: 503 }
        );
      }

      const createResponse = await fetch(`${STRAPI_API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STRAPI_INVITE_TOKEN}`,
        },
        body: JSON.stringify({
          username,
          email,
          password,
          confirmed: true,
          blocked: false,
          role: roleId,
        }),
        cache: 'no-store',
      });

      if (!createResponse.ok) {
        // Give the invite back — the caller never got an account. Best-effort: if
        // this fails the invite is burned, which is the safe direction.
        if (!(await setInviteUsedAt(invite, null))) {
          console.error(`Failed to release invite ${invite.documentId} after a failed signup`);
        }
        const error = await createResponse.json().catch(() => ({}));
        // "Email already taken" / "Username already taken" are safe to surface:
        // the caller already proved they hold a valid invite.
        return NextResponse.json(
          { success: false, error: error?.error?.message || 'Could not create the account' },
          { status: 400 }
        );
      }

      // Log the new user in.
      const loginResponse = await fetch(`${STRAPI_API_URL}/api/auth/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
        cache: 'no-store',
      });

      if (!loginResponse.ok) {
        // The account exists and the invite is spent; they can just log in.
        return NextResponse.json({ success: true, requiresLogin: true });
      }

      const { jwt, refreshToken } = await loginResponse.json();
      await seedDefaultSettings(jwt);

      resetRateLimit(ip, 'redeem-invite');

      const res = NextResponse.json({ success: true, user: { username, email } });
      setAuthCookies(res, { access: jwt, refresh: refreshToken });
      return res;
    } finally {
      redeeming.delete(trimmedCode);
    }
  } catch (error) {
    console.error('Error redeeming invite:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
