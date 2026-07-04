import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Shop from './Shop'
import * as store from '@/game/parkStore'

beforeEach(() => {
  localStorage.clear()
  store.__resetForTests()
})

describe('Shop (controlled sheet)', () => {
  it('renders the sheet only when open', () => {
    const { rerender } = render(<Shop open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Shop open={true} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('buys an item, decrementing the balance and confirming placement', async () => {
    store.earn(500)
    render(<Shop open={true} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /buy flower patch/i }))
    expect(store.getCoins()).toBe(480)
    expect(await screen.findByText(/placed/i)).toBeInTheDocument()
  })

  it('disables Buy when you cannot afford an item', () => {
    store.earn(10) // below the cheapest item (20)
    render(<Shop open={true} onClose={() => {}} />)
    expect(
      screen.getByRole('button', { name: /buy flower patch/i }),
    ).toBeDisabled()
  })

  it('calls onClose from the close button and on Escape', async () => {
    const onClose = vi.fn()
    render(<Shop open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close the shop/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
  })
})
