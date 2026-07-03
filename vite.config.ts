/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { IG_PROFILE, REELS, reelUrl, type Reel } from './src/data/reels.ts'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Inject a crawlable <noscript> mirror of the real content so robots / AI
// crawlers that don't run JavaScript (GPTBot, ClaudeBot, …) can read the full
// feed. Generated from the shared reel data so it never drifts from the app.
function crawlableContent(): Plugin {
  return {
    name: 'inject-crawlable-noscript',
    transformIndexHtml(html) {
      const reelItems = REELS.map(
        (r: Reel) =>
          `        <li><a href="${reelUrl(r.code)}">${esc(r.caption)}</a></li>`,
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crawlableContent()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
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
