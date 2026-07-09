/**
 * The authorization surface, in git.
 *
 * Until now, "who can do what" lived only as checkboxes in the Strapi admin UI,
 * stored in the database. Nothing versioned it, nothing reviewed a change to it,
 * and prod and dev had already drifted apart without anyone noticing.
 *
 * These seeders run on every boot and are AUTHORITATIVE: anything not listed
 * here is revoked. A stray click does not survive a restart.
 *
 * NOT in `src/policies/` or `src/middlewares/` — Strapi auto-loads those and
 * expects a particular export shape.
 */

import { OWNED_CONTENT_TYPES } from '../ownership/rule';

const CRUD = ['find', 'findOne', 'create', 'update', 'delete'] as const;

/**
 * Every endpoint the frontend actually calls, and nothing more. Verified against
 * `grep -r '${STRAPI_API_URL}/api/' frontend/app frontend/proxy.ts`: the four
 * owned collections, plus `/api/users/me` and `/api/auth/local`.
 *
 * Deliberately absent, though Strapi enables them by default:
 *   auth.register              — invite-only; §3b also sets allow_register=false
 *   auth.connect               — OAuth providers, unused
 *   auth.emailConfirmation     — email_confirmation=false
 *   auth.sendEmailConfirmation
 *   auth.forgotPassword        — add when password reset lands (Stage 5)
 *   auth.resetPassword         — ditto
 *   auth.changePassword        — nothing calls it yet
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  public: [
    // POST /api/auth/local
    'plugin::users-permissions.auth.callback',
    // POST /api/auth/refresh — the caller's access token is expired by
    // definition, so this cannot require the authenticated role. The refresh
    // token in the body is the credential.
    'plugin::users-permissions.auth.refresh',
  ],
  authenticated: [
    ...OWNED_CONTENT_TYPES.flatMap((uid) => CRUD.map((action) => `${uid}.${action}`)),
    // GET /api/users/me — frontend/proxy.ts calls this on every navigation.
    'plugin::users-permissions.user.me',
    // POST /api/auth/logout — revokes the session row, which is the only thing
    // that makes logout mean anything. Requires a valid access token.
    'plugin::users-permissions.auth.logout',
  ],
};

export async function seedRolePermissions(strapi: any) {
  for (const [type, wanted] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await strapi.query('plugin::users-permissions.role').findOne({ where: { type } });
    if (!role) {
      strapi.log.warn(`[permissions] no "${type}" role found; skipping`);
      continue;
    }

    const existing = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: { id: role.id } } });

    const have = new Set(existing.map((p: any) => p.action));
    const want = new Set(wanted);

    const added: string[] = [];
    for (const action of want) {
      if (!have.has(action)) {
        await strapi
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: role.id } });
        added.push(action);
      }
    }

    const removed: string[] = [];
    for (const permission of existing) {
      if (!want.has(permission.action)) {
        await strapi.query('plugin::users-permissions.permission').delete({ where: { id: permission.id } });
        removed.push(permission.action);
      }
    }

    if (added.length || removed.length) {
      strapi.log.info(
        `[permissions] ${type}: +${added.length} -${removed.length}` +
          (added.length ? `\n           granted: ${added.join(', ')}` : '') +
          (removed.length ? `\n           revoked: ${removed.join(', ')}` : '')
      );
    }
  }
}

/**
 * The users-permissions "Advanced settings" blob, which lives in
 * `strapi_core_store_settings` under `plugin_users-permissions_advanced`.
 *
 * `allow_register: false` is what actually closes `POST /api/auth/local/register`.
 * An invite system in the Next.js layer is worthless without it — Strapi's host
 * is reachable directly.
 */
export async function seedAdvancedSettings(strapi: any) {
  const store = strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' });
  const current = (await store.get()) ?? {};

  const frontendUrl = strapi.config.get('server.frontendUrl') || process.env.FRONTEND_URL;
  if (!frontendUrl) {
    strapi.log.warn(
      '[permissions] FRONTEND_URL is unset — password-reset emails would link nowhere. ' +
        'Set it before enabling password reset (Stage 5).'
    );
  }

  const desired = {
    ...current,
    allow_register: false,
    email_confirmation: false,
    unique_email: true,
    default_role: 'authenticated',
    ...(frontendUrl ? { email_reset_password: `${frontendUrl}/reset-password` } : {}),
  };

  const changed = Object.keys(desired).filter(
    (k) => JSON.stringify(current[k]) !== JSON.stringify(desired[k])
  );
  if (changed.length === 0) return;

  await store.set({ value: desired });
  strapi.log.info(
    `[permissions] advanced settings updated: ` +
      changed.map((k) => `${k}=${JSON.stringify(desired[k])}`).join(', ')
  );
}
