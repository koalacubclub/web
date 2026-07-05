import { beforeEach, describe, expect, it } from 'vitest'
import {
  ABILITIES,
  ABILITY_COOLDOWNS_MS,
  isOnGlobalCooldown,
} from '@koala/shared'
import * as controls from './controlsStore'

// The WoW-style global cooldown: firing any GCD ability briefly blocks the OTHER
// GCD abilities so you can't fire two at once — but movement is never gated, so
// you can run and cast. Jump and meow are deliberately OFF the GCD (jump = core
// traversal you can always do; meow = a cosmetic tap-the-Koala emote, not a
// skill). See shared/protocol.ts + controlsStore.ts.
describe('global cooldown contract (shared)', () => {
  it('gates the aimed abilities but leaves jump + meow off the GCD', () => {
    expect(isOnGlobalCooldown('dash')).toBe(true)
    expect(isOnGlobalCooldown('bite')).toBe(true)
    expect(isOnGlobalCooldown('hand')).toBe(true)
    expect(isOnGlobalCooldown('jump')).toBe(false)
    expect(isOnGlobalCooldown('meow')).toBe(false)
  })

  it('gives meow no cooldown (cosmetic) and every real ability a positive one', () => {
    expect(ABILITY_COOLDOWNS_MS.meow).toBe(0)
    for (const a of ABILITIES) {
      if (a === 'meow') continue
      expect(ABILITY_COOLDOWNS_MS[a]).toBeGreaterThan(0)
    }
  })
})

describe('controlsStore global-cooldown clock (game → UI sweep)', () => {
  beforeEach(() => controls.__resetForTests())

  it('starts with no GCD and remembers the latest until-stamp', () => {
    expect(controls.getGcdUntil()).toBe(-Infinity)
    controls.markGcd(1234)
    expect(controls.getGcdUntil()).toBe(1234)
  })

  it('__resetForTests clears the GCD stamp', () => {
    controls.markGcd(5000)
    controls.__resetForTests()
    expect(controls.getGcdUntil()).toBe(-Infinity)
  })
})
