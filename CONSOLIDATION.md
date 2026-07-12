# This repo has been consolidated

The LindaData sports portfolio now lives in a single monorepo:
**[world-cup-2026-betting-model](https://github.com/LindaData/world-cup-2026-betting-model)**
(see PR [#16](https://github.com/LindaData/world-cup-2026-betting-model/pull/16) and its `MIGRATION.md`).

This app moved to `apps/web/` in that repo, keeping the approval workflow,
DuckDB explorer, quant libraries (edge/Kelly, model audit, bankroll ledger),
and tests, and gaining a World Cup 2026 landing page. The betting desk pages
are now gated behind `VITE_ENABLE_BETTING_DESK`.

This repo stays live and untouched until after the World Cup final
(2026-07-19), then gets archived. Do not add new features here — contribute
to the monorepo instead.

Note: any approval/ledger records you saved here live in your browser's
localStorage for this domain. Export them to CSV from the app before the
GitHub Pages deployment is retired if you want to keep them.
