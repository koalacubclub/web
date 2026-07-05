import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BottomBar from './BottomBar'
import * as store from '@/game/parkStore'

beforeEach(() => {
  localStorage.clear()
  store.__resetForTests()
})

describe('BottomBar', () => {
  it('shows the current score/likes (not the best) from the store', () => {
    store.earn(500)
    render(<BottomBar atTop={true} />)
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.queryByText(/best/i)).not.toBeInTheDocument()
  })

  it('opens the shop from its trigger', () => {
    store.earn(500)
    render(<BottomBar atTop={true} />)
    expect(
      screen.queryByRole('dialog', { name: /shop/i }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open the shop/i }))
    expect(screen.getByRole('dialog', { name: /shop/i })).toBeInTheDocument()
  })

  it('renames via the settings popover', () => {
    const rename = vi.spyOn(store, 'rename')
    render(<BottomBar atTop={true} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    const input = screen.getByLabelText(/display name/i)
    fireEvent.change(input, { target: { value: '  Pixel  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(rename).toHaveBeenCalledWith('Pixel')
  })

  it('toggles the radio mute from the settings popover (persisted)', () => {
    render(<BottomBar atTop={true} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    // Starts unmuted.
    const muteBtn = screen.getByRole('button', { name: /mute radio/i })
    expect(muteBtn).toHaveAttribute('aria-pressed', 'false')
    // Click → muted, and the preference is persisted.
    fireEvent.click(muteBtn)
    expect(
      screen.getByRole('button', { name: /unmute radio/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('kcc-muted')).toBe('1')
  })

  it('toggles the 30fps performance cap from the settings popover (persisted)', () => {
    render(<BottomBar atTop={true} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    // Defaults to full frame rate (opt-in cap).
    const perfBtn = screen.getByRole('button', {
      name: /cap the game to 30 fps/i,
    })
    expect(perfBtn).toHaveAttribute('aria-pressed', 'false')
    expect(perfBtn).toHaveTextContent('60 fps')
    // Click → 30fps cap on, and the preference is persisted.
    fireEvent.click(perfBtn)
    const onBtn = screen.getByRole('button', { name: /full frame rate/i })
    expect(onBtn).toHaveAttribute('aria-pressed', 'true')
    expect(onBtn).toHaveTextContent('30 fps')
    expect(localStorage.getItem('koala:reduced-fps')).toBe('1')
  })

  it('lists online players and world stats in the settings menu', () => {
    store.applyServerPresence([
      { id: 'a', name: 'Alice', self: true },
      { id: 'b', name: 'Bob', self: false },
    ])
    store.applyServerStats({ active24h: 12, totalSessions: 345, yourVisits: 7 })
    render(<BottomBar atTop={true} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    // Roster (self is tagged "you").
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('you')).toBeInTheDocument()

    // Durable stats.
    expect(screen.getByText('Active (24h)')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('345')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})
