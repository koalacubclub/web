import { describe, expect, it } from 'vitest'
// Load the component source as text (Vite `?raw`) so we can assert a rendering
// invariant that jsdom can't exercise (there's no 2D canvas in tests).
import src from './ParkGame.tsx?raw'

// Locks the canvas z-order for collectibles vs. placed decorations.
//
// In the game loop, placed shop items are painted by `drawObjects(...)` and the
// collectible food by `drawFoods()`. Because later canvas draws paint on top,
// food must be drawn AFTER the objects so treats render *above* the items a
// player places — never hidden behind them (a treat may sit on top of an item;
// that's the intended behaviour).
//
// Reorder those two draws in the loop and this test fails.
describe('ParkGame render order (z-layering)', () => {
  it('paints food after placed items in the game loop (treats on top)', () => {
    // Slice from the loop so we match the *calls*, not the function definitions
    // (which appear earlier in the file).
    const loopStart = src.indexOf('function gameLoop')
    expect(loopStart).toBeGreaterThan(-1)
    const loop = src.slice(loopStart)

    const objectsAt = loop.indexOf('drawObjects(')
    const foodAt = loop.indexOf('drawFoods(')

    expect(objectsAt).toBeGreaterThan(-1)
    expect(foodAt).toBeGreaterThan(-1)
    // Objects (incl. placed items) drawn before food ⇒ treats render on top.
    expect(objectsAt).toBeLessThan(foodAt)
  })
})
