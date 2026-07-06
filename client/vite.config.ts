/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { imagetools } from 'vite-imagetools'
import { IG_PROFILE, REELS, reelUrl, type Reel } from './src/data/reels.ts'
import { FOLLOWERS, followerUrl } from './src/data/followers.ts'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Inject a crawlable <noscript> mirror of the real content so robots / AI
// crawlers that don't run JavaScript (GPTBot, ClaudeBot, …) can read the full
// feed. Generated from the shared reel and follower data so it never drifts
// from the app.
function crawlableContent(): Plugin {
  return {
    name: 'inject-crawlable-noscript',
    transformIndexHtml(html) {
      const reelItems = REELS.map(
        (r: Reel) =>
          `        <li><a href="${reelUrl(r.code)}">${esc(r.caption)}</a></li>`,
      ).join('\n')
      const memberItems = FOLLOWERS.map(
        (username: string) =>
          `        <li><a href="${followerUrl(username)}">@${esc(username)}</a></li>`,
      ).join('\n')
      const noscript = `    <noscript>
      <h1>Koala Cub Club</h1>
      <p>
        A tabby with opinions and zero regard for personal space — a cinematic
        window into one cat's world. Watch Koala's adventures below, or follow
        along on Instagram and TikTok.
      </p>
      <h2>The feed — watch the chaos unfold</h2>
      <ul>
${reelItems}
      </ul>
      <p>More reels on <a href="${IG_PROFILE}">Instagram (@koalacubclub)</a>.</p>
      <h2>The club — meet the cubs</h2>
      <ul>
${memberItems}
      </ul>
      <h2>Follow Koala</h2>
      <ul>
        <li><a href="${IG_PROFILE}">Instagram — @koalacubclub</a></li>
        <li><a href="https://tiktok.com/@koalacubclub">TikTok — @koalacubclub</a></li>
        <li><a href="mailto:hello@koalacub.club">hello@koalacub.club</a></li>
        <li><a href="https://github.com/koalacubclub/web">Source code on GitHub</a></li>
      </ul>
    </noscript>`
      return html.replace('</body>', `${noscript}\n  </body>`)
    },
  }
}

// The Koala photo's single source of truth is src/assets/hero.webp (alongside
// the reel sources), so vite-imagetools can generate the small in-game variants
// from it (see src/data/heroPhoto.ts). But the social-share tags (og:image /
// twitter:image in index.html) and the in-game lightbox need it at a STABLE,
// unhashed public URL — /hero.webp. This plugin emits that copy verbatim from
// the same source at build and serves it in dev, so there's exactly ONE file to
// maintain (no hand-synced public/ duplicate).
function heroOgImage(): Plugin {
  const src = fileURLToPath(new URL('./src/assets/hero.webp', import.meta.url))
  return {
    name: 'emit-hero-og-image',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/hero.webp') {
          res.setHeader('Content-Type', 'image/webp')
          res.end(readFileSync(src))
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'hero.webp',
        source: readFileSync(src),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    imagetools(),
    crawlableContent(),
    heroOgImage(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@koala/shared': fileURLToPath(
        new URL('../shared/protocol.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
