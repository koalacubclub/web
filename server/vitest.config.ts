import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Runs the tests INSIDE workerd via Miniflare, so Durable Objects, hibernatable
// WebSockets and the Web Crypto API all behave exactly as in production.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // wrangler.jsonc has no SESSION_SECRET (it's a runtime secret); the
        // tests supply one here.
        bindings: { SESSION_SECRET: 'test-secret-do-not-use-in-prod' },
      },
    }),
  ],
})
