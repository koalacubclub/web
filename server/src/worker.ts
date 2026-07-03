import type { Env } from './types'
import {
  COOKIE,
  nameFor,
  newSessionId,
  parseCookie,
  signSession,
  verifySession,
} from './session'

// Re-export so the Durable Object migration in wrangler.jsonc can find the class.
export { GameWorld } from './GameWorld'

// One shared world for now. Multiple worlds later = more names here.
const ROOM = 'world-main'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin')

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      })
    }

    if (url.pathname === '/session' && req.method === 'POST') {
      return handleSession(req, env, origin)
    }

    if (url.pathname === '/world/main') {
      return handleWorld(req, env, origin)
    }

    if (url.pathname === '/health') {
      return new Response('ok', { headers: corsHeaders(origin, env) })
    }

    return new Response('not found', {
      status: 404,
      headers: corsHeaders(origin, env),
    })
  },
} satisfies ExportedHandler<Env>

/** POST /session — issue (or refresh) the anonymous session cookie. */
async function handleSession(
  req: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const existing = await verifySession(
    parseCookie(req.headers.get('Cookie'), COOKIE),
    env.SESSION_SECRET,
  )
  const id = existing ?? newSessionId()
  const token = await signSession(id, env.SESSION_SECRET)

  const headers = new Headers(corsHeaders(origin, env))
  headers.set('Content-Type', 'application/json')
  headers.append('Set-Cookie', sessionCookie(token, env))
  return new Response(JSON.stringify({ id, name: nameFor(id) }), { headers })
}

/** GET /world/main — authenticate, then hand the socket to the Durable Object. */
async function handleWorld(
  req: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  if (req.headers.get('Upgrade') !== 'websocket') {
    return new Response('expected websocket', { status: 426 })
  }
  // A browser can't be forced to send an Origin, but when it does we require it
  // to be on the allowlist so another site can't ride a visitor's cookie.
  if (origin !== null && !originAllowed(origin, env)) {
    return new Response('forbidden origin', { status: 403 })
  }
  const id = await verifySession(
    parseCookie(req.headers.get('Cookie'), COOKIE),
    env.SESSION_SECRET,
  )
  if (!id) return new Response('no session', { status: 401 })

  const stub = env.GAME_WORLD.get(env.GAME_WORLD.idFromName(ROOM))
  // Pass the *verified* id/name as internal params, overwriting anything the
  // client tried to smuggle in the URL.
  const forward = new URL(req.url)
  forward.searchParams.set('sid', id)
  forward.searchParams.set('name', nameFor(id))
  return stub.fetch(new Request(forward, req))
}

function sessionCookie(token: string, env: Env): string {
  const base = `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=31536000`
  return env.ENVIRONMENT === 'production'
    ? `${base}; Secure; SameSite=None`
    : `${base}; SameSite=Lax`
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function originAllowed(origin: string, env: Env): boolean {
  return allowedOrigins(env).includes(origin)
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  // Credentialed requests require echoing the specific origin (never "*").
  if (origin && originAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}
