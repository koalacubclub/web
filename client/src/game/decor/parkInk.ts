// Park-mode counterparts for the colours the decor draws with.
//
// Same mechanism as ../trees/parkInk.ts, ../rocks/parkInk.ts and
// ../props/parkInk.ts: the art declares bright literals, and the park re-inks
// them through here. There is no grading function — a colour is dark because it
// is written dark.
//
// This map is the old PARK_INK from ../sprites.ts plus the four palette entries
// that used to be resolved a different way. In sprites.ts a draw reached for
// either `INK('#hex')` (a literal, looked up here) or `PAL.name` (a palette
// key, where `PAL` was swapped wholesale between COLORS and NIGHT). One art
// file cannot have two colour paths, so the palette keys now go through `ink`
// as well — which means their COLORS value has to map to their NIGHT value
// explicitly. Those four are marked below; drop one and its object renders
// bright in the middle of the night park.
//
// Three entries are the PINE's tones, copied from ../trees/parkInk.ts. The
// light tree is the park's pine with lamps on it (see lightTree.ts), so it
// hands the species' colours to this ink rather than the trees' one — and they
// have to resolve the same way here, or a decorated pine would stand bright
// beside a wild one. Retune them there and retune them here.
const PARK_INK: Record<string, string> = {
  '#2E2E2E': '#302F30',
  '#2F7C43': '#2C5252', // pine, dark — see the pine note above
  '#3A2E2C': '#392F2E',
  '#46A15A': '#3C6E60', // pine, light — see the pine note above
  '#4A4A4A': '#444344', // = COLORS.charcoal → NIGHT.charcoal
  '#6E6E6E': '#5F5D5F',
  '#767A80': '#65656D',
  '#7A5A12': '#693928', // pine trunk — see the pine note above
  '#8B6914': '#764428', // COLORS.treeTrunk → NIGHT.treeTrunk
  '#8C877E': '#766F6A',
  '#8C9096': '#75767E',
  '#8E3E37': '#7A3733',
  '#A5503F': '#8C4438',
  '#A6A29A': '#8A8380',
  '#A87B4A': '#8E6641',
  '#B5895A': '#97714D',
  '#C0554B': '#A14741',
  '#C4A06A': '#A38259',
  '#C9C9C9': '#A5A1A5',
  '#D4A574': '#AF8661', // COLORS.dirt → NIGHT.dirt
  '#E2D896': '#BAAE7C',
  '#E8C9A0': '#BFA184', // = COLORS.dirtLight → NIGHT.dirtLight
  '#EFEFEE': '#DDDBDC',
  '#FF6B6B': '#D25759',
  '#FF6B9D': '#D25782', // COLORS.heart → NIGHT.heart
  '#FFD93D': '#D3B034', // COLORS.fishBowl → NIGHT.fishBowl
}

/**
 * Bright decor colour → its park-mode counterpart. Anything unlisted passes
 * through unchanged, which is deliberate: the fairy lights, the star topper,
 * the lit windows and the drifting music notes are all drawn in raw bright
 * colours so they glow against the night rather than being dimmed into it.
 */
export function parkInk(color: string): string {
  return PARK_INK[color] ?? color
}

/** COLORS.white and NIGHT.white are the same white, so it needs no entry. */
export const identityInk = (color: string): string => color
