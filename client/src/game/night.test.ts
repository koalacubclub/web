import { describe, expect, it } from 'vitest'
import { night } from './constants'

// night() bakes the old night wash (a `multiply` of rgba(120,80,180,0.5) over an
// opaque pixel) into a colour: per channel out = round((c·s/255 + c) / 2), i.e.
// round((s + 255) / 2) for a full (255) channel.
describe('night', () => {
  it('darkens white to the multiply-equivalent lavender', () => {
    // R: (120+255)/2=187.5→188, G: (80+255)/2=167.5→168, B: (180+255)/2=217.5→218
    expect(night('#FFFFFF')).toBe('rgb(188, 168, 218)')
  })

  it('keeps black black', () => {
    expect(night('#000000')).toBe('rgb(0, 0, 0)')
  })

  it('darkens each channel toward its wash factor', () => {
    // grass #A8D5A2 = (168,213,162): R round(168·375/510)=124, G round(213·335/510)=140, B round(162·435/510)=138
    expect(night('#A8D5A2')).toBe('rgb(124, 140, 138)')
  })

  it('treats 3-digit hex like its 6-digit form', () => {
    expect(night('#fff')).toBe(night('#ffffff'))
  })

  it('passes non-hex colours through unchanged (oklch sky, rgba shadows)', () => {
    expect(night('oklch(0.1 0.008 60)')).toBe('oklch(0.1 0.008 60)')
    expect(night('rgba(0,0,0,0.1)')).toBe('rgba(0,0,0,0.1)')
  })
})
