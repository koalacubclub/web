// Park-mode counterparts for the colours the props draw with.
//
// Same mechanism as ../trees/parkInk.ts and PARK_INK in ../sprites.ts: the art
// declares bright literals, and the park re-inks them through here. There is no
// grading function — a colour is dark because it is written dark.
//
// The water entries are the ones to keep an eye on: they must stay in the same
// periwinkle family as POND_WATER / POND_DEEP in ParkGame, or a re-skinned pond
// stops matching the one the game draws today.
//
// Stone is deliberately absent: the pond's rim is drawn with the rocks module's
// own faceted stones, so those colours resolve through ../rocks/parkInk rather
// than being duplicated (and drifting) here.
import { parkInk as rockInk } from '../rocks'

const PARK_INK: Record<string, string> = {
  // pond water, deep → shallow
  '#4E8FE0': '#435BC2', // POND_DEEP
  '#64B5F6': '#4F75E3', // COLORS.water → POND_WATER
  '#8FD0FA': '#6E8CE8',
  '#BFE6FF': '#8FA6F0', // surface glints
  // wet earth at the waterline
  '#9C7C5A': '#6E5347',
  // reeds and lily pads
  '#4E9150': '#436258',
  '#5EA855': '#4E735A',
  '#7CBE63': '#658364',
  // bench — timber over a dark frame
  '#8D6E63': '#744A68', // NIGHT.bench
  '#A1887F': '#825D7E', // NIGHT.benchLight
  '#6B5049': '#573A50',
  '#4A3832': '#3E2A3B',
}

/**
 * Bright prop colour → its park-mode counterpart, falling back to the rocks
 * module's map so the pond's rim stones ink exactly like every other stone in
 * the park. Anything neither map knows passes through unchanged.
 */
export function parkInk(color: string): string {
  return PARK_INK[color] ?? rockInk(color)
}
