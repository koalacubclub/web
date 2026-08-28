# Code style — how this codebase is written

The conventions here were **read off the existing code**, not invented. They
describe how the ~120 source files already work, so a new file that follows them
looks like it belongs and a reviewer has less to say.

Two things this doc deliberately does **not** cover:

- **Anything a tool already enforces.** Semicolons, quotes, trailing commas and
  line width are Prettier's business; hook rules are oxlint's; commit shape is
  commitlint's. Run `pnpm format` and stop thinking about it. See
  [Enforcement](#enforcement) for what runs when.
- **Why the architecture is the way it is.** That's
  [decisions.md](./decisions.md) — read it before changing anything it covers.

---

## 1. Comments say _why_, not _what_

This is the strongest and most valuable convention in the repo, and the easiest
one to lose. The code is unusually well commented, but almost none of it narrates
what the next line does. It records **the reason a choice was made**, usually the
reason that isn't visible from the code.

Every non-trivial module opens with a prose header: what this module is, and why
it exists as a separate module. `client/src/game/decor/index.ts` opens by saying
these pieces used to live in `sprites.ts` and why they left. `shared/protocol.ts`
opens by saying it is imported by both the browser and the Worker and must
therefore stay dependency-free.

Inline comments guard invariants and regressions. From
`client/src/game/jump.ts:9`:

```ts
// The "never jumped" sentinel is -Infinity (NOT 0): performance.now()'s origin is
// page load, so a 0 sentinel would read as "jumped at load" and render a phantom
// hop for the first JUMP_DURATION_MS. -Infinity yields t=Infinity → 0 (grounded).
```

That comment exists because someone could "clean up" `-Infinity` to `0` and
reintroduce a real bug. **That is the bar: write the comment that stops the next
person undoing you.** A comment that restates the code (`// increment i`) is
noise; delete it.

Use `/** … */` for the doc comment on an exported symbol, `//` for everything
else.

## 2. Decisions belong in `docs/decisions.md`

When a choice is non-obvious, has a trade-off, or would look like a mistake to
someone who wasn't there, add a short numbered ADR-style entry to
[decisions.md](./decisions.md) — what was chosen, why, and what it costs. The
existing entries are the template: two or three paragraphs, with a **"why not X"**
paragraph where a reasonable person would have picked X.

Rule of thumb: if the explanation is about **this file**, it's a header comment;
if it's about **the shape of the project**, it's a decisions entry.

## 3. Exports: named, and typed at the boundary

- **Named exports.** 141 `export function` and 64 `export const` against 7
  `export default` — the defaults are React page/screen components only. New
  modules export by name.
- `export function` for the module's real API; `const` arrow functions for small
  local helpers (`seedAt`, `rollForm` in `game/decor/index.ts`).
- **Annotate the return type of exported functions** (`: void`, `: number`).
  Inference is fine inside a module; the boundary is documentation.
- Types live in a sibling `types.ts` and are re-exported from `index.ts` when
  callers need them. `verbatimModuleSyntax` is on, so type-only imports must say
  `import type`.

## 4. Module families share one shape

`game/trees`, `game/flowers`, `game/rocks`, `game/props` and `game/decor` are all
laid out identically, and that is on purpose — learn one, you can read all five:

```
types.ts      shared types for the family (Ctx, Ink, DrawArgs…)
catalog.ts    the data: what exists, and its metadata
variance.ts   the shared jitter/bob/seeded helpers
parkInk.ts    the colour pass: BRIGHT art in, park-graded colour out
<species>.ts  one file per tree/flower/piece — art only
index.ts      the family's public surface + dispatch
<family>.test.ts
```

When you add to a family, add a file — don't grow an existing one with a second
subject. Growing files is exactly what these directories were extracted from
(`sprites.ts` used to hold all of it, coordinated through three mutable
module-level variables that every draw silently read).

## 5. Keep logic out of the canvas and out of React

`jump.ts`, `proximity.ts`, `culling.ts`, `parkCamera.ts`, `abilityWheel.ts` are
plain functions over plain numbers, with no `ctx` and no React. That's why they
have tests and the 2,000-line component doesn't.

So: when you're about to add a rule, an arc, a threshold or a bit of arithmetic
to a component or a draw call, **put it in its own module and call it**. The
component stays a component; the rule becomes testable.

## 6. Tests sit next to the thing, and say what they defend

`<module>.test.ts` lives beside `<module>.ts` — 25 suites, all colocated, all
Vitest (`describe` / `it` / `expect`). Two habits worth copying from
`game/jump.test.ts`:

- A comment above `describe` naming the invariant the suite exists to protect,
  including any regression it locks in.
- `it(…)` names that are **sentences about behaviour** — `'is 0 for the "never
jumped" sentinel (-Infinity), even early after load'`, not `'works'`.

A bug fix lands with the test that would have caught it. Playwright e2e specs
cover flows through the running app; they are not a substitute for a unit test on
the rule that broke.

## 7. Determinism in the park

Anything visual that varies per tile is rolled from a **seeded PRNG keyed on the
tile** (`makeRng`, `seedAt`), never from `Math.random()`. A piece must be the
same piece on every frame and every reload, or it flickers and crawls. Distinct
salts keep independent rolls independent — see the `SEED_*` constants in
`game/decor/index.ts` and the tests that pin them.

Motion is driven by elapsed time (`dt`), never by frame count, so the game runs
at one real speed on any device — [decisions.md #13](./decisions.md).

## 8. Imports and shared values

- Client code imports itself through the `@/` alias (`@/game/parkStore`), and
  siblings by relative path (`./ball`, `../constants`).
- Anything the client **and** the server both need is a constant or type in
  `@koala/shared` (`shared/protocol.ts`) — never a duplicated literal. That file
  must stay dependency-free and erasable-only (no `enum`, no namespaces): it
  compiles under two different tsconfigs.
- `client/src/data/*.ts` must stay **Node-safe** — `vite.config.ts` imports them
  at build time ([decisions.md #2](./decisions.md)).

## 9. TypeScript

Hand-written client source contains **zero `any`** — keep it that way; reach for
`unknown` plus a narrow, or a real type. `noUnusedLocals`, `noUnusedParameters`
and `noFallthroughCasesInSwitch` are on in both packages.

> **Known gap:** `server/tsconfig.json` sets `"strict": true`;
> `client/tsconfig.app.json` does not. The client nonetheless type-checks clean
> under `--strict` today, so turning it on is a one-line change that costs
> nothing and stops the gap widening.

---

## Enforcement

Guidelines that a machine checks don't need a reviewer. What already runs:

| When           | What                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| **commit-msg** | commitlint — [Conventional Commits](https://www.conventionalcommits.org/) |
| **pre-commit** | lint-staged → `oxlint --fix` + `prettier --write` on staged files         |
| **pre-push**   | `pnpm typecheck` + `pnpm test`                                            |
| **CI**         | lint · typecheck · format:check · unit tests · build · Playwright e2e     |

Hooks are local and skippable; CI is the gate. `main` is often busy with parallel
work — rebase before pushing, or use a feature branch + PR.

**If a rule in this doc can be moved into a lint rule or a test, move it.** The
list above is the better place for a convention than this page is; treat prose as
the fallback for things a tool can't check — which is most of §1 and §2, and very
little else.
