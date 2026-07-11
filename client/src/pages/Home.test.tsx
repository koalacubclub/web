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
    expect(reelLinks).toHaveLength(14)

    const posters = container.querySelectorAll(
      'a[href*="instagram.com/reel/"] img',
    )
    expect(posters).toHaveLength(14)
    expect(posters[0]).toHaveAttribute('loading', 'lazy')

    // Cards open in a new tab with safe rel
    expect(reelLinks[0]).toHaveAttribute('target', '_blank')
    expect(reelLinks[0]).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the club section with a paginated followers wall', () => {
    const { container } = render(<Home />)

    expect(screen.getByText(/the club/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /meet the cubs/i }),
    ).toBeInTheDocument()

    // First page of members, each linking out to their profile on the platform
    // they follow from (Instagram or TikTok)
    const memberLinks = container.querySelectorAll(
      'a[aria-label$="on Instagram"], a[aria-label$="on TikTok"]',
    )
    expect(memberLinks.length).toBeGreaterThan(0)
    expect(memberLinks.length).toBeLessThanOrEqual(20)
    for (const link of memberLinks) {
      expect(link).toHaveAttribute(
        'href',
        expect.stringMatching(
          /^https:\/\/www\.(instagram\.com\/[^/]+\/|tiktok\.com\/@[^/]+)$/,
        ),
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }

    // The club spans both platforms — the TikTok member links out to TikTok
    expect(
      container.querySelector('a[aria-label$="on TikTok"]'),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/www\.tiktok\.com\/@[^/]+$/),
    )

    // Pagination is present as clickable dots (33 members across pages of 20)
    expect(
      screen.getByRole('button', { name: /go to page 1/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /go to page 2/i }),
    ).toBeInTheDocument()
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
