import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { REELS } from '@/data/reels'
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

  it('renders a reel poster per item linking out to Instagram or TikTok', () => {
    const { container } = render(<Home />)

    const dualPlatformCount = REELS.filter((reel) => reel.tiktok).length
    const singlePlatformCount = REELS.length - dualPlatformCount

    // Every reel renders a card — either a direct Instagram link
    // (single-platform reels) or a role="button" platform picker trigger
    // (reels that also exist on TikTok).
    const reelCards = container.querySelectorAll(
      'a[href*="instagram.com/reel/"], [aria-label$="choose Instagram or TikTok"]',
    )
    expect(reelCards).toHaveLength(REELS.length)

    const posters = container.querySelectorAll(
      'a[href*="instagram.com/reel/"] img, [aria-label$="choose Instagram or TikTok"] img',
    )
    expect(posters).toHaveLength(REELS.length)
    expect(posters[0]).toHaveAttribute('loading', 'lazy')

    // Single-platform cards still navigate straight to Instagram, opening in
    // a new tab with safe rel
    const directLinks = container.querySelectorAll(
      'a[href*="instagram.com/reel/"]',
    )
    expect(directLinks).toHaveLength(singlePlatformCount)
    expect(directLinks[0]).toHaveAttribute('target', '_blank')
    expect(directLinks[0]).toHaveAttribute('rel', 'noopener noreferrer')

    // Dual-platform cards render as a picker trigger, not a direct link
    const dualCards = container.querySelectorAll(
      '[aria-label$="choose Instagram or TikTok"]',
    )
    expect(dualCards).toHaveLength(dualPlatformCount)
  })

  it('opens an in-card platform picker for reels that also exist on TikTok', async () => {
    const { container } = render(<Home />)
    const dualCards = container.querySelectorAll(
      '[aria-label$="choose Instagram or TikTok"]',
    )
    expect(dualCards.length).toBeGreaterThan(0)

    const card = dualCards[0] as HTMLElement
    expect(card).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')

    const dialog = screen.getByRole('dialog', { name: /choose platform/i })
    expect(
      within(dialog).getByRole('button', { name: /instagram/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /tiktok/i }),
    ).toBeInTheDocument()

    // Escape dismisses the picker (exit animation resolves asynchronously)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /choose platform/i }),
      ).not.toBeInTheDocument()
    })
    expect(card).toHaveAttribute('aria-expanded', 'false')
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
