// @testing-library/jest-dom's own Vitest augmentation (types/vitest.d.ts)
// still targets `declare module 'vitest'`, but Vitest 4 moved the
// `Assertion`/`AsymmetricMatchersContaining` interfaces into `@vitest/expect`
// and re-exports them from `vitest` as a type alias rather than an
// augmentable interface — so jest-dom's shipped augmentation (still true as
// of jest-dom 7.0.1) silently fails to merge, and none of its matchers
// type-check. Augment the real location ourselves until jest-dom catches up.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module '@vitest/expect' {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<
    any,
    any
  > {}
}
