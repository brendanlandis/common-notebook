import type { Core } from '@strapi/strapi';

import { createOwnershipMiddleware } from './ownership';
import { warnOnUnownedRows } from './ownership/preflight';
import { OWNED_CONTENT_TYPES, ownerIsRequestUser } from './ownership/rule';
import { seedAdvancedSettings, seedEmailTemplates, seedRolePermissions } from './permissions';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Tenant isolation. Sits beneath every content-API read and write, so no
    // controller can bypass it. See src/ownership/index.ts for the guards —
    // they are the hard part, and getting them wrong breaks login and the
    // admin panel silently.
    strapi.documents.use(
      createOwnershipMiddleware({
        strapi,
        contentTypes: OWNED_CONTENT_TYPES,
        rule: ownerIsRequestUser,
      })
    );
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Authorization lives in git, not in admin-UI checkboxes. Both of these are
    // authoritative: anything not declared in src/permissions is revoked.
    await seedRolePermissions(strapi);
    await seedAdvancedSettings(strapi);
    await seedEmailTemplates(strapi);

    // The middleware above fails closed, so an un-backfilled row is invisible to
    // everyone. Say so at boot rather than let it look like data loss.
    await warnOnUnownedRows(strapi, OWNED_CONTENT_TYPES);
  },
};
