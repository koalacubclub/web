# Content workflows — refreshing the feed & club

The reel feed and the followers ("club") wall are **point-in-time snapshots** of
local media that link out to Instagram (see [decisions.md](./decisions.md) #3).
Refreshing is a **deliberately semi-manual, agent-assisted process** — not an
automated script — because Instagram blocks headless / logged-out scraping, so it
needs a real, logged-in browser session driven interactively.

## Refresh the reel feed

Source of truth: `src/data/reels.ts` (`REELS = [{ code, caption }]`). Posters:
pristine JPEGs in `src/assets/reels/<code>.jpg`, optimized to responsive WebP at
build by vite-imagetools. Matched to reels by the `<code>` (shortcode) filename.

1. In a logged-in browser on [the profile](https://www.instagram.com/koalacubclub/),
   dump every reel's shortcode, cover URL, and caption from the DevTools console
   (or the browser-automation tool's eval):

   ```js
   JSON.stringify(
     [...document.querySelectorAll('a[href*="/reel/"]')]
       .map((a) => {
         const img = a.querySelector('img')
         return { href: a.getAttribute('href'), img: img?.src, alt: img?.alt }
       })
       .filter((x) => x.img),
   )
   ```

2. Save each full-res cover to `src/assets/reels/<shortcode>.jpg` (the shortcode is
   the `…/reel/<shortcode>/` segment; portrait 9:16). Grab the largest available
   (~640–720px wide is plenty) — the build downscales/compresses, so **don't
   optimize by hand**. IG cover URLs are signed and expire, so download promptly.
3. Update `REELS` in `src/data/reels.ts`, newest first. Keep captions short (they
   truncate to one line) and strip hashtags. The crawlable `<noscript>`
   regenerates from this on the next build — no other edits.

## Refresh the club (followers)

Source of truth: `src/data/followers.ts` (`FOLLOWERS = [username]`,
`MEMBERS_PER_PAGE`). Avatars: `public/followers/<username>.jpg` (small, served
as-is — no imagetools pipeline needed).

1. In a logged-in browser, open the followers dialog
   (`https://www.instagram.com/koalacubclub/followers/`) and scroll it to the
   bottom so every row lazy-loads. Dump each follower's username, avatar URL, and
   DOM order (top = newest) from the dialog's `<a href="/…/">` rows.
2. Download each avatar to `public/followers/<username>.jpg` (signed URLs expire —
   be prompt). A follower with no fetchable avatar can be **omitted**; the UI
   falls back to a monogram automatically.
3. Replace `FOLLOWERS` in `src/data/followers.ts` with the usernames in
   newest-first order. Page size = `MEMBERS_PER_PAGE`. `<noscript>` regenerates on
   build.

## After any refresh

`pnpm build` (regenerates image variants + noscript), then the usual `pnpm test`
/ `pnpm test:e2e`. The e2e smoke test asserts **12** reel links, so if the reel
count changes, update `e2e/smoke.spec.ts`.

> Note: the header/footer link to both Instagram and TikTok, but the feed is
> sourced from Instagram because TikTok currently lags on uploads.
