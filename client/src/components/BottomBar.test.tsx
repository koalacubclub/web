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
})
