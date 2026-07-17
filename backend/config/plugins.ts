const os = require("os");

const YEAR = 365 * 24 * 60 * 60; // seconds — every lifespan below is in seconds

/** True if this host has an IPv6 address that could actually route off-link. */
const hasGlobalIPv6 = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .some(
      (i: any) =>
        i &&
        !i.internal &&
        (i.family === "IPv6" || i.family === 6) &&
        !i.address.startsWith("fe80") && // link-local
        !i.address.startsWith("fc") && // unique-local
        !i.address.startsWith("fd")
    );

/**
 * Stop nodemailer from trying IPv6 on a host that cannot route it.
 *
 * Nodemailer resolves A *and* AAAA itself, then picks one **at random**
 * (`shared/index.js`: `addresses[Math.floor(Math.random() * addresses.length)]`).
 * It decides whether to resolve AAAA by looking for any non-internal interface
 * with an IPv6 address — and a link-local `fe80::` counts. So a DigitalOcean
 * droplet with IPv6 switched off still advertises "IPv6 support", and roughly half
 * of all sends die with `ENETUNREACH`. Intermittently, which is worse than always.
 *
 * `isFamilySupported()` reads `module.exports.networkInterfaces` at call time, so
 * swapping in an IPv4-only view is enough. It must happen before the first DNS
 * lookup, which is why this lives in config rather than `bootstrap()`.
 *
 * Set SMTP_FORCE_IPV4=false to opt out if you really do have working IPv6.
 */
let ipv4PinApplied = false; // Strapi evaluates this config more than once per boot.

const restrictNodemailerToIPv4 = (env) => {
  if (ipv4PinApplied) return;

  const forced = env("SMTP_FORCE_IPV4");
  const shouldForce = forced === undefined ? !hasGlobalIPv6() : forced === "true";
  if (!shouldForce) return;

  try {
    const shared = require("nodemailer/lib/shared");
    const ipv4Only = {};
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      const kept = ((addresses as any[]) || []).filter(
        (a) => a.family === "IPv4" || a.family === 4
      );
      if (kept.length) ipv4Only[name] = kept;
    }
    shared.networkInterfaces = ipv4Only;
    ipv4PinApplied = true;
    // stderr, not stdout: scripts read this process's stdout (create-invite prints
    // a code, other tooling parses output). Config must never pollute it.
    console.warn("[email] No routable IPv6 on this host — pinning SMTP to IPv4.");
  } catch (error) {
    console.warn(`[email] Could not pin SMTP to IPv4: ${error.message}`);
  }
};

/**
 * Password-reset email delivery.
 *
 * Strapi ships only the `sendmail` provider, which sends straight from the host
 * and lands in spam. Configure real SMTP by setting SMTP_HOST; without it we
 * leave the default in place and `bootstrap()` warns, rather than booting into a
 * config that silently drops mail.
 *
 * ⚠ Outside production this requires an explicit opt-in, because `backend/.env`
 * holds the *production* SMTP credentials. Without the guard, any local Strapi —
 * `strapi develop`, a stale `strapi start`, a script that boots the app — will
 * cheerfully deliver real password-reset emails to whatever addresses the local
 * seed data happens to contain. That has already happened: two live emails went
 * out to `alice@seed.local` from a forgotten background process, and bounced.
 *
 * `scripts/test-email.js` opts in deliberately. Nothing else should.
 */
/** A transport that serialises the message and opens no socket. */
const mailSink = (env, reason: string) => {
  console.warn(`[email] ${reason} Using a no-op transport — nothing will be sent.`);
  return {
    email: {
      config: {
        provider: "nodemailer",
        providerOptions: { jsonTransport: true },
        settings: {
          defaultFrom: env("EMAIL_FROM", "dev@localhost"),
          defaultReplyTo: env("EMAIL_FROM", "dev@localhost"),
        },
      },
    },
  };
};

