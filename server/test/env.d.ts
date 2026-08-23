// Teach `cloudflare:test`'s `env` about our Worker bindings (GAME_WORLD, etc.)
// by merging the Worker's Env into the ambient `Cloudflare.Env` namespace that
// `cloudflare:test`'s `env` export is typed against. Without this augmentation
// `env` is typed empty and `env.GAME_WORLD` doesn't resolve.
import type { Env as WorkerEnv } from '../src/types'

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}
