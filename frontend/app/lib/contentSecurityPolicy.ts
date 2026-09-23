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
 * **Report-only for now.** Browsers send what it would have blocked to
 * `/api/csp-report`, which logs it. Once that log shows nothing the app needs,
 * enforcing it is a change to `CSP_HEADER` alone.
 *
 * Framing is refused separately, by an enforced policy in `next.config.ts` on
 * every response: a report-only `frame-ancestors` blocks nothing.
 */

export const CSP_HEADER = 'Content-Security-Policy-Report-Only';

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
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ');
}
