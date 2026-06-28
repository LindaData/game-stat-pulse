# LindaData Sports Hub

A static React + Vite site that visualizes public sports research data from the
[LindaData/world-cup-2026-betting-model](https://github.com/LindaData/world-cup-2026-betting-model)
repository. **No backend, no database, no secrets.** All data is fetched at
runtime directly from the public `raw.githubusercontent.com` URLs.

> All figures are historical research data. The site makes **no betting claims**.

## Features

- **Home** — live NBA/MLB score cards + season/standings counts
- **NBA / MLB pages** — live games, searchable/sortable/paginated season game log,
  group-filterable standings
- **Data Status page** — every source listed with row count, origin
  (network / fallback / cache), last success timestamp, and a **Refresh Data** button
- Robust loading: PapaParse for CSV, cache-busting query string, independent
  per-source loads, full-season → small-file fallback, `localStorage` cache that
  is never overwritten by an empty response
- Mobile-first: bottom tab navigation + card layouts on iPhone, table layouts on desktop
- Dark navy + white cards + teal accents

## Local dev

```bash
bun install
bun run dev
```

## Deploy to GitHub Pages

1. Create a GitHub repo named **`lindadata-sports-hub`** and push this project.
2. In repo Settings → Pages, set **Source** to *GitHub Actions*.
3. The included workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`.

The Vite `base` is already set to `/lindadata-sports-hub/` for production builds.
The workflow also copies `index.html` → `404.html` so deep links work on Pages.

## Data sources

All from `https://raw.githubusercontent.com/LindaData/world-cup-2026-betting-model/main/docs/sports-data/data/`:

- `manifest.json`, `live_manifest.json`
- `nba_live.json`, `mlb_live.json`
- `basketball_games_full.csv` (fallback: `basketball_games.csv`)
- `basketball_standings.csv`
- `baseball_games_full.csv` (fallback: `baseball_games.csv`)
- `baseball_standings.csv`
