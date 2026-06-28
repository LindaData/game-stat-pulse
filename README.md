# LindaData Sports Hub

A static React/Vite application that loads public sports data published by the
[LindaData/world-cup-2026-betting-model](https://github.com/LindaData/world-cup-2026-betting-model)
repository and renders NBA & MLB live scores, season game logs, standings, and
a Parquet-powered **Raw Data Lab** for browser-based analysis.

The site is 100% static — no backend, no auth, no secrets, no edge functions.
Deploys cleanly to GitHub Pages or Cloudflare Pages.

## Pages

| Route        | Purpose                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| `/`          | Home: live scores, NBA/MLB summary, link to Raw Data Lab.                     |
| `/nba`       | Live NBA games, searchable historical log, standings.                         |
| `/mlb`       | Live MLB games, searchable historical log, standings.                         |
| `/raw`       | **Raw Data Lab** — DuckDB-WASM querying Parquet (or CSV fallback).            |
| `/status`    | Live + Parquet source health, HTTP results, copy diagnostics, retry buttons.  |

Bottom mobile nav: Home · NBA · MLB · Raw Data · Status.

## Raw Data Lab architecture

```
Public API / scoreboard
  → GitHub Actions
  → Parquet files + manifest stored in the repo
  → LindaData Sports Hub loads & queries Parquet via DuckDB-WASM in the browser
  → Users download CSV / JSON generated client-side
```

* **Engine**: [`@duckdb/duckdb-wasm`](https://duckdb.org/docs/api/wasm), lazy-loaded
  the first time `/raw` is opened. The query worker is created from the JSDelivr
  bundle so no wasm assets need to be vendored.
* **Strategy**: For each dataset we `HEAD` the Parquet URL. If the file exists
  we register it with DuckDB and `SELECT * FROM read_parquet(...)`. If the
  Parquet file 404s we automatically fall back to the CSV (or JSON for live
  feeds) and mark the dataset as **CSV fallback** in the UI.
* **Lazy work**: schema profiling and data-quality checks only run when their
  tab is opened, and the results are cached per dataset.
* **Sample-first UI**: Explore opens on the latest 25 records with a clear
  "View more records" affordance. Sample modes: latest, earliest, first,
  deterministic random (re-seed with "New random sample"), full query.
* **CSV exports** are produced by DuckDB itself via
  `COPY (query) TO 'name.csv' WITH (HEADER, FORMAT 'csv')` and downloaded as a
  Blob — no backend needed.

### Dataset registry (the "manifest")

`src/lib/parquetData.ts` exports `DATASETS`, one entry per logical dataset with:

```
{
  id, display_name, sport, dataset_type,
  parquet_url, csv_fallback_url, source_url,
  filename_base, season, primary_key, description
}
```

This is the canonical manifest consumed by the UI to build dataset cards.
Once GitHub Actions starts publishing `manifest.json` with the same shape, the
loader can be extended to fetch and merge it without UI changes.

### How Parquet files are generated

Out of scope for this repo — handled by GitHub Actions in the source data
repository. The expected workflow:

1. Scheduled workflow fetches the public API.
2. Normalises into the same column shape as the existing CSVs.
3. Writes `*_full.parquet` next to the existing CSV files under
   `docs/sports-data/data/`.
4. Commits & pushes — the static site picks them up on next load.

Expected Parquet filenames:

```
basketball_games_full.parquet
basketball_standings.parquet
baseball_games_full.parquet
baseball_standings.parquet
nba_live.parquet
mlb_live.parquet
```

### How CSV downloads are created

Inside the browser, the current `Explore` query is re-issued through DuckDB
with `COPY ... TO '*.csv' (HEADER, FORMAT 'csv')`. The buffer is read back via
`db.copyFileToBuffer` and saved with the File API. Field names are preserved
exactly as they appear in Parquet. UTF-8, RFC-4180-style quoting.

### How to add a new sport

1. Add the new entries to `DATASETS` in `src/lib/parquetData.ts`
   (set `parquet_url`, `csv_fallback_url`, `season`, `dataset_type`).
2. The dataset card and all five tabs (Explore / Schema / Quality / Downloads /
   Lineage) are generated automatically.
3. If the new dataset has unusual default columns, extend `pickDefaultColumns`
   in `src/pages/RawDataLab.tsx`.
4. Optionally surface the sport in the top-level nav (`src/components/Layout.tsx`)
   and create a `/<sport>` page mirroring `src/pages/NBA.tsx`.

### How to update dataset URLs

All URLs are derived from `BASE` in `src/lib/parquetData.ts`. Change `BASE` to
point at a different mirror, or override individual `parquet_url` /
`csv_fallback_url` per dataset.

## Caching & reliability

* DuckDB result sets and dataset metadata live in memory.
* Tiny settings (selected dataset id, etc.) live in `localStorage`.
* Large Parquet blobs are **not** copied into `localStorage` — the browser HTTP
  cache handles those.
* `Promise.allSettled` is used for the parallel "Refresh all" flow so a single
  failing dataset never blocks the rest.
* Tab switches do not refetch; the user must press **Refresh** to bust caches.

## Local development

```sh
bun install
bun run dev
```

## Deployment

GitHub Pages workflow lives at `.github/workflows/deploy.yml` and the Vite
`base` is `/lindadata-sports-hub/`. Push to a repo named `lindadata-sports-hub`
and enable Pages → GitHub Actions.

## Transparency

The site displays only public historical and live sports-data snapshots for
research and development. **No betting, profitability, or prediction claims
are made.**