const emailConfig = ({ env }) => {
  const host = env("SMTP_HOST");

  // `strapi start` does NOT set NODE_ENV — Strapi reports "development" unless the
  // process manager exports it. Keying the guard on NODE_ENV alone would silently
  // disable production email on a droplet that simply never set it. So NODE_ENV is
  // only the *default*; EMAIL_ENABLED is the explicit answer, and prod should set it.
  const emailEnabled = env.bool("EMAIL_ENABLED", env("NODE_ENV") === "production");

  if (!emailEnabled) {
    // `backend/.env` holds the production SMTP credentials, and any local boot —
    // `strapi develop`, a forgotten `strapi start`, a script — picks them up. That
    // has already sent real password-reset emails to a seed address by accident.
    return mailSink(env, "EMAIL_ENABLED is not set and NODE_ENV is not production.");
  }

  if (!host) {
    // Deliberately NOT falling through to Strapi's default `sendmail` provider:
    // it calls `sendDirectSmtp` and delivers straight to the recipient's MX, so a
    // machine really can put mail on the wire without a relay.
    return mailSink(env, "EMAIL_ENABLED is set but SMTP_HOST is not.");
  }

  restrictNodemailerToIPv4(env);

  const port = env.int("SMTP_PORT", 587);

  // Implicit TLS from the first byte on these; everything else negotiates
  // STARTTLS. 2465 is Forward Email's alternate for when a host blocks 465 —
  // getting this wrong means the handshake stalls rather than failing cleanly.
  const IMPLICIT_TLS_PORTS = [465, 2465];

  return {
    email: {
      config: {
        provider: "nodemailer",
        // Passed straight to nodemailer.createTransport().
        providerOptions: {
          host,
          port,
          secure: IMPLICIT_TLS_PORTS.includes(port),
          auth: {
            user: env("SMTP_USERNAME"),
            pass: env("SMTP_PASSWORD"),
          },
          // Nodemailer defaults are 2 min to connect and 10 min on the socket.
          // A blocked outbound SMTP port (DigitalOcean blocks these by default)
          // drops the SYN, so the send hangs rather than failing — and the whole
          // request hangs with it. Fail fast and surface the error instead.
          connectionTimeout: env.int("SMTP_CONNECTION_TIMEOUT", 10_000),
          greetingTimeout: env.int("SMTP_GREETING_TIMEOUT", 10_000),
          socketTimeout: env.int("SMTP_SOCKET_TIMEOUT", 20_000),
        },
        settings: {
          defaultFrom: env("EMAIL_FROM"),
          defaultReplyTo: env("EMAIL_REPLY_TO", env("EMAIL_FROM")),
        },
      },
    },
  };
};

module.exports = ({ env }) => ({
  ...emailConfig({ env }),
  // Sessions, so "logged in until I log out" is literally true.
  //
  // A plain Strapi JWT is stateless and unrevocable: logging out only deletes the
  // cookie, while the token itself stays valid until it expires. Lengthening it
  // makes that worse. In `refresh` mode, `/auth/local` returns a short-lived
  // access token plus a refresh token backed by a row in `strapi_sessions`, so
  // `/auth/logout` genuinely revokes and `/auth/sessions` can list devices.
  //
  // The access token is deliberately short: `validateAccessToken` is a pure
  // `jwt.verify` with no database lookup, so revocation only takes effect once
  // the current access token expires.
  //
  // ⚠️ Switching this on invalidates every existing JWT — `jwt.verify` in refresh
  // mode accepts only SessionManager-minted access tokens. Everyone is logged out
  // once, at deploy.
  "users-permissions": {
    config: {
      jwtManagement: "refresh",
      sessions: {
        // Overridable so tests can force expiry without waiting 30 minutes.
        accessTokenLifespan: env.int("ACCESS_TOKEN_LIFESPAN", 30 * 60),
        maxRefreshTokenLifespan: YEAR,
        idleRefreshTokenLifespan: YEAR,
        maxSessionLifespan: YEAR,
        idleSessionLifespan: YEAR,
        // Leave false: Strapi would set its own cookie, but our Next.js BFF calls
        // Strapi server-to-server, so that cookie would never reach the browser.
        // We read `refreshToken` from the JSON body and set our own cookie.
        httpOnly: false,
      },
    },
  },
  upload: {
    config: {
      provider: "aws-s3",
      sizeLimit: 10 * 1024 * 1024 * 1024, // 256mb in bytes
      enabled: true,
      multipart: true,
      providerOptions: {
        baseUrl: env("CDN_URL"),
        rootPath: env("CDN_ROOT_PATH"),
        s3Options: {
          credentials: {
            accessKeyId: env("AWS_ACCESS_KEY_ID"),
            secretAccessKey: env("AWS_ACCESS_SECRET"),
          },
          region: env("AWS_REGION"),
          params: {
            ACL: env("AWS_ACL", "public-read"),
            signedUrlExpires: env("AWS_SIGNED_URL_EXPIRES", 15 * 60),
            Bucket: env("AWS_BUCKET"),
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
