// Single source of truth for the Instagram reel feed. Consumed both by the
// React feed (src/pages/Home.tsx) and by the build-time crawlable <noscript>
// injector (vite.config.ts) so the two never drift. Pristine poster sources
// live in src/assets/reels/<code>.jpg and are turned into responsive WebP at
// build by vite-imagetools (see src/data/reelPosters.ts) — see README.

export const IG_PROFILE = 'https://www.instagram.com/koalacubclub/'
export const reelUrl = (code: string) =>
  `https://www.instagram.com/reel/${code}/`
export const tiktokReelUrl = (id: string) =>
  `https://www.tiktok.com/@koalacubclub/video/${id}`

export interface Reel {
  code: string
  caption: string
  // TikTok video id for the same clip, when a mirror exists (TikTok lags IG
  // uploads, so most entries won't have one). There's no shared id between
  // platforms — match by caption/thumbnail during refresh, see
  // docs/content-workflows.md.
  tiktok?: string
}

export const REELS: Reel[] = [
  { code: 'DcW76bThzoT', caption: 'There was an attempt to walk Koala' },
  { code: 'DbO1l4bB8Mm', caption: 'Vaccine and flea prevention day' },
  { code: 'Da80D7RhEi8', caption: 'Happy birthday, Koala!' },
  { code: 'DaqALgvR25X', caption: 'Koala’s home school, ep. 1' },
  { code: 'DaYw6x9RuMz', caption: 'Second day touching grass' },
  { code: 'DaGvXqFRQmV', caption: 'Brushing Koala’s teeth' },
  { code: 'DZ0zua6RSu7', caption: 'First time touching grass' },
  { code: 'DZisOcxxiGj', caption: 'Would your cat love this?' },
  { code: 'DZQqudUxfag', caption: 'TV time for Koala' },
  { code: 'DY-pGuuxxZi', caption: 'Opinions on her walk' },
  { code: 'DYsvinMRbTs', caption: 'Doorman approves' },
  {
    code: 'DYNuk02xQqY',
    caption: 'Outdoor training, day 3',
    tiktok: '7674657309817097486',
  },
  {
    code: 'DYVcXI-xFH8',
    caption: 'She can open every door',
    tiktok: '7674656022425799949',
  },
  {
    code: 'DXxZTGAxU8O',
    caption: 'Defeating a powerful monster',
    tiktok: '7656466335295130893',
  },
  {
    code: 'DXu0dxIh3nN',
    caption: 'My little baby',
    tiktok: '7656465839968750861',
  },
  {
    code: 'DXcy9xyhpqp',
    caption: 'First time outside',
    tiktok: '7656464826855623950',
  },
  {
    code: 'DW_2W9AjWoy',
    caption: 'Nail trim, no problem',
    tiktok: '7656245559979740429',
  },
  {
    code: 'DWbvJ8kkQGk',
    caption: 'Annual shower time',
    tiktok: '7656245133796478222',
  },
  {
    code: 'DWJjax_jSI4',
    caption: 'Making a biscuit',
    tiktok: '7656243398596234510',
  },
  {
    code: 'DV2DjSdjc1K',
    caption: 'Laser flashlight time',
    tiktok: '7656242523505020173',
  },
  {
    code: 'DVW4r3hFYVu',
    caption: 'Hallway walk practice',
    tiktok: '7656241170187635981',
  },
]
