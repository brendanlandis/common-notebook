// Simple in-memory rate limiter for login attempts
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

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

export function checkRateLimit(ip: string): RateLimitResult {
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();

  let entry = rateLimitStore.get(ip);

  // If no entry exists or the window has expired, create a new one
  if (!entry || now > entry.resetAt) {
    entry = {
      attempts: 1,
      resetAt: now + WINDOW_MS,
    };
    rateLimitStore.set(ip, entry);
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

export function resetRateLimit(ip: string): void {
  rateLimitStore.delete(ip);
}
