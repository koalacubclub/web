// Single source of truth for the club (the accounts' social followers).
// Consumed both by the React club wall (src/pages/Home.tsx) and by the
// build-time crawlable <noscript> injector (vite.config.ts) so the two never
// drift. Avatars live in /public/followers/<handle>.jpg — see README
// ("Updating the club").

export type Platform = 'instagram' | 'tiktok'

export interface Member {
  handle: string
  platform: Platform
  // Day this member was added to the site (YYYY-MM-DD) — for easy tracking.
  addedOn: string
}

const profileUrl: Record<Platform, (handle: string) => string> = {
  instagram: (handle) => `https://www.instagram.com/${handle}/`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
}

export const platformLabel: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
}

export const followerUrl = (member: Member) =>
  profileUrl[member.platform](member.handle)
export const followerAvatar = (member: Member) =>
  `/followers/${member.handle}.jpg`

// How many members to show per page in the club wall.
export const MEMBERS_PER_PAGE = 20

// The club — everyone who follows Koala across Instagram and TikTok, kept in the
// order they were added to the site (newest first). A member with no downloaded
// avatar (e.g. no profile picture) falls back to a monogram in the UI, so the
// list never shows broken images.
export const FOLLOWERS: Member[] = [
  { handle: 'okcomputcrr', platform: 'tiktok', addedOn: '2026-07-11' },
  { handle: 'stelmacha49', platform: 'instagram', addedOn: '2026-07-05' },
  { handle: 'odniddis', platform: 'instagram', addedOn: '2026-07-05' },
  { handle: 'mom______nandini', platform: 'instagram', addedOn: '2026-07-11' },
  { handle: 'vaniuvanev', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'mcsb65', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'nar.eshsori', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'niteenbehera', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'urban_jalalabad', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'alec.ra', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'bazingrid', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'neveanderton', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'evelyn__ye', platform: 'instagram', addedOn: '2026-07-03' },
  {
    handle: 'daily.dose.of.rhubarb',
    platform: 'instagram',
    addedOn: '2026-07-03',
  },
  { handle: 'lilyfan_art', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'oscarlape', platform: 'instagram', addedOn: '2026-07-03' },
  {
    handle: 'bhavanasreekrishnan',
    platform: 'instagram',
    addedOn: '2026-07-03',
  },
  { handle: 'amyxxz', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'qifan.peng', platform: 'instagram', addedOn: '2026-07-03' },
  {
    handle: 'miquelrovirapedrosa',
    platform: 'instagram',
    addedOn: '2026-07-03',
  },
  { handle: 'suman_majhi857194', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'hey.meiying', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'huhuiping7', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'onoitsyoko', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'lulu.lychee', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'na_heroes', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: '3siberian', platform: 'instagram', addedOn: '2026-07-03' },
  {
    handle: 'alice.in.neverland',
    platform: 'instagram',
    addedOn: '2026-07-03',
  },
  { handle: 'soniaars', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'yusifang', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'bobo_googoo', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'zeeeyap', platform: 'instagram', addedOn: '2026-07-03' },
  { handle: 'rovira.gerard', platform: 'instagram', addedOn: '2026-07-03' },
]
