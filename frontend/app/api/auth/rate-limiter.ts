// Simple in-memory rate limiter for authentication attempts.
//
// In-process by design: correct on the single-process droplet, exactly like the
// moon-phase mutex. It would need a shared store behind multiple instances.
//
// Buckets are namespaced per action. With a single bucket keyed only on IP, five
// forgot-password requests would lock you out of logging in.
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

/** Each action gets its own bucket. */
export type RateLimitScope = 'login' | 'redeem-invite' | 'forgot-password' | 'reset-password';

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 30 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, 30 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(ip: string, scope: RateLimitScope = 'login'): RateLimitResult {
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();

  const key = `${scope}:${ip}`;
  let entry = rateLimitStore.get(key);

  // If no entry exists or the window has expired, create a new one
  if (!entry || now > entry.resetAt) {
    entry = {
      attempts: 1,
      resetAt: now + WINDOW_MS,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment attempts
  entry.attempts++;

  // Check if limit exceeded
  if (entry.attempts > MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: MAX_ATTEMPTS - entry.attempts,
    resetAt: entry.resetAt,
  };
}

export function resetRateLimit(ip: string, scope: RateLimitScope = 'login'): void {
  rateLimitStore.delete(`${scope}:${ip}`);
}
