// Worker environment bindings. Kept in one place so both the Worker entry and
// the Durable Object share the same typed view of config.

export interface Env {
  // The single shared world lives behind this Durable Object namespace.
  GAME_WORLD: DurableObjectNamespace

  // HMAC secret for signing session cookies. Provided via `.dev.vars` locally
  // and `wrangler secret put SESSION_SECRET` in production.
  SESSION_SECRET: string

  // "production" flips cookies to `Secure; SameSite=None` for the cross-site
  // (www.koalacub.club <-> game.koalacub.club) setup. Anything else is treated
  // as local development.
  ENVIRONMENT: string

  // Comma-separated origin allowlist for CORS + WebSocket Origin checks,
  // e.g. "https://www.koalacub.club" or "http://localhost:5173".
  ALLOWED_ORIGINS: string
}
