# Static Parquet catalog plan

## Goal

Game Stat Pulse should publish a static, review-friendly sports data catalog that can be opened from GitHub Pages on mobile. The browser should receive only generated data artifacts: Parquet files, small CSV samples, raw review JSON, schema files, profile files, quality reports, and a catalog manifest. Credentials must stay in protected automation settings and must never be sent to the browser.

## Target flow

1. Repository automation runs the Python ingestion pipeline.
2. Existing NBA/MLB public mirror files are converted into Parquet.
3. External football API endpoints are fetched only when the protected credential is available.
4. Every generated Parquet dataset gets `schema.json`, `profile.json`, and `quality.json`.
5. `build/catalog/catalog.json` becomes the UI contract.
6. The static site loads the catalog and gives the reviewer one-click access to sample CSV, raw JSON, Parquet, and metadata.

## Data contract

Each catalog entry should include:

- `dataset_id`, `display_name`, `description`, `sport`, `entity`, `granularity`, `season`
- `source_api`, `source_endpoint`, request parameters, paging, and error metadata when available
- `row_count`, `column_count`, `file_size_bytes`, `generated_at_utc`, `availability_status`
- `parquet_url`, `sample_csv_url`, `raw_json_url`, `schema_url`, `profile_url`, `quality_url`
- `primary_key`, `partition_columns`, `schema_version`

## Next engineering steps

1. Update the Pages deployment so it builds the Python data lake before the Vite build, then copies `build/` into `dist/data/`.
2. Update the catalog loader so it checks `/data/catalog/catalog.json` before falling back to the old World Cup mirror.
3. Extend `profile_datasets.py` and `validate_datasets.py` to iterate over generated catalog entries, not only `config/datasets.yml`.
4. Keep `Raw Data Lab` as the next phase: make it catalog-driven so football Parquet files can be explored in DuckDB-WASM, not just downloaded/reviewed.

## Codex implementation prompt

Implement the static Parquet catalog flow in `LindaData/game-stat-pulse`.

Constraints:

- Do not expose credentials in frontend code, logs, committed files, or generated browser assets.
- Keep GitHub Pages static. No backend is required for this phase.
- Preserve the current mobile-first review workflow.
- External API failures or plan restrictions should mark datasets as degraded/missing, not break the whole catalog.
- Add tests or build-time checks where practical.

Required changes:

1. Modify the Pages deployment to install Python dependencies, run the data lake builder, run external football ingestion only when the protected credential is available, then run profile/quality scripts before the Vite build. After the Vite build, copy `build/.` into `dist/data/`.
2. Modify `public/data-source.json` to point at `data/catalog/catalog.json`.
3. Modify `src/lib/catalog.ts` to load the generated static catalog first, resolve relative artifact URLs against the catalog directory, cache the catalog, then fall back to existing public CSV/JSON sources.
4. Modify `scripts/profile_datasets.py` and `scripts/validate_datasets.py` so they profile/validate every Parquet file listed in `build/catalog/catalog.json` and patch catalog entries with profile/quality metadata URLs.
5. Update README with the static data lake layout and the review contract.

Acceptance checks:

- `bun run test` passes.
- `bun run build` passes.
- `python -m py_compile scripts/*.py` passes.
- Generated catalog contains non-empty entries and points to Parquet/sample/schema/profile/quality files where available.
- Browser bundle contains no credential value.
