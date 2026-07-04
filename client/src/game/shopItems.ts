// The shop catalog now lives in the shared protocol (shared/protocol.ts) so the
// SERVER validates purchases against the same prices + footprints — a single
// source of truth for client and server. This module just re-exports it so the
// existing client imports (Shop.tsx, parkStore.ts) don't change. `type` maps to
// a case in drawObjectByType / drawShopSprite; `w`/`h` are the tile footprint;
// `price` is in coins (which are server-owned "likes").
export { SHOP_ITEMS, SHOP_ITEMS_BY_KEY, type ShopItem } from '@koala/shared'
