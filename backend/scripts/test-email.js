'use strict';

/**
 * Send a test email through whatever provider is configured.
 *
 * Usage:
 *   node scripts/test-email.js --to you@example.com
 *
 * Run this on the droplet after setting SMTP_* and EMAIL_FROM. It exercises the
 * exact path `/auth/forgot-password` uses — provider, credentials, and the `from`
 * address — so a misconfiguration surfaces here rather than as a locked-out beta
 * user whose reset link never arrived.
 *
 * A successful send is not a successful *delivery*: check the inbox, and check
 * the spam folder. If EMAIL_FROM's domain has no SPF/DKIM record, most receivers
 * will reject or bin the message even though SMTP said 250 OK.
 */

const path = require('path');

// Load `.env` ourselves. Strapi loads it too, but only once `createStrapi()` runs
// — and we inspect EMAIL_ENABLED *before* booting, to work out whether the running
// server would send. Without this, that check always saw `undefined` and warned
// even when the variable was correctly set. dotenv never overwrites an existing
// variable, so an explicit `EMAIL_ENABLED=false node scripts/test-email.js` wins.
require('dotenv').config({
  path: process.env.ENV_PATH || path.resolve(__dirname, '..', '.env'),
});

const args = process.argv.slice(2);

function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

async function main() {
  const to = arg('to');
  if (!to) {
    console.error('\nMissing --to <address>.\n');
    process.exit(1);
  }

  // Would the *running server* send, with this environment? Compute it before we
  // opt ourselves in, or the answer is always yes and the check is worthless.
  const serverWouldSend =
    process.env.EMAIL_ENABLED === 'true' ||
    (process.env.EMAIL_ENABLED === undefined && process.env.NODE_ENV === 'production');

  // This script exists to send a real email, so it opts into the guard in
  // config/plugins.ts. Must be set before the app boots.
  process.env.EMAIL_ENABLED = 'true';

  console.log('\n⚠ This will send a real email using the credentials in backend/.env.');
  if (!serverWouldSend) {
    console.log(
      '\n⚠ But the running Strapi server would NOT: EMAIL_ENABLED is unset and ' +
        `NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}. This script opts itself in, so a\n` +
        '  success here does not mean password-reset emails are being delivered.\n' +
        '  Set EMAIL_ENABLED=true in the environment the server runs under.'
    );
  }

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    // Strapi strips the `config:` wrapper from config/plugins.ts, so the key is
    // `plugin::email.provider` — not `plugin::email.config.provider`, which
    // silently returns undefined and made this script report `sendmail` while
    // nodemailer was actually in use.
    const provider = app.config.get('plugin::email.provider') ?? 'sendmail (Strapi default)';
    const settings = app.config.get('plugin::email.settings') ?? {};
    const host = process.env.SMTP_HOST;

    console.log('\nEmail configuration');
    console.log(`  provider:    ${provider}`);
    console.log(`  smtp host:   ${host || '(none — SMTP_HOST unset)'}`);
    console.log(`  smtp port:   ${process.env.SMTP_PORT || '587 (default)'}`);
    console.log(`  defaultFrom: ${settings.defaultFrom || '(unset)'}`);

    // The reset email uses its own `from`, stored in the users-permissions email
    // template rather than the provider settings. Show that too — they can differ.
    const store = app.store({ type: 'plugin', name: 'users-permissions', key: 'email' });
    const templates = (await store.get()) ?? {};
    const resetFrom = templates.reset_password?.options?.from;
    console.log(`  reset-password from: ${resetFrom ? `${resetFrom.name} <${resetFrom.email}>` : '(unset)'}`);

    if (!host) {
      console.log(
        '\n⚠ SMTP_HOST is unset, so Strapi is using the `sendmail` provider. It will try to send\n' +
          '  directly from this host and will almost certainly be rejected or spam-filtered.\n'
      );
    }
    if (!resetFrom?.email || resetFrom.email.endsWith('@strapi.io')) {
      console.log('⚠ The reset-password sender is still Strapi\'s default. Set EMAIL_FROM and reboot.\n');
    }

    console.log(`Sending to ${to} ...`);
    await app.plugin('email').service('email').send({
      to,
      subject: 'Common Notebook — email configuration test',
      text: 'If you are reading this, password-reset emails will reach their recipients.',
      html: '<p>If you are reading this, password-reset emails will reach their recipients.</p>',
    });

    console.log('\n✓ The provider accepted the message.');
    console.log('  Now check the inbox — and the spam folder. SMTP accepting a message is not delivery.\n');
  } catch (error) {
    console.error('\n✗ Send failed:\n');
    console.error(`  ${error.message}\n`);
    if (/auth/i.test(error.message)) {
      console.error('  Authentication failed. Check SMTP_USERNAME / SMTP_PASSWORD.');
    }
    if (/self signed|certificate/i.test(error.message)) {
      console.error('  TLS problem. Port 465 needs implicit TLS; 587 needs STARTTLS.');
    }
    process.exitCode = 1;
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
