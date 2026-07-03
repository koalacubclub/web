import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './Home'

describe('Home', () => {
  it('renders the hero headline', () => {
    render(<Home />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/she sees/i)
    expect(heading).toHaveTextContent(/you\./i)
  })

  it('renders the feed section', () => {
    render(<Home />)
    expect(screen.getByText(/the feed/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /watch the chaos unfold/i }),
    ).toBeInTheDocument()
  })

  it('renders one video embed per item', () => {
    const { container } = render(<Home />)
    expect(container.querySelectorAll('iframe')).toHaveLength(8)
  })

  it('links out to the social accounts', () => {
    render(<Home />)
    expect(
      screen.getAllByRole('link', { name: /instagram/i }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: /hello@koalacub\.club/i }),
    ).toHaveAttribute('href', 'mailto:hello@koalacub.club')
  })
})
