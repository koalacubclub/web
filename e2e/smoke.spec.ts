import { expect, test } from '@playwright/test'

// Smoke test: verifies the app shell, the reel feed, and outbound links render.
test('landing page renders hero, reel feed and social links', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/koala cub club/i)

  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toContainText(/she sees/i)

  await expect(page.getByText(/a tabby with opinions/i).first()).toBeVisible()

  // Reel feed: poster cards that link out to Instagram reels
  const reelLinks = page.locator('a[href*="instagram.com/reel/"]')
  await expect(reelLinks).toHaveCount(12)
  await expect(reelLinks.first()).toHaveAttribute('target', '_blank')

  await expect(
    page.getByRole('link', { name: /instagram/i }).first(),
  ).toHaveAttribute('href', 'https://www.instagram.com/koalacubclub/')

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
