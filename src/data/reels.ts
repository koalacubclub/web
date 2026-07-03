// Single source of truth for the Instagram reel feed. Consumed both by the
// React feed (src/pages/Home.tsx) and by the build-time crawlable <noscript>
// injector (vite.config.ts) so the two never drift. Posters live in
// /public/reels/<code>.jpg — see README ("Updating the reel feed").

export const IG_PROFILE = 'https://www.instagram.com/koalacubclub/'
export const reelUrl = (code: string) =>
  `https://www.instagram.com/reel/${code}/`
export const reelPoster = (code: string) => `/reels/${code}.jpg`

export interface Reel {
  code: string
  caption: string
}

export const REELS: Reel[] = [
  { code: 'DaGvXqFRQmV', caption: 'Brushing Koala’s teeth' },
  { code: 'DZ0zua6RSu7', caption: 'First time touching grass' },
  { code: 'DZisOcxxiGj', caption: 'Would your cat love this?' },
  { code: 'DZQqudUxfag', caption: 'TV time for Koala' },
  { code: 'DY-pGuuxxZi', caption: 'Opinions on her walk' },
  { code: 'DYsvinMRbTs', caption: 'Doorman approves' },
  { code: 'DYNuk02xQqY', caption: 'Outdoor training, day 3' },
  { code: 'DYVcXI-xFH8', caption: 'She can open every door' },
  { code: 'DXxZTGAxU8O', caption: 'Defeating a powerful monster' },
  { code: 'DXu0dxIh3nN', caption: 'My little baby' },
  { code: 'DXcy9xyhpqp', caption: 'First time outside' },
  { code: 'DW_2W9AjWoy', caption: 'Nail trim, no problem' },
]
