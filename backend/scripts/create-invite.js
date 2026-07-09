'use strict';

/**
 * Mint an invite code.
 *
 * Usage:
 *   node scripts/create-invite.js
 *   node scripts/create-invite.js --email someone@example.com --days 14
 *   node scripts/create-invite.js --list
 *
 * The code is generated here rather than typed into the admin panel, because
 * `Invite: find` on the redemption token means the whole invite table is one
 * query away for anyone holding it. A guessable code would be worse than no
 * invite system at all.
 *
 * `--email` binds the invite to one address; redemption then requires a match.
 */

const crypto = require('crypto');

const args = process.argv.slice(2);
const LIST = args.includes('--list');

function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

/**
 * 160 bits, base32-ish alphabet with no look-alike characters (no 0/O, 1/I/l),
 * grouped for reading aloud. Far beyond guessing, still copy-pasteable.
 */
function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(20);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    if (LIST) {
      const invites = await app.documents('api::invite.invite').findMany({
        populate: ['usedBy'],
        limit: 100,
      });
      if (invites.length === 0) {
        console.log('\nNo invites yet.\n');
        return;
      }
      console.log('\nInvites:\n');
      for (const invite of invites) {
        const status = invite.usedAt
          ? `used ${String(invite.usedAt).slice(0, 10)} by ${invite.usedBy?.username ?? '?'}`
          : invite.expiresAt && new Date(invite.expiresAt) < new Date()
            ? 'EXPIRED'
            : 'unused';
        console.log(
          `  ${invite.code}  ${(invite.email || '—').padEnd(28)} ${status}`
        );
      }
      console.log('');
      return;
    }

    const email = arg('email');
    const days = arg('days') ? Number(arg('days')) : undefined;
    if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
      console.error('\n--days must be a positive number.\n');
      process.exitCode = 1;
      return;
    }

    const expiresAt = days
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const code = generateCode();
    await app.documents('api::invite.invite').create({
      data: { code, ...(email ? { email } : {}), ...(expiresAt ? { expiresAt } : {}) },
    });

    const base = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log('\nInvite created.\n');
    console.log(`  code:    ${code}`);
    if (email) console.log(`  email:   ${email} (redemption must use this address)`);
    console.log(`  expires: ${expiresAt ? expiresAt.slice(0, 10) : 'never'}`);
    console.log(`\n  Send them: ${base}/register?code=${code}\n`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
