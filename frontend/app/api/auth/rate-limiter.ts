// Simple in-memory rate limiter for authentication attempts.
//
// In-process by design: correct on the single-process droplet, exactly like the
// moon-phase mutex. It would need a shared store behind multiple instances.
//
// Buckets are namespaced per action. With a single bucket keyed only on IP, five
// forgot-password requests would lock you out of logging in.
//
// Two kinds of bucket. One counts a visitor's attempts, keyed on their address.
// The other counts what happens to one account from any address, so spreading
// guesses over many addresses gets no further. It counts whatever was typed,
// existing or not, so a refusal says nothing about which accounts exist.
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

const MINUTE = 60 * 1000;

const LIMITS = {
  // Per address: every attempt counts.
  login: { max: 5, windowMs: 15 * MINUTE },
  'redeem-invite': { max: 5, windowMs: 15 * MINUTE },
  'forgot-password': { max: 5, windowMs: 15 * MINUTE },
  'reset-password': { max: 5, windowMs: 15 * MINUTE },
  // Per account. Failed logins only; more than one address's worth, so no single
  // visitor can lock someone out.
  'login-account': { max: 10, windowMs: 15 * MINUTE },
  // Reset emails to one address, however many visitors ask for them.
  'reset-email': { max: 3, windowMs: 60 * MINUTE },
};

/** Each action gets its own bucket. */
export type RateLimitScope = keyof typeof LIMITS;

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 30 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 30 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** Count an attempt against `key`'s bucket, and say whether it's within the limit. */
export function checkRateLimit(key: string, scope: RateLimitScope): RateLimitResult {
  const { max, windowMs } = LIMITS[scope];
  const now = Date.now();

  const bucket = `${scope}:${key}`;
  let entry = rateLimitStore.get(bucket);

  // If no entry exists or the window has expired, create a new one
  if (!entry || now > entry.resetAt) {
    entry = {
      attempts: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(bucket, entry);
    return {
      allowed: true,
      remaining: max - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment attempts
  entry.attempts++;

  // Check if limit exceeded
  if (entry.attempts > max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: max - entry.attempts,
    resetAt: entry.resetAt,
  };
}

/** Whether `key`'s bucket is already full, without counting anything. */
export function isRateLimited(key: string, scope: RateLimitScope): boolean {
  const entry = rateLimitStore.get(`${scope}:${key}`);
  return entry !== undefined && Date.now() <= entry.resetAt && entry.attempts >= LIMITS[scope].max;
}

export function resetRateLimit(key: string, scope: RateLimitScope): void {
  rateLimitStore.delete(`${scope}:${key}`);
}

/** The account a login or reset names, as a bucket key: case and spacing don't make a new one. */
export function accountKey(identifier: unknown): string {
  return String(identifier).trim().toLowerCase();
}
