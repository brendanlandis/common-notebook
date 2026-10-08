export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // On headless, systemd holds the port open (the app's .socket unit) and hands it over as fd 3,
  // so a request that arrives while a deploy restarts Strapi waits for it instead of being refused.
  ...(env('LISTEN_FDS') ? { socket: { fd: 3 } } : {}),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
