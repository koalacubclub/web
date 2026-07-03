import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './Home'

describe('Home', () => {
  it('renders the mini game in the header', () => {
    const { container } = render(<Home />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/koala's park/i),
    )
  })

  it('renders the feed section', () => {
    render(<Home />)
    expect(screen.getByText(/the feed/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /watch the chaos unfold/i }),
    ).toBeInTheDocument()
  })

  it('renders a reel poster per item linking out to Instagram', () => {
    const { container } = render(<Home />)
    const reelLinks = container.querySelectorAll(
      'a[href*="instagram.com/reel/"]',
    )
    expect(reelLinks).toHaveLength(12)

    const posters = container.querySelectorAll('img[src^="/reels/"]')
    expect(posters).toHaveLength(12)
    expect(posters[0]).toHaveAttribute('loading', 'lazy')

    // Cards open in a new tab with safe rel
    expect(reelLinks[0]).toHaveAttribute('target', '_blank')
    expect(reelLinks[0]).toHaveAttribute('rel', 'noopener noreferrer')
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
