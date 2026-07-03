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
  await expect(reelLinks).toHaveCount(12)
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
  const memberLinks = page.locator('a[aria-label$="on Instagram"]')
  await expect(memberLinks.first()).toBeVisible()
  await expect(memberLinks.first()).toHaveAttribute('target', '_blank')
  await expect(
    page.getByRole('button', { name: /more members/i }),
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
