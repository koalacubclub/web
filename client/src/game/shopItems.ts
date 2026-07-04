// The shop catalog — the single source of truth for BOTH the shop UI
// (src/components/Shop.tsx, which renders each item's real procedural art via
// src/game/sprites.ts) and the placement footprint the game reserves on the map
// (src/game/parkStore.ts). `type` maps to a case in `drawObjectByType`; `w`/`h`
// are the tile footprint; `price` is in coins (the game score is the wallet).
// Ordered cheapest → priciest so the carousel reads as a progression.

export interface ShopItem {
  key: string // stable id (also the GameObject.type for reused decor)
  label: string // display + accessible name
  type: string // sprite type in drawObjectByType
  w: number // footprint width in tiles
  h: number // footprint height in tiles
  price: number // cost in coins
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    key: 'flowers',
    label: 'Flower patch',
    type: 'flowers',
    w: 1,
    h: 1,
    price: 20,
  },
  {
    key: 'mushroom',
    label: 'Mushroom',
    type: 'mushroom',
    w: 1,
    h: 1,
    price: 25,
  },
  { key: 'stone', label: 'Warm rock', type: 'stone', w: 1, h: 1, price: 30 },
  { key: 'ball', label: 'Toy ball', type: 'ball', w: 1, h: 1, price: 35 },
  { key: 'snowcat', label: 'Snow-cat', type: 'snowcat', w: 1, h: 1, price: 60 },
  {
    key: 'cardbox',
    label: 'Cardboard box',
    type: 'cardbox',
    w: 2,
    h: 1,
    price: 70,
  },
  { key: 'bench', label: 'Park bench', type: 'bench', w: 2, h: 1, price: 90 },
  { key: 'pond', label: 'Pond', type: 'pond', w: 3, h: 2, price: 150 },
  { key: 'tree', label: 'Tree', type: 'tree', w: 2, h: 2, price: 180 },
  {
    key: 'house',
    label: 'Little house',
    type: 'house',
    w: 4,
    h: 4,
    price: 300,
  },
]

export const SHOP_ITEMS_BY_KEY: Record<string, ShopItem> = Object.fromEntries(
  SHOP_ITEMS.map((item) => [item.key, item]),
)
