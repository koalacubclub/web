/// <reference types="vitest/config" />
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { imagetools } from 'vite-imagetools'
import { IG_PROFILE, REELS, reelUrl, type Reel } from './src/data/reels.ts'
import { FOLLOWERS, followerUrl, type Member } from './src/data/followers.ts'

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
        (member: Member) =>
          `        <li><a href="${followerUrl(member)}">@${esc(member.handle)}</a></li>`,
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

const MIME: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  json: 'application/json',
  txt: 'text/plain',
}

// Files in src/assets/rooted/ are served verbatim at the site root (/<name>) —
// in dev and in the build output. Use this (instead of public/) for assets that
// need a STABLE, unhashed URL — og:image, a canvas/lightbox referencing a fixed
// path — but must ALSO be importable by vite-imagetools (which only sees src/),
// so a single source feeds both. Drop a file in; there's nothing to hand-sync.
function rootedAssets(): Plugin {
  const dir = fileURLToPath(new URL('./src/assets/rooted', import.meta.url))
  const read = () => readdirSync(dir).map((name) => ({ name, dir }))
  return {
    name: 'rooted-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.replace(/^\//, '').split('?')[0] ?? ''
        const file = read().find((f) => f.name === name)
        if (!file) return next()
        const ext = name.slice(name.lastIndexOf('.') + 1)
        if (MIME[ext]) res.setHeader('Content-Type', MIME[ext])
        res.end(readFileSync(`${file.dir}/${file.name}`))
      })
    },
    generateBundle() {
      for (const { name, dir } of read()) {
        this.emitFile({
          type: 'asset',
          fileName: name,
          source: readFileSync(`${dir}/${name}`),
        })
      }
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
    rootedAssets(),
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
