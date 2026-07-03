# Docs — Koala Cub Club

This folder is the **durable context** for the project: the key facts and, more
importantly, the **reasoning behind non-obvious decisions**. It is intentionally
_not_ exhaustive — read the code for details. Start here so you don't re-derive
(or accidentally undo) choices that were made on purpose.

| Doc                                            | What's in it                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [architecture.md](./architecture.md)           | Stack, rendering model, directory map, the data-as-source-of-truth + build pipeline.                               |
| [decisions.md](./decisions.md)                 | The **why** — short ADR-style entries for each key decision. Read this first.                                      |
| [content-workflows.md](./content-workflows.md) | How to refresh the reel feed and the followers ("club") wall — a deliberately semi-manual, agent-assisted process. |
| [game.md](./game.md)                           | The `ParkGame` canvas mini-game: coordinate system, controls, the food-collectible system, scoring.                |
| [food-icons.md](./food-icons.md)               | Art spec + generation prompts for the collectible food sprites.                                                    |

Conventions: [Conventional Commits](https://www.conventionalcommits.org/); the
`@/` import alias maps to `src/`. `main` is often busy with parallel work — rebase
before pushing, or use a feature branch + PR.
