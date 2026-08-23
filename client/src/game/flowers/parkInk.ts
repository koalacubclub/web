// Park-mode counterparts for the colours the flower species draw with.
//
// Same mechanism as ../trees/parkInk.ts and PARK_INK in ../sprites.ts: each
// species declares its palette as BRIGHT literals (what the shop previews and
// the catalog show), and in the park those draws are re-inked through here.
// There is deliberately no grading function — a colour is dark because it is
// written dark here.
//
// Note what is NOT in this map: petals. The park draws blooms bright and
// un-graded on purpose, as vivid accents against the dark (see `drawFlowers` in
// ParkGame), so bloom colours fall through unchanged. Stems, leaves and foliage
// are the entries below.
const PARK_INK: Record<string, string> = {
  // daisy
  '#4E9150': '#436258',
  '#63B85E': '#517F60', // the same green as NIGHT.grassDark
  // tulip
  '#4A8C46': '#405E50',
  '#5EA855': '#4E735A',
  // poppy
  '#5B8F4A': '#4D6153',
  // lavender — foliage only; its florets are bloom colour and stay bright
  '#7E9B6E': '#676A70',
  '#88A578': '#6E7278',
  '#6E8F62': '#5B6167',
  // bluebell
  '#4C8B57': '#415E5F',
}

/** Bright species colour → its park-mode counterpart. Unknown colours pass through. */
export function parkInk(color: string): string {
  return PARK_INK[color] ?? color
}
