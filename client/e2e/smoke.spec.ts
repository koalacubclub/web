import { expect, test } from '@playwright/test'

// Smoke test: verifies the app shell, the reel feed, and outbound links render.
test('landing page renders hero, reel feed and social links', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/koala cub club/i)

  // Hero: the Koala's Park mini game canvas
  await expect(page.locator('canvas[aria-label*="mini game"]')).toBeVisible()

  // Reel feed: poster cards that link out to Instagram reels
  const reelLinks = page.locator('a[href*="instagram.com/reel/"]')
  await expect(reelLinks).toHaveCount(17)
  await expect(reelLinks.first()).toHaveAttribute('target', '_blank')

  // The profile link, named exactly "Instagram" — reel cards are also named
  // "Watch on Instagram: …", so a loose /instagram/i match resolves to a reel.
  await expect(
    page.getByRole('link', { name: 'Instagram', exact: true }).first(),
  ).toHaveAttribute('href', 'https://www.instagram.com/koalacubclub/')

  // The club: paginated followers wall with member avatars linking to profiles
  await expect(
    page.getByRole('heading', { name: /meet the cubs/i }),
  ).toBeVisible()
  const memberLinks = page.locator(
    'a[aria-label$="on Instagram"], a[aria-label$="on TikTok"]',
  )
  await expect(memberLinks.first()).toBeVisible()
  await expect(memberLinks.first()).toHaveAttribute('target', '_blank')
  await expect(
    page.getByRole('button', { name: /go to page 2/i }),
  ).toBeVisible()

  await expect(
    page.getByRole('link', { name: /tiktok/i }).first(),
  ).toHaveAttribute('href', 'https://tiktok.com/@koalacubclub')

  await expect(page.getByRole('link', { name: /source/i })).toHaveAttribute(
    'href',
    'https://github.com/koalacubclub/web',
  )

  await expect(
    page.getByRole('link', { name: /hello@koalacub\.club/i }),
  ).toHaveAttribute('href', 'mailto:hello@koalacub.club')
})

test('hero scroll cue smooth-scrolls to the content', async ({ page }) => {
  await page.goto('/')

  // The feed section sits below the full-height hero — off-screen initially.
  const feed = page.getByRole('heading', { name: /watch the chaos unfold/i })
  await expect(feed).not.toBeInViewport()

  // Clicking the hero's "more below" cue smooth-scrolls it into view.
  await page.getByRole('button', { name: /scroll to see more/i }).click()
  await expect(feed).toBeInViewport()
})

// Every shop preview must contain its own art. The previews used to be sized by
// three fixed pads, and the tree art outgrew them: all five species had their
// crowns clipped flat against the top of the canvas. The box is measured from
// the art now, and this is the guard — art can grow freely, but if it ever
// grows past its box again, the ink lands on an edge and this fails.
//
// It lives in e2e because it needs a real canvas: jsdom has no 2D context, so
// the component's measuring pass (and this check) can't run in a unit test.
test('shop previews are not clipped by their canvas', async ({ page }) => {
  await page.goto('/')
  await page.locator('button[aria-label*="open the shop"]').first().click()

  const previews = page.locator('canvas[role="img"]')
  await expect(previews.first()).toBeVisible()
  expect(await previews.count()).toBeGreaterThan(10)

  const clipped = await page.evaluate(() =>
    (
      Array.from(
        document.querySelectorAll('canvas[role=img]'),
      ) as HTMLCanvasElement[]
    )
      .map((c) => {
        const ctx = c.getContext('2d')
        if (!ctx) return null
        const { data } = ctx.getImageData(0, 0, c.width, c.height)
        // Alpha 8, matching the component's own threshold: shadows fade out to
        // nothing, and their last near-invisible pixel is not the art's edge.
        const lit = (x: number, y: number) =>
          data[(y * c.width + x) * 4 + 3] > 8
        const edges: string[] = []
        for (let x = 0; x < c.width; x++) {
          if (lit(x, 0)) edges.push('top')
          if (lit(x, c.height - 1)) edges.push('bottom')
          if (edges.length) break
        }
        for (let y = 0; y < c.height; y++) {
          if (lit(0, y)) edges.push('left')
          if (lit(c.width - 1, y)) edges.push('right')
          if (edges.length) break
        }
        return edges.length
          ? `${c.getAttribute('aria-label')}: ${[...new Set(edges)].join(', ')}`
          : null
      })
      .filter(Boolean),
  )

  expect(clipped, 'shop art touching a canvas edge').toEqual([])
})
