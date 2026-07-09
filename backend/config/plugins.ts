const YEAR = 365 * 24 * 60 * 60; // seconds — every lifespan below is in seconds

/**
 * Password-reset email delivery.
 *
 * Strapi ships only the `sendmail` provider, which sends straight from the host
 * and lands in spam. Configure real SMTP by setting SMTP_HOST; without it we
 * leave the default in place and `bootstrap()` warns, rather than booting into a
 * config that silently drops mail.
 */
const emailConfig = ({ env }) => {
  const host = env("SMTP_HOST");
  if (!host) return {};

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
  "strapi-v5-plugin-populate-deep": {
    config: {
      defaultDepth: 5, // Default is 5
    },
  },
});
