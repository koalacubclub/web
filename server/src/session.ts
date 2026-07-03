// Anonymous session identity.
//
// The Worker mints a random session id on first visit, signs it with an HMAC
// secret, and stores `id.signature` in an HttpOnly cookie. The signature lets
// the server trust the id came from us on later requests without any database
// lookup — good enough for a cozy game's best-effort identity.

export const COOKIE = 'koala_sid'

const enc = new TextEncoder()

function b64url(bytes: ArrayBuffer): string {
  let s = ''
  const view = new Uint8Array(bytes)
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** Fresh, unguessable session id (128 bits, url-safe). */
export function newSessionId(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

/** Produce the cookie token `id.signature`. */
export async function signSession(id: string, secret: string): Promise<string> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(id))
  return `${id}.${b64url(sig)}`
}

/** Verify a cookie token and return its id, or null if the signature is bad. */
export async function verifySession(
  token: string | null,
  secret: string,
): Promise<string | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  const expected = await signSession(id, secret)
  // Constant-time compare over equal-length strings.
  if (expected.length !== token.length) return null
  let diff = 0
  for (let i = 0; i < token.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  }
  return diff === 0 ? id : null
}

/** Read a single cookie value out of a Cookie header. */
export function parseCookie(
  header: string | null,
  name: string,
): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return null
}

/** Stable, friendly display name derived from the session id. */
export function nameFor(id: string): string {
  return `Koala ${id.slice(0, 4).toUpperCase()}`
}
