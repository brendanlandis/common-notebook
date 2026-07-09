import { describe, expect, it } from 'vitest';

import { ROLE_PERMISSIONS } from '../index';
import { OWNED_CONTENT_TYPES } from '../../ownership/rule';

describe('ROLE_PERMISSIONS — the authorization surface, in git', () => {
  it('grants the public role exactly two things: logging in, and refreshing', () => {
    // `auth.refresh` cannot require the authenticated role: by definition the
    // caller's access token has expired. The refresh token is the credential.
    expect(ROLE_PERMISSIONS.public).toEqual([
      'plugin::users-permissions.auth.callback',
      'plugin::users-permissions.auth.refresh',
    ]);
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
