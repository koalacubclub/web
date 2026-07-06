// Teach `cloudflare:test`'s `env` about our Worker bindings (GAME_WORLD, etc.)
// by merging the Worker's Env into ProvidedEnv. Without this augmentation `env`
// is typed empty and `env.GAME_WORLD` doesn't resolve.
import type { Env } from '../src/types'

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
