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
