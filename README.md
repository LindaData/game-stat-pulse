# Game Stat Pulse

Game Stat Pulse is a mobile-first sports-data approval portal. Its current job is to let a domain reviewer inspect the collected data structure before any predictive model is built.

## Static catalog direction

The preferred direction is a static GitHub Pages review app backed by a generated Parquet catalog. Python ingestion should create the data lake, metadata, quality reports, and a catalog manifest during repository automation. The browser should load static artifacts only: catalog JSON, Parquet files, sample CSVs, raw review JSON, schemas, profiles, and quality reports.

The API credential must remain in protected repository automation settings. It must never be committed, logged, bundled, or sent to the browser.

## Architecture

- **Frontend:** React 18, Vite, Tailwind, and shadcn/ui.
- **Review page:** Dynamic catalog queue with search, filters, all-column tables, schema inspection, notes, and approval decisions.
- **API ingestion:** Python requests executed only inside repository automation.
- **Storage:** Bronze JSON, normalized Parquet, limited CSV samples, schemas, profiles, quality reports, and a central catalog.
- **Pages deployment:** GitHub Pages should receive generated static data files and metadata, not credentials.
- **Optional full lake:** Cloudflare R2 can receive the full generated build through the scheduled publishing workflow.

## Static data-lake layout

```text
build/catalog/catalog.json
build/bronze/.../*.json.gz
build/raw/api-football/<dataset_id>/sample.json
build/silver/sport=<sport>/dataset=<dataset_id>/season=<season>/data.parquet
build/samples/<sport>/<dataset_id>/<season>/sample_<n>.csv
build/metadata/<dataset_id>/schema.json
build/metadata/<dataset_id>/profile.json
build/metadata/<dataset_id>/quality.json
```

## Data contract

Each catalog entry should include dataset identity, source endpoint, row/column counts, file size, generated timestamp, availability status, Parquet URL, sample CSV URL, raw JSON URL, schema URL, profile URL, quality URL, primary key, partitions, and schema version.

## API endpoint registry

`config/api_football_endpoints.yml` controls the approval sample. The registry is configuration-driven, so additional endpoints can be added without changing the frontend. Endpoint failures or plan restrictions should mark catalog entries degraded or missing rather than breaking the workflow.

## Pages

| Route | Purpose |
| --- | --- |
| `/` or `/approval` | Primary data approval queue |
| `/datasets` | Dataset catalog and downloads |
| `/explore` | DuckDB-WASM data explorer |
| `/coverage` | Coverage matrix |
| `/dictionary` | Field dictionary |
| `/quality` | Data-quality results |
| `/basket` | Flagged record basket |
| `/status` | Source and cache status |

## Local development

```bash
bun install
bun run dev
bun run test
bun run build
```

Build the local data catalog:

```bash
pip install duckdb pandas pyarrow requests pyyaml
python scripts/build_data_lake.py
python scripts/profile_datasets.py
python scripts/validate_datasets.py
```

Never place the real key in `.env` files that are committed, source code, frontend variables, logs, or browser requests.

## Deployment

- Pull requests should run data generation, tests, and production build.
- Pushes to `main` should build the static data lake, copy it into `dist/data`, and deploy the app to GitHub Pages.
- The scheduled data-lake workflow can publish the complete generated lake to R2 when optional storage settings are configured.
