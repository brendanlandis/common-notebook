'use strict';

/**
 * Diagnose SMTP configuration without sending anything.
 *
 * Usage (on the droplet, with the prod env loaded):
 *   node scripts/check-smtp.js
 *
 * Answers the two questions that "stuck on sending…" cannot distinguish:
 *
 *   1. Can this host even reach the relay? Hosting providers — DigitalOcean
 *      included — block outbound SMTP ports by default. A blocked port drops the
 *      SYN, so the connection hangs rather than being refused, and nodemailer's
 *      default 2-minute timeout makes it look like the app is broken.
 *
 *   2. Do the credentials work? `transporter.verify()` connects, negotiates TLS
 *      and authenticates, without sending mail.
 *
 * Reads the same environment variables Strapi does, so it tests what will
 * actually run — not a guess at it.
 */

const net = require('net');
const path = require('path');
const nodemailer = require('nodemailer');

// Unlike the other scripts, this one never boots Strapi — so nothing has loaded
// `.env` for us. Resolve it relative to this file rather than the cwd, and honour
// Strapi's own ENV_PATH override. dotenv never overwrites a variable that is
// already set, so an explicit `SMTP_PORT=2587 node scripts/check-smtp.js` still
// wins, exactly as it does for Strapi.
require('dotenv').config({
  path: process.env.ENV_PATH || path.resolve(__dirname, '..', '.env'),
});

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT || 587);
const USER = process.env.SMTP_USERNAME;
const PASS = process.env.SMTP_PASSWORD;
const FROM = process.env.EMAIL_FROM;

/** Forward Email's alternates exist to route around exactly these blocks. */
const CANDIDATE_PORTS = [
  { port: 25, tls: 'STARTTLS', note: 'almost always blocked outbound' },
  { port: 587, tls: 'STARTTLS', note: 'standard submission' },
  { port: 465, tls: 'implicit', note: 'standard, implicit TLS' },
  { port: 2587, tls: 'STARTTLS', note: 'alternate' },
  { port: 2465, tls: 'implicit', note: 'alternate' },
  { port: 2525, tls: 'STARTTLS', note: 'alternate' },
];

const TIMEOUT_MS = 6000;

function probe(host, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    const done = (result) => {
      socket.destroy();
      resolve({ ...result, ms: Date.now() - started });
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once('connect', () => done({ ok: true }));
    socket.once('timeout', () => done({ ok: false, reason: 'timed out (port likely blocked)' }));
    socket.once('error', (err) => done({ ok: false, reason: err.code || err.message }));
    socket.connect(port, host);
  });
}

async function main() {
  console.log('\nSMTP configuration');
  console.log(`  SMTP_HOST      ${HOST || '(unset)'}`);
  console.log(`  SMTP_PORT      ${process.env.SMTP_PORT || '(unset — defaults to 587)'}`);
  console.log(`  SMTP_USERNAME  ${USER || '(unset)'}`);
  console.log(`  SMTP_PASSWORD  ${PASS ? `set, ${PASS.length} chars` : '(unset)'}`);
  console.log(`  EMAIL_FROM     ${FROM || '(unset)'}`);

  if (!HOST) {
    console.error('\n✗ SMTP_HOST is unset — Strapi will use the `sendmail` provider and mail will not arrive.\n');
    process.exit(1);
  }

  console.log(`\nReachability of ${HOST} from this host:`);
  const reachable = [];
  for (const { port, tls, note } of CANDIDATE_PORTS) {
    const result = await probe(HOST, port);
    const mark = result.ok ? '✓' : '✗';
    const detail = result.ok ? `open (${result.ms}ms)` : result.reason;
    const current = port === PORT ? '  ← SMTP_PORT' : '';
    console.log(`  ${mark} ${String(port).padStart(5)}  ${tls.padEnd(9)} ${detail.padEnd(34)} ${note}${current}`);
    if (result.ok) reachable.push(port);
  }

  if (reachable.length === 0) {
    console.error(
      '\n✗ Every SMTP port is blocked from this host.\n' +
        '  DigitalOcean blocks outbound SMTP by default; open a support ticket to lift it.\n' +
        '  Until then no SMTP provider will work from this droplet.\n'
    );
    process.exit(1);
  }

  if (!reachable.includes(PORT)) {
    console.error(
      `\n✗ SMTP_PORT=${PORT} is not reachable, but ${reachable.join(', ')} ${reachable.length > 1 ? 'are' : 'is'}.\n` +
        `  Set SMTP_PORT to one of those. 465 and 2465 use implicit TLS; 25, 587, 2587\n` +
        `  and 2525 use STARTTLS. config/plugins.ts derives that from the port, so any\n` +
        `  of them works — just don't invent one.\n`
    );
    process.exit(1);
  }

  if (!USER || !PASS) {
    console.error('\n✗ SMTP_USERNAME / SMTP_PASSWORD are not both set; cannot test authentication.\n');
    process.exit(1);
  }

  console.log(`\nAuthenticating on port ${PORT} ...`);
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    // Must match config/plugins.ts, or this script tests something Strapi won't do.
    secure: [465, 2465].includes(PORT),
    auth: { user: USER, pass: PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transporter.verify();
    console.log('\n✓ Connected, negotiated TLS, and authenticated.');
    console.log('  Now send one for real:  node scripts/test-email.js --to you@example.com\n');
  } catch (error) {
    console.error(`\n✗ ${error.message}\n`);
    const message = String(error.message).toLowerCase();
    if (message.includes('invalid login') || message.includes('auth') || error.responseCode === 535) {
      console.error('  Authentication was refused. Check SMTP_USERNAME and SMTP_PASSWORD.');
      console.error('  Forward Email wants the full alias address as the username, and a password');
      console.error('  generated for that alias — not your account password.');
    } else if (message.includes('timeout')) {
      console.error('  Connected but the handshake stalled. Wrong TLS mode for this port?');
      console.error('  465/2465 are implicit TLS; 587/2587/2525 are STARTTLS.');
    } else if (message.includes('certificate') || message.includes('self signed')) {
      console.error('  TLS negotiation failed — check the port matches the TLS mode.');
    }
    console.error('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
