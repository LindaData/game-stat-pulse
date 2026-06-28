# Game Stat Pulse

A static, mobile-first sports-data review portal. Lets a technical project owner
and a sports-domain reviewer inspect raw and normalized NBA and MLB datasets,
download CSV samples, and flag records for review — with no backend, no auth,
and no paid infrastructure.

This iteration is a **raw-data review portal**. It does not produce predictions,
betting models, recommendations, or profitability claims.

## Architecture

- **Frontend**: React 18 + Vite + Tailwind + shadcn/ui. Deployed as static
  files (GitHub Pages).
- **Data lake**: Cloudflare R2 public object storage, populated by a scheduled
  GitHub Actions workflow. Three tiers:
  - `bronze/` — original API JSON responses (gzip), keys redacted.
  - `silver/` — normalized Zstandard-compressed Parquet, partitioned by sport,
    dataset, and season.
  - `samples/` — pre-generated 100-row CSV per dataset, downloadable without
    booting DuckDB.
- **Catalog**: `catalog/catalog.json` enumerates every dataset and is read by
  the website to build navigation, stats, and download links.
- **Query engine**: DuckDB-WASM in a Web Worker queries Parquet directly from
  R2. CSV exports are produced in the browser.
- **No credentials in the browser**: R2 write keys and API-Sports keys live in
  GitHub Actions secrets only.

## Configuring the data catalog

The app reads `public/data-source.json`:

```json
{
  "catalog_url": "https://<your-r2-public-domain>/catalog/catalog.json",
  "fallback_mode": true
}
```

Until the R2 catalog is published, `fallback_mode: true` keeps the site working
by building a catalog from the existing public LindaData GitHub repository
(see `src/lib/catalog.ts`).

Replace `REPLACE_WITH_R2_PUBLIC_DOMAIN` in `public/data-source.json` with your
R2 public hostname after publishing the catalog.

## GitHub Actions secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret                 | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account ID for the R2 bucket              |
| `R2_ACCESS_KEY_ID`     | R2 access key                                        |
| `R2_SECRET_ACCESS_KEY` | R2 secret key                                        |
| `R2_BUCKET_NAME`       | Bucket name (e.g. `game-stat-pulse-data`)            |
| `R2_PUBLIC_BASE_URL`   | Public base URL exposed by R2 / Cloudflare (no slash)|

If any of those are missing, the workflow still builds the lake locally and
uploads it as a short-lived GitHub Actions artifact.

## Data pipeline scripts

- `config/datasets.yml` — registry of datasets to build.
- `scripts/build_data_lake.py` — bronze + silver + samples + catalog.
- `scripts/profile_datasets.py` — per-column statistics → `profile.json`.
- `scripts/validate_datasets.py` — quality rules → `quality.json`.
- `.github/workflows/publish-data-lake.yml` — runs daily and on demand.

Run locally:

```bash
pip install duckdb pandas pyarrow requests pyyaml
python scripts/build_data_lake.py
python scripts/profile_datasets.py
python scripts/validate_datasets.py
```

## App scripts

```bash
bun install
bun run dev       # local dev server
bun run build     # production build
bun run test      # vitest
```

The Vite `base` is set to `/game-stat-pulse/` so the static build is hosted at
`https://<org>.github.io/game-stat-pulse/`.

## Pages

| Route          | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `/`            | Dataset catalog (sport + entity filters, sample download) |
| `/explore`    | Per-dataset Explorer: filters, sample modes, inspector    |
| `/coverage`    | Sport × league × season × entity coverage matrix          |
| `/dictionary`  | Every field, exportable as CSV                            |
| `/quality`     | High-level data-quality status                            |
| `/basket`      | Review basket (IndexedDB), exports `review_notes.csv`     |
| `/status`      | Source-by-source health, fallback, cache origin           |

## Deployment

Pushes to `main` deploy the static site via
`.github/workflows/deploy.yml`. The published data lake is independent and is
updated on its own daily schedule.

## Notes

- Game Stat Pulse provides raw and normalized sports-data snapshots for research,
  domain review, and future model development. Parquet is the primary analytical
  format. Sample and filtered CSV downloads are available for Excel, Google
  Sheets, and general review.
- No predictive, betting, profitability, or recommendation features are
  included in this phase.
