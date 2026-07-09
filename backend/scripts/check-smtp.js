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
const os = require('os');
const path = require('path');
const dns = require('dns').promises;
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

/**
 * Connect, optionally pinning the address family.
 *
 * `autoSelectFamily: false` matters. Node ≥20 defaults to Happy Eyeballs, which
 * silently falls back from IPv6 to IPv4 — so an unpinned probe reports success on
 * a host where nodemailer fails. Nodemailer resolves A and AAAA itself and then
 * picks one **at random** (`shared/index.js`: `addresses[Math.floor(Math.random()
 * * addresses.length)]`), so it has no such fallback on the first attempt.
 */
function probe(host, port, family) {
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
    socket.connect(family ? { host, port, family, autoSelectFamily: false } : { host, port });
  });
}

const isGlobalIPv6 = (address) =>
  !address.startsWith('fe80') && !address.startsWith('fc') && !address.startsWith('fd');

/**
 * Does nodemailer's IPv6 guess match reality?
 *
 * It resolves AAAA whenever *any* non-internal interface has an IPv6 address —
 * a link-local `fe80::` counts. Then it picks from A+AAAA **at random**. On a host
 * with no IPv6 route that means half of all sends fail with ENETUNREACH.
 *
 * `config/plugins.ts` pins SMTP to IPv4 when there is no globally-routable IPv6,
 * so this reports what will actually happen rather than what a bare socket does.
 * Note we connect to a AAAA *literal*: connecting to a hostname with `family: 6`
 * can return an IPv4-mapped `::ffff:` address and look like a success.
 */
async function checkAddressFamilies(host, port) {
  const [v4, v6] = await Promise.all([
    dns.resolve4(host).catch(() => []),
    dns.resolve6(host).catch(() => []),
  ]);

  const interfaces = Object.values(os.networkInterfaces()).flat().filter(Boolean);
  const anyIPv6 = interfaces.filter((i) => !i.internal && (i.family === 'IPv6' || i.family === 6));
  const globalIPv6 = anyIPv6.filter((i) => isGlobalIPv6(i.address));

  console.log(`\nAddress families for ${host}:`);
  console.log(`  A records:    ${v4.length}`);
  console.log(`  AAAA records: ${v6.length}`);
  console.log(`  this host's non-internal IPv6 addresses: ${anyIPv6.length} ` +
    `(${globalIPv6.length} globally routable)`);

  if (v6.length === 0) return true;

  if (globalIPv6.length === 0) {
    if (anyIPv6.length > 0) {
      console.log(
        '  → only link-local IPv6 here, so nodemailer WOULD resolve AAAA and could pick an\n' +
          '    unreachable address at random. config/plugins.ts pins SMTP to IPv4, which fixes it.\n' +
          '    (Set SMTP_FORCE_IPV4=false to opt out.)'
      );
    } else {
      console.log('  → no IPv6 interfaces; nodemailer will skip AAAA entirely.');
    }
    return true;
  }

  // A real global IPv6 address exists. Does it reach the relay?
  const result = await probe(v6[0], port, 6);
  if (result.ok) {
    console.log(`  → IPv6 reaches ${v6[0]}:${port} (${result.ms}ms). Both families usable.`);
    return true;
  }

  console.error(
    `\n✗ This host has a global IPv6 address but cannot reach ${v6[0]}:${port} (${result.reason}).\n` +
      '  Nodemailer picks between A and AAAA at random, so sends will fail intermittently.\n' +
      '  Set SMTP_FORCE_IPV4=true, or fix the IPv6 route.\n'
  );
  return false;
}

async function main() {
  console.log('\nSMTP configuration');
  console.log(`  SMTP_HOST      ${HOST || '(unset)'}`);
  console.log(`  SMTP_PORT      ${process.env.SMTP_PORT || '(unset — defaults to 587)'}`);
  console.log(`  SMTP_USERNAME  ${USER || '(unset)'}`);
  console.log(`  SMTP_PASSWORD  ${PASS ? `set, ${PASS.length} chars` : '(unset)'}`);
  console.log(`  EMAIL_FROM     ${FROM || '(unset)'}`);

  console.log(`  EMAIL_ENABLED  ${process.env.EMAIL_ENABLED ?? '(unset)'}`);
  console.log(`  NODE_ENV       ${process.env.NODE_ENV ?? '(unset)'}`);
  if (process.env.EMAIL_ENABLED !== 'true' && process.env.NODE_ENV !== 'production') {
    console.warn(
      '\n⚠ The running server would use a no-op transport with this environment.\n' +
        '  Set EMAIL_ENABLED=true where Strapi runs, or nothing is delivered regardless\n' +
        '  of what the rest of this check reports.'
    );
  }

  if (!HOST) {
    console.error('\n✗ SMTP_HOST is unset — the app falls back to a no-op transport and sends nothing.\n');
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

  const familiesOk = await checkAddressFamilies(HOST, PORT);

  if (!USER || !PASS) {
    console.error('\n✗ SMTP_USERNAME / SMTP_PASSWORD are not both set; cannot test authentication.\n');
    process.exit(1);
  }

  // Apply the same IPv4 pin config/plugins.ts applies, or this script authenticates
  // over a path Strapi will never take. (Twice now, a probe has "passed" because
  // Node's Happy Eyeballs fell back to IPv4 where nodemailer would not have.)
  const globalIPv6Count = Object.values(os.networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter((i) => !i.internal && (i.family === 'IPv6' || i.family === 6) && isGlobalIPv6(i.address))
    .length;

  const forced = process.env.SMTP_FORCE_IPV4;
  const pinToIPv4 = forced === undefined ? globalIPv6Count === 0 : forced === 'true';
  if (pinToIPv4) {
    const shared = require('nodemailer/lib/shared');
    const ipv4Only = {};
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      const kept = (addresses || []).filter((a) => a.family === 'IPv4' || a.family === 4);
      if (kept.length) ipv4Only[name] = kept;
    }
    shared.networkInterfaces = ipv4Only;
    console.log('\n  (pinning to IPv4, as config/plugins.ts does)');
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
    if (!familiesOk) {
      console.log('  \u26a0 But see the IPv6 warning above: sends will fail intermittently.');
      process.exitCode = 1;
    }
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
