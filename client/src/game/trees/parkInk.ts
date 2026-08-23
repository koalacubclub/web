// Park-mode counterparts for the colours the tree species draw with.
//
// Each species file declares its palette as BRIGHT literals (that's what the shop
// previews and the catalog page show); in the park those same draws are re-inked
// through here. There is deliberately no grading function: colours used to be
// derived by running each literal through a night() filter, which meant every
// surface inherited whatever hue that filter leaned toward and no single colour
// could be retuned on its own. Each entry below is hand-picked instead — a colour
// is dark because it is written dark here.
//
// Every key must be a colour some species palette passes to ink(). `parkInk` falls
// through unchanged for anything missing, so an unlisted colour renders BRIGHT in
// the park — which is almost always a bug rather than an intention.
//
// This is the same mechanism as PARK_INK in ../sprites.ts, kept separate because
// the two cover disjoint sets of art. If a third one ever appears, hoist them.
const PARK_INK: Record<string, string> = {
  // broadleaf
  '#8B6914': '#764428',
  '#2E7D3F': '#2C534E',
  '#3D9C4E': '#366A57', // shared with the in-world tree canopy in ParkGame
  '#66BB6A': '#53816A',
  // crabapple
  '#6E5424': '#5F3538',
  '#5C4520': '#522A38',
  '#5C9A4C': '#4D6954',
  '#7CBE63': '#658364',
  '#F3BAD0': '#C082C2',
  '#FCEDF2': '#C7A6E1',
  '#CC3B35': '#A5273C',
  // maple
  '#6B4E18': '#5E302F',
  '#96331F': '#7D1F2F',
  '#BE4726': '#9B2E30',
  '#E0692C': '#B44732',
  '#EFA83A': '#BF743D',
  // pine (trunk shared with willow)
  '#7A5A12': '#693928',
  '#2F7C43': '#2C5252',
  '#46A15A': '#3C6E60',
  // willow
  '#548F4E': '#486156',
  '#6FAB5C': '#5B755F',
  '#97C877': '#798B74',
}

/** Bright species colour → its park-mode counterpart. Unknown colours pass through. */
export function parkInk(color: string): string {
  return PARK_INK[color] ?? color
}
