import { describe, expect, it } from 'vitest';

import { ROLE_PERMISSIONS } from './index';
import { OWNED_CONTENT_TYPES } from '../ownership/rule';

describe('ROLE_PERMISSIONS — the authorization surface, in git', () => {
  it('grants the public role only login, refresh, and password reset', () => {
    // `auth.refresh` cannot require the authenticated role: by definition the
    // caller's access token has expired. The refresh token is the credential.
    // The reset pair is authenticated by the emailed token; `forgotPassword`
    // answers ok for unknown addresses, so it leaks no account existence.
    expect(ROLE_PERMISSIONS.public).toEqual([
      'plugin::users-permissions.auth.callback',
      'plugin::users-permissions.auth.refresh',
      'plugin::users-permissions.auth.forgotPassword',
      'plugin::users-permissions.auth.resetPassword',
    ]);
  });

  it('never grants a way to create an account through a role', () => {
    // Accounts come only from /api/auth/redeem-invite, which uses a scoped API
    // token. `user.create` here would be a public signup endpoint.
    const all = [...ROLE_PERMISSIONS.public, ...ROLE_PERMISSIONS.authenticated];
    expect(all).not.toContain('plugin::users-permissions.user.create');
  });

  it('lets an authenticated user revoke their own sessions', () => {
    // Logout is the only thing that makes a year-long refresh token safe.
    expect(ROLE_PERMISSIONS.authenticated).toContain('plugin::users-permissions.auth.logout');
  });

  it('never grants public registration — an invite system is bypassable without this', () => {
    // `allow_register: false` (seedAdvancedSettings) is the other half. Both must hold.
    expect(ROLE_PERMISSIONS.public).not.toContain('plugin::users-permissions.auth.register');
    expect(ROLE_PERMISSIONS.authenticated).not.toContain('plugin::users-permissions.auth.register');
  });

  it('grants authenticated users full CRUD on every owned content type', () => {
    for (const uid of OWNED_CONTENT_TYPES) {
      for (const action of ['find', 'findOne', 'create', 'update', 'delete']) {
        expect(ROLE_PERMISSIONS.authenticated).toContain(`${uid}.${action}`);
      }
    }
  });

  it('grants /api/users/me — frontend/proxy.ts calls it on every navigation', () => {
    expect(ROLE_PERMISSIONS.authenticated).toContain('plugin::users-permissions.user.me');
  });

  it('grants nothing on the Invite type: only the scoped API token may touch it', () => {
    const all = [...ROLE_PERMISSIONS.public, ...ROLE_PERMISSIONS.authenticated];
    expect(all.filter((a) => a.startsWith('api::invite'))).toEqual([]);
  });

  it('grants no content-type permissions to the public role', () => {
    expect(ROLE_PERMISSIONS.public.filter((a) => a.startsWith('api::'))).toEqual([]);
  });

  it('lists no duplicates (the seeder is authoritative; duplicates would churn)', () => {
    for (const [role, actions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(new Set(actions).size, `role=${role}`).toBe(actions.length);
    }
  });
});
