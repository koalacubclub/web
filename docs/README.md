# Docs — Koala Cub Club

This folder is the **durable context** for the project: the key facts and, more
importantly, the **reasoning behind non-obvious decisions**. It is intentionally
_not_ exhaustive — read the code for details. Start here so you don't re-derive
(or accidentally undo) choices that were made on purpose.

| Doc                                                    | What's in it                                                                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)                   | Stack, rendering model, directory map, the data-as-source-of-truth + build pipeline.                                                                                                               |
| [decisions.md](./decisions.md)                         | The **why** — short ADR-style entries for each key decision. Read this first.                                                                                                                      |
| [content-workflows.md](./content-workflows.md)         | How to refresh the reel feed and the followers ("club") wall — a deliberately semi-manual, agent-assisted process.                                                                                 |
| [game.md](./game.md)                                   | The `ParkGame` canvas mini-game: coordinate system, controls (incl. mobile gestures), food/scoring, rendering & performance.                                                                       |
| [rendering.md](./rendering.md)                         | Deep dive: the tile→logical→device→screen coordinate pipeline, why the abstractions exist, and the `?dev` developer overlays (editable diagram).                                                    |
| [multiplayer.md](./multiplayer.md)                     | How the shared park works: the authoritative Durable Object, Worker auth/routing, wire protocol, persistence, offline, hibernation, and anti-cheat (with an embedded, editable Excalidraw diagram). |
| [multiplayer-deploy.md](./multiplayer-deploy.md)       | Deploying the game Worker + Durable Object (wrangler, secrets, custom domain).                                                                                                                      |
| [food-icons.md](./food-icons.md)                       | _(Legacy)_ Raster food-sprite art spec — the PNG pipeline was removed; food is drawn procedurally now.                                                                                             |
| [perf-main-thread-plan.md](./perf-main-thread-plan.md) | Main-thread performance analysis + a ranked, verified fix plan (measure prod first; canvas/CSS paint costs).                                                                                        |

Conventions: [Conventional Commits](https://www.conventionalcommits.org/); the
`@/` import alias maps to `src/`. `main` is often busy with parallel work — rebase
before pushing, or use a feature branch + PR.
