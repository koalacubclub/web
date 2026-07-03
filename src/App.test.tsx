import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the greeting heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /hello, koala cub club/i }),
    ).toBeInTheDocument()
  })

  it('increments the counter on click', async () => {
    const user = userEvent.setup()
    render(<App />)

    const button = screen.getByRole('button', { name: /clicked 0 times/i })
    await user.click(button)

    expect(
      screen.getByRole('button', { name: /clicked 1 time/i }),
    ).toBeInTheDocument()
  })
})
