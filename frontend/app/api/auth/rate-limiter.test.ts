// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const request = (headers: Record<string, string>) => new Request('http://localhost:3000/api/auth/login', { headers });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('clientAddress', () => {
  it('reads the address nginx set, and never the X-Forwarded-For a visitor can write', async () => {
    const { clientAddress } = await import('./rate-limiter');
    expect(clientAddress(request({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '192.0.2.1' }))).toBe('203.0.113.5');
    expect(clientAddress(request({ 'x-forwarded-for': '192.0.2.1' }))).toBe('unknown');
  });

  it('says once, in production, that every visitor is sharing one bucket', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { clientAddress } = await import('./rate-limiter');
    clientAddress(request({}));
    clientAddress(request({}));
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('proxy_set_header X-Real-IP $remote_addr;');
  });

  it('stays quiet about it in development, where there is no nginx', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { clientAddress } = await import('./rate-limiter');
    expect(clientAddress(request({}))).toBe('unknown');
    expect(error).not.toHaveBeenCalled();
  });
});
