import { NextRequest, NextResponse } from 'next/server';

/**
 * Where browsers report what the page policy would have blocked
 * (`app/lib/contentSecurityPolicy.ts`, report-only for now). Each report is one
 * `[csp]` line in the log, so the policy can be enforced once the log shows
 * nothing the app needs.
 *
 * Anyone can post here, signed in or not, so it only ever logs, and only a few
 * short fields. Addresses lose their query string (a reset link's is its code).
 * Reports about a browser extension's own scripts are dropped as noise.
 */

const MAX_BODY_BYTES = 16 * 1024;
const EXTENSION = /^(chrome|moz|safari-web)-extension:/;

/** The fields used from a `report-uri` report: `{ "csp-report": { ... } }`. */
interface CspReport {
  'document-uri'?: unknown;
  'effective-directive'?: unknown;
  'violated-directive'?: unknown;
  'blocked-uri'?: unknown;
  'source-file'?: unknown;
  'line-number'?: unknown;
  'script-sample'?: unknown;
}

export async function POST(req: NextRequest) {
  const report = await readReport(req);
  if (report && !fromExtension(report)) {
    console.warn(`[csp] ${describe(report)}`);
  }
  return new NextResponse(null, { status: 204 });
}

async function readReport(req: NextRequest): Promise<CspReport | null> {
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return null;
    const report = JSON.parse(text)?.['csp-report'];
    return report && typeof report === 'object' ? report : null;
  } catch {
    return null;
  }
}

function fromExtension(report: CspReport): boolean {
  return [report['source-file'], report['blocked-uri']].some(
    (uri) => typeof uri === 'string' && EXTENSION.test(uri)
  );
}

/** `script-src-elem blocked inline on /login, from /_next/static/chunks/a.js:3: "sample"` */
function describe(report: CspReport): string {
  const directive = text(report['effective-directive']) ?? text(report['violated-directive'])?.split(' ')[0];
  const source = text(report['source-file']);
  const line = typeof report['line-number'] === 'number' ? `:${report['line-number']}` : '';
  const sample = text(report['script-sample']);
  return [
    `${directive ?? '?'} blocked ${address(report['blocked-uri'])} on ${address(report['document-uri'])}`,
    source ? `, from ${address(source)}${line}` : '',
    sample ? `: ${JSON.stringify(sample)}` : '',
  ].join('');
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value.slice(0, 80) : undefined;
}

/** A URL without its query or fragment, or a keyword (`inline`, `eval`) as sent. */
function address(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '?';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return url.protocol;
    return url.origin + url.pathname;
  } catch {
    return value.slice(0, 40);
  }
}
