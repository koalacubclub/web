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

  it('renders one lazy video embed per item', () => {
    const { container } = render(<Home />)
    const iframes = container.querySelectorAll('iframe')
    expect(iframes).toHaveLength(8)
    expect(iframes[0]).toHaveAttribute('loading', 'lazy')
    expect(iframes[0]).toHaveAttribute('allow', 'fullscreen')
    expect(iframes[0]).toHaveAttribute(
      'title',
      'TikTok video: Outdoor adventures',
    )
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
