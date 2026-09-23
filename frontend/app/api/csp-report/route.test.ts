// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const report = (fields: Record<string, unknown>) =>
  new NextRequest('http://localhost:3000/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': 'application/csp-report' },
    body: JSON.stringify({ 'csp-report': fields }),
  });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the CSP report sink', () => {
  it('logs one line saying what was blocked where, and answers 204', async () => {
    const res = await POST(
      report({
        'document-uri': 'https://commonnotebook.com/reset-password?code=secret-reset-code',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'inline',
        'source-file': 'https://commonnotebook.com/_next/static/chunks/a.js?v=1',
        'line-number': 3,
        'script-sample': 'self.__next_f.push',
      })
    );
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[csp] script-src-elem blocked inline on https://commonnotebook.com/reset-password, ' +
        'from https://commonnotebook.com/_next/static/chunks/a.js:3: "self.__next_f.push"'
    );
  });

  it('never logs a query string: a reset link carries its code there', async () => {
    await POST(
      report({
        'document-uri': 'https://commonnotebook.com/reset-password?code=secret-reset-code',
        'violated-directive': "img-src 'self'",
        'blocked-uri': 'https://tracker.example/pixel.gif?code=secret-reset-code#x',
      })
    );
    const line = String(warn.mock.calls[0][0]);
    expect(line).toBe(
      '[csp] img-src blocked https://tracker.example/pixel.gif on https://commonnotebook.com/reset-password'
    );
    expect(line).not.toContain('secret-reset-code');
  });

  it("drops a report about a browser extension's own script", async () => {
    await POST(report({ 'effective-directive': 'script-src-elem', 'blocked-uri': 'chrome-extension://abc/inject.js' }));
    await POST(report({ 'effective-directive': 'script-src-elem', 'blocked-uri': 'inline', 'source-file': 'moz-extension://abc/c.js' }));
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores a body that is not a report, or is too big to be one', async () => {
    const post = (body: string) =>
      POST(new NextRequest('http://localhost:3000/api/csp-report', { method: 'POST', body }));
    expect((await post('not json')).status).toBe(204);
    expect((await post('{"something":"else"}')).status).toBe(204);
    expect((await post(JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(20_000) } }))).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });
});
