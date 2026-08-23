import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

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
