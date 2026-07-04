import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Shop from './Shop'
import * as store from '@/game/parkStore'

beforeEach(() => {
  localStorage.clear()
  store.__resetForTests()
})

describe('Shop', () => {
  it('opens the shop dialog from the trigger', () => {
    store.earn(500)
    render(<Shop atTop={true} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open the shop/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('buys an item, decrementing the balance and confirming placement', async () => {
    store.earn(500)
    render(<Shop atTop={true} />)
    fireEvent.click(screen.getByRole('button', { name: /open the shop/i }))
    fireEvent.click(screen.getByRole('button', { name: /buy flower patch/i }))
    expect(store.getCoins()).toBe(480)
    expect(await screen.findByText(/placed/i)).toBeInTheDocument()
  })

  it('disables Buy when you cannot afford an item', () => {
    store.earn(10) // below the cheapest item (20)
    render(<Shop atTop={true} />)
    fireEvent.click(screen.getByRole('button', { name: /open the shop/i }))
    expect(
      screen.getByRole('button', { name: /buy flower patch/i }),
    ).toBeDisabled()
  })

  it('closes on the close button and on Escape', async () => {
    store.earn(500)
    render(<Shop atTop={true} />)

    fireEvent.click(screen.getByRole('button', { name: /open the shop/i }))
    fireEvent.click(screen.getByRole('button', { name: /close the shop/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /open the shop/i }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })
})
