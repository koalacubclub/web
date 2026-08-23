// Park-mode counterparts for the colours the rock species draw with.
//
// Same mechanism as ../trees/parkInk.ts and PARK_INK in ../sprites.ts: the tone
// sets in facet.ts are BRIGHT literals (what the shop previews and the catalog
// show), and in the park those draws are re-inked through here. There is no
// grading function — a colour is dark because it is written dark here, which is
// what lets stone stay stone: a computed grade turns any neutral grey lilac,
// and that is exactly what the park's old stone ellipse did.
//
// Granite sits in the same family as NIGHT.stone / NIGHT.stoneDark; sandstone is
// its warmer sibling, kept warm on purpose so the two read as different rock and
// not as two shades of the same one.
const PARK_INK: Record<string, string> = {
  // granite
  '#C9C9C9': '#A5A1A5', // the same mapping sprites.ts uses for this grey
  '#9E9E9E': '#838083', // NIGHT.stone
  '#757575': '#646264', // NIGHT.stoneDark
  // sandstone
  '#CFC0A6': '#A2907E',
  '#B0A088': '#897A6B',
  '#877962': '#6B6055',
  // moss on a stone's shoulder
  '#5E8F4E': '#517F60', // NIGHT.grassDark
}

/** Bright rock colour → its park-mode counterpart. Unknown colours pass through. */
export function parkInk(color: string): string {
  return PARK_INK[color] ?? color
}
