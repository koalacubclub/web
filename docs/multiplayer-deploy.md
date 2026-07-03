# Multiplayer deploy runbook

The multiplayer backend is a **Cloudflare Worker + Durable Object** in `server/`.
The frontend stays on **Vercel** (`client/`). They share the wire protocol in
`shared/`. This is a `pnpm` workspace: `client` + `server` + `shared`.

Everything below is verified locally (9 Durable Object tests in real `workerd`,
client tests, a 3-player headless relay smoke, and a 2-player browser check).
The steps that remain are account-bound (Cloudflare login, DNS, Vercel settings).

## What each piece does

- `client/` — the Vite site. Connects to the game backend via
  `VITE_GAME_HTTP_URL` / `VITE_GAME_WS_URL`. If those aren't set in a production
  build, multiplayer is disabled and the game runs solo (no errors).
- `server/` — `worker.ts` issues a signed session cookie (`POST /session`) and
  upgrades `/world/main` to a WebSocket after checking Origin + session.
  `GameWorld` (Durable Object) relays presence + movement for one shared world.
- `shared/protocol.ts` — message types + world bounds, imported by both sides.

## 1. Cloudflare backend

```bash
# from repo root
pnpm exec wrangler login                                  # interactive (opens browser)

# set the cookie-signing secret for production
cd server
pnpm exec wrangler secret put SESSION_SECRET --env production   # paste a long random string

# deploy
pnpm exec wrangler deploy --env production
```

### DNS prerequisite for `game.koalacub.club`

`server/wrangler.jsonc` binds the production Worker to the custom domain
`game.koalacub.club`. **A custom domain requires the `koalacub.club` zone to be
on Cloudflare.** Two options:

- **If the zone is on Cloudflare:** the `custom_domain` route provisions the
  subdomain + TLS automatically on deploy. Nothing else to do.
- **If DNS is elsewhere (e.g. Vercel):** either move the `koalacub.club` zone to
  Cloudflare, **or** for a quick live test, remove the `routes` block from the
  `production` env in `wrangler.jsonc`, deploy, and use the printed
  `*.workers.dev` URL as the backend (set the Vercel env vars to that URL and
  add it to `ALLOWED_ORIGINS`... note CORS uses the _frontend_ origin, which
  stays `https://www.koalacub.club`, so only the client env URLs change).

## 2. Vercel frontend

Because the app moved into `client/`:

1. **Project Settings → General → Root Directory → `client`.** Do this _before_
   `feat/multiplayer` reaches the production branch, or the build breaks (there's
   no app at the repo root anymore). The `installCommand` in `client/vercel.json`
   already filters to only the client + shared packages (never the server).
2. **Project Settings → Environment Variables** (Production):
   - `VITE_GAME_HTTP_URL = https://game.koalacub.club`
   - `VITE_GAME_WS_URL = wss://game.koalacub.club`
     (Use the `workers.dev` URL instead if you took that option above.)
3. Merge `feat/multiplayer` → `main` (or push it) to trigger the deploy.

## 3. Verify live

- Open `https://www.koalacub.club` in two different browsers (or a normal +
  incognito window — they must have separate cookies to be separate players).
- Each should show the presence badge (`● 2 in the park`) and the other player's
  koala with a name tag, moving in real time.

## Cost & safety notes (from the architecture research)

- No game tick: the Durable Object hibernates when the park is idle, so it isn't
  billed for sitting empty. Do **not** add an `alarm`-driven loop.
- Positions are broadcast on receive (event-driven), never written to storage
  per frame. Only last-known position rides in the socket attachment.
- Inbound is rate-limited per session (best-effort anti-cheat). Anonymous
  sessions are mintable, so treat this as a soft guard, not a security boundary.
- Add a Cloudflare usage alert; there's no universal hard spend cap.
