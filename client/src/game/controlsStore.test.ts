import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as controls from './controlsStore'

beforeEach(() => {
  localStorage.clear()
  controls.__resetForTests()
})

describe('controlsStore', () => {
  it('holds an analog move vector until released', () => {
    expect(controls.getMove()).toBeNull()
    controls.setMove(0.5, -1)
    expect(controls.getMove()).toEqual({ x: 0.5, y: -1 })
    controls.clearMove()
    expect(controls.getMove()).toBeNull()
  })

  it('routes fireAbility through the registered handler', () => {
    const fn = vi.fn()
    controls.registerAbility(fn)
    controls.fireAbility('dash')
    expect(fn).toHaveBeenCalledWith('dash')
    controls.registerAbility(null)
    controls.fireAbility('jump') // no handler → no throw
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('markFired stamps a recent time; unused abilities read -Infinity', () => {
    expect(controls.getFiredAt('bite')).toBe(-Infinity)
    controls.markFired('bite')
    expect(controls.getFiredAt('bite')).toBeGreaterThan(0)
  })
})
