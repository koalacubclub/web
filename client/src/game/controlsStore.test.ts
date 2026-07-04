import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as controls from './controlsStore'

beforeEach(() => {
  localStorage.clear()
  controls.__resetForTests()
})

describe('controlsStore', () => {
  it('persists gamer mode and notifies subscribers', () => {
    const cb = vi.fn()
    const unsub = controls.subscribe(cb)
    expect(controls.getGamerMode()).toBe(false)

    controls.setGamerMode(true)
    expect(controls.getGamerMode()).toBe(true)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('kcc-gamer-mode')).toBe('1')

    controls.setGamerMode(true) // no-op when unchanged → no extra notify
    expect(cb).toHaveBeenCalledTimes(1)

    unsub()
    controls.setGamerMode(false)
    expect(cb).toHaveBeenCalledTimes(1) // unsubscribed
  })

  it('holds an analog move vector until released', () => {
    expect(controls.getMove()).toBeNull()
    controls.setMove(0.5, -1)
    expect(controls.getMove()).toEqual({ x: 0.5, y: -1 })
    controls.clearMove()
    expect(controls.getMove()).toBeNull()
  })

  it('leaving gamer mode releases the stick', () => {
    controls.setGamerMode(true)
    controls.setMove(1, 0)
    controls.setGamerMode(false)
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
