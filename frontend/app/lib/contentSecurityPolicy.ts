/**
 * The Content-Security-Policy each page is sent with. `proxy.ts` builds it per
 * request, around a fresh nonce.
 *
 * Scripts are the point. A page runs only the scripts that carry this render's
 * nonce, and whatever those load (`'strict-dynamic'`), so an injected `<script>`
 * or inline handler doesn't run. Next puts the nonce on its own scripts when it
 * finds one in the request's CSP header; the root layout puts it on the theme
 * script. Nothing may eval, so zod is told not to try (`instrumentation-client.ts`).
 *
 * Styles stay `'unsafe-inline'`. A server-rendered `style` prop arrives as an
 * attribute, which no nonce can cover, and Radix's scroll lock and FullCalendar
 * inject `<style>` elements. With a nonce in the list, browsers would ignore
 * `'unsafe-inline'`.
 *
 * Enforced. Browsers send what it blocks to `/api/csp-report`, which logs it as
 * a `[csp]` line.
 *
 * It repeats `frame-ancestors 'none'` from `next.config.ts`, which sends that
 * on every response: a page's header comes from here and replaces the config's,
 * which would otherwise leave a page's framing to X-Frame-Options alone.
 */

export const CSP_HEADER = 'Content-Security-Policy';

/** Where browsers send violation reports: `app/api/csp-report/route.ts`. */
export const CSP_REPORT_PATH = '/api/csp-report';

/** 128 random bits, base64: one per page render, never reused. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function contentSecurityPolicy(nonce: string, { dev = false } = {}): string {
  return [
    "default-src 'self'",
    // `'self'` is only for browsers too old for 'strict-dynamic'; newer ones
    // ignore it. React's development build evals to rebuild server stack traces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'report-sample'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // daisyUI's tooltip arrows and spinners are data: SVGs, and FullCalendar's
    // icon font is a data: URL.
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ');
}
