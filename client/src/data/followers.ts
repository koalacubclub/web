// Single source of truth for the club (the account's Instagram followers).
// Consumed both by the React club wall (src/pages/Home.tsx) and by the
// build-time crawlable <noscript> injector (vite.config.ts) so the two never
// drift. Avatars live in /public/followers/<username>.jpg — see README
// ("Updating the club").

export const followerUrl = (username: string) =>
  `https://www.instagram.com/${username}/`
export const followerAvatar = (username: string) => `/followers/${username}.jpg`

// How many members to show per page in the club wall.
export const MEMBERS_PER_PAGE = 20

// @koalacubclub's followers, newest first. A follower with no downloaded avatar
// (e.g. no profile picture) falls back to a monogram in the UI, so the list
// never shows broken images.
export const FOLLOWERS: string[] = [
  'stelmacha49',
  'odniddis',
  'nadini9104',
  'vaniuvanev',
  'mcsb65',
  'irubennnnnn',
  'nar.eshsori',
  'niteenbehera',
  'urban_jalalabad',
  'alec.ra',
  'bazingrid',
  'neveanderton',
  'evelyn__ye',
  'daily.dose.of.rhubarb',
  'lilyfan_art',
  'oscarlape',
  'bhavanasreekrishnan',
  'amyxxz',
  'qifan.peng',
  'miquelrovirapedrosa',
  'suman_majhi857194',
  'hey.meiying',
  'huhuiping7',
  'onoitsyoko',
  'lulu.lychee',
  'na_heroes',
  '3siberian',
  'alice.in.neverland',
  'soniaars',
  'yusifang',
  'bobo_googoo',
  'zeeeyap',
  'rovira.gerard',
]
