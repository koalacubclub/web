import type {} from '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'

// Register jest-dom's matchers directly against *this file's own* `expect`
// import instead of relying on `@testing-library/jest-dom/vitest`'s internal
// `expect.extend()` call, which resolves `vitest` (and therefore `chai`) from
// *inside* jest-dom's own package directory rather than from here. Under
// pnpm's symlinked node_modules layout that internal resolution can land on a
// physically different `vitest`/`chai` install than the one test files use —
// this repo's server workspace legitimately depends on a second, older
// `vitest` (via @cloudflare/vitest-pool-workers), so a second copy already
// exists in the pnpm store, and platform-specific hoisting differences (e.g.
// Linux CI vs macOS) can change which one jest-dom's bundled import reaches.
// That mismatch is what produces "Invalid Chai property: toBeInTheDocument"
// at runtime. Extending the `expect` imported right here guarantees it's the
// exact same instance every test file asserts against, regardless of how
// jest-dom's own internal import resolves. The bare `import type {}` above
// keeps jest-dom's `declare module 'vitest' { interface Assertion ... }`
// type augmentation (so `.toBeInTheDocument()` etc. still type-check) without
// executing that module's runtime registration code.
expect.extend(matchers)

// Node ships its own experimental global `localStorage`/`sessionStorage`
// (undefined without --localstorage-file, warns on access). Vitest's jsdom
// environment only overrides globals it already knows about, so it leaves
// Node's non-functional one in place instead of jsdom's real, working
// Storage. Point the globals at jsdom's actual instance, reachable via the
// `jsdom` global vitest itself sets during environment setup.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } })
  .jsdom.window
vi.stubGlobal('localStorage', jsdomWindow.localStorage)
vi.stubGlobal('sessionStorage', jsdomWindow.sessionStorage)

// framer-motion's useInView relies on IntersectionObserver, which jsdom lacks.
// The stub reports every observed element as in-view so the reveal/animate
// branches are actually exercised in tests.
class IntersectionObserverStub {
  private callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(el: Element) {
    this.callback(
      [
        {
          isIntersecting: true,
          intersectionRatio: 1,
          target: el,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

// framer-motion queries prefers-reduced-motion via matchMedia.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

afterEach(() => {
  cleanup()
})
