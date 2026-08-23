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

1. In a logged-in browser on [the reels tab](https://www.instagram.com/koalacubclub/reels/),
   dump every reel's shortcode and cover URL from the DevTools console (or the
   browser-automation tool's eval). IG's grid renders covers as a CSS
   `background-image` on a div, **not an `<img>` tag** — a selector expecting
   `a img` finds nothing:

   ```js
   JSON.stringify(
     [...document.querySelectorAll('a[href*="/koalacubclub/reel/"]')].map(
       (a) => {
         const m = a.getAttribute('href').match(/\/reel\/([^/]+)\//)
         const bgDiv = a.querySelector('div[style*=background-image]')
         const bgMatch = bgDiv?.style.backgroundImage.match(/url\("(.+?)"\)/)
         return { code: m && m[1], cover: bgMatch && bgMatch[1] }
       },
     ),
   )
   ```

   Compare the codes against the current `REELS` list to find what's new — stop
   once you reach a code you already have.

2. The grid has no caption text. For each **new** code, navigate to
   `instagram.com/koalacubclub/reel/<code>/` and read
   `document.querySelector('meta[property="og:description"]').content` — it's
   formatted as `"<N> likes, <N> comments - koalacubclub on <date>: \"<caption
text>\n\n#hashtags\""`. Use the date to confirm grid order, and write a short
   caption from the text (they truncate to one line in the UI — strip hashtags
   and shorten).
3. Save each full-res cover to `src/assets/reels/<shortcode>.jpg` (portrait
   9:16). Grab the largest available (~640–720px wide is plenty) — the build
   downscales/compresses, so **don't optimize by hand**. IG cover URLs are
   signed and expire, so download promptly.
4. Update `REELS` in `src/data/reels.ts`, newest first. The crawlable
   `<noscript>` regenerates from this on the next build — no other edits.
5. Check for TikTok mirrors while you're at it (see below), since it's cheap to
   do in the same pass.

### Cross-linking to TikTok

Optionally set `tiktok` (a video id) on a `REELS` entry when the same clip is
also posted on TikTok, so the card shows a "watch on TikTok" badge. IG stays
the primary feed and order — this is a same-content cross-link, not a second
feed. There's no shared id between platforms, so match by caption.

The easy way: navigate to `https://www.tiktok.com/@koalacubclub` (default sort
is "Latest") and read the page's accessibility snapshot (e.g. the
browser-automation tool's `/snapshot`) rather than the raw DOM — TikTok already
puts each video's full caption and `/video/<id>` URL in one link's accessible
name, so the whole list can be read and matched against `REELS` captions in one
pass with no need to open individual videos. Leave `tiktok` unset when no
mirror exists yet (TikTok lags IG, so recent reels usually won't have one).

## Refresh the club (followers)

Source of truth: `src/data/followers.ts` (`FOLLOWERS = [username]`,
`MEMBERS_PER_PAGE`). Avatars: `public/followers/<username>.jpg` (small, served
as-is — no imagetools pipeline needed).

1. In a logged-in browser on [the profile](https://www.instagram.com/koalacubclub/),
   click the "N followers" link to open the dialog — navigating straight to
   `.../followers/` as a URL just loads the plain profile page, it does **not**
   open the modal. Once open, find and scroll its inner scrollable element
   (the dialog itself doesn't scroll) until `scrollHeight` stops growing, so
   every row lazy-loads. Dump each follower's username and avatar URL from the
   dialog's `<a role="link" href="/…/">` rows — dedupe by href, since each row
   renders two matching anchors (avatar + username).
2. Download each avatar to `public/followers/<username>.jpg` (signed URLs expire —
   be prompt). A follower with no fetchable avatar can be **omitted**; the UI
   falls back to a monogram automatically.
3. Diff the dump against the current `FOLLOWERS` list and **prepend only the
   new handles** (newest-first, matching the dialog's order) — do not replace
   or remove entries for people who unfollowed. The club is a cumulative,
   append-only history of everyone who's ever followed, not a live mirror of
   current followers; leaving departed members in is intentional. Page size =
   `MEMBERS_PER_PAGE`. `<noscript>` regenerates on build.

## After any refresh

`pnpm build` (regenerates image variants + noscript), then the usual `pnpm test`
/ `pnpm test:e2e`. Two tests hardcode the reel count and need bumping when it
changes: `e2e/smoke.spec.ts` (`toHaveCount`) and `src/pages/Home.test.tsx`
(`toHaveLength`, twice).

> Note: the header/footer link to both Instagram and TikTok, but the feed is
> sourced from Instagram because TikTok currently lags on uploads.
