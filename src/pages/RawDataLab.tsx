import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, Copy, X, Database } from "lucide-react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { JsonTree } from "@/components/JsonTree";
import {
  DATASETS,
  getSourceFor,
  profileRows,
  qualityReport,
  sampleRows,
  type SampleMode,
  type DatasetDef,
  type FieldProfile,
  downloadText,
  downloadOriginal,
  rowsToCsv,
  resultRowsFor,
  copyToClipboard,
  inferType,
  isEmpty,
} from "@/lib/rawData";

type TabKey = "explorer" | "schema" | "quality" | "json" | "lineage";

export default function RawDataLab() {
  const { results, loading, lastRefresh, refresh } = useData();
  const [datasetId, setDatasetId] = useState<string>(DATASETS[0].id);
  const dataset = DATASETS.find((d) => d.id === datasetId) ?? DATASETS[0];
  const source = getSourceFor(dataset);
  const result = results[dataset.sourceKey];

  const [tab, setTab] = useState<TabKey>("explorer");
  useEffect(() => {
    // reset to explorer (or json for json datasets) when dataset changes
    setTab(dataset.kind === "json" ? "json" : "explorer");
  }, [datasetId, dataset.kind]);

  const rows = useMemo(() => resultRowsFor(result), [result]);
  const isCsv = dataset.kind === "csv";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Raw Data Lab
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Browser-based explorer over the public LindaData sports-data files. Historical research
            data only — no betting, profitability, or prediction claims.
          </p>
        </div>
        <Button onClick={() => refresh()} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Retry / Refresh
        </Button>
      </div>

      {/* Dataset selector */}
      <div className="surface-card p-3">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Dataset
        </label>
        <select
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
          className="mt-1 w-full bg-background text-foreground border border-input rounded-md px-3 py-2 text-sm"
        >
          {(["NBA", "MLB", "Meta"] as const).map((group) => (
            <optgroup key={group} label={group}>
              {DATASETS.filter((d) => d.group === group).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Dataset meta */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Info label="Filename" value={dataset.filename} />
          <Info label="Type" value={dataset.kind.toUpperCase()} />
          <Info label="Rows" value={result ? result.rows.toLocaleString() : "—"} />
          <Info
            label="Fields"
            value={
              isCsv && rows.length
                ? String(new Set(rows.flatMap((r) => Object.keys(r))).size)
                : dataset.kind === "json"
                  ? "—"
                  : "0"
            }
          />
          <Info label="Group" value={dataset.group} />
          <Info label="Season" value={dataset.season ?? "—"} />
          <Info
            label="Origin"
            value={result?.origin === "fallback" ? "Fallback file" : result?.origin === "cache" ? "Browser cache" : result?.origin === "network" ? "Live network" : "Unavailable"}
          />
          <Info
            label="Last refresh"
            value={result ? new Date(result.fetchedAt).toLocaleString() : "—"}
          />
        </div>

        <a
          href={result?.url ?? source.url}
          target="_blank"
          rel="noreferrer"
          className="block mt-3 text-[11px] text-primary break-all hover:underline"
        >
          {result?.url ?? source.url}
        </a>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {result ? <StatusBadge origin={result.origin} /> : <span className="chip bg-muted text-muted-foreground">Loading…</span>}
          {result?.origin === "fallback" && (
            <span className="text-[11px] text-amber-400">
              Showing smaller fallback file — full-season file unavailable.
            </span>
          )}
          {result?.origin === "cache" && (
            <span className="text-[11px] text-sky-300">
              Network failed — showing cached copy from {new Date(result.fetchedAt).toLocaleString()}.
            </span>
          )}
          {result?.origin === "empty" && (
            <span className="text-[11px] text-red-400">
              No data available. {result.error}
            </span>
          )}
        </div>
      </div>

      {/* Notice */}
      <div className="text-[11px] text-muted-foreground border border-white/5 rounded-md p-3 bg-white/[0.02]">
        Raw Data Lab displays public historical and live sports-data snapshots for research and
        development. The visual preview may show a sample for performance, while full source files
        remain available for download.
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {(
          [
            isCsv && { k: "explorer", label: "Explorer" },
            { k: "json", label: "JSON" },
            isCsv && { k: "schema", label: "Schema" },
            isCsv && { k: "quality", label: "Data Quality" },
            { k: "lineage", label: "Lineage" },
          ].filter(Boolean) as { k: TabKey; label: string }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              tab === t.k ? "bg-primary text-primary-foreground" : "bg-white/5 text-foreground/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === "explorer" && isCsv && <ExplorerTab dataset={dataset} rows={rows} />}
      {tab === "schema" && isCsv && <SchemaTab rows={rows} dataset={dataset} />}
      {tab === "quality" && isCsv && <QualityTab rows={rows} dataset={dataset} />}
      {tab === "json" && (
        <JsonTab
          data={result?.data}
          dataset={dataset}
          sourceUrl={result?.url ?? source.url}
        />
      )}
      {tab === "lineage" && <LineageTab dataset={dataset} rows={rows} />}

      {lastRefresh && (
        <p className="text-[11px] text-muted-foreground">
          Last refresh attempt: {new Date(lastRefresh).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-foreground font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

/* ============================== EXPLORER ============================== */

function ExplorerTab({ dataset, rows }: { dataset: DatasetDef; rows: Record<string, unknown>[] }) {
  const allFields = useMemo(
    () => Array.from(rows.reduce((acc, r) => (Object.keys(r).forEach((k) => acc.add(k)), acc), new Set<string>())),
    [rows],
  );
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [visibleCols, setVisibleCols] = useState<string[]>(allFields);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sampleMode, setSampleMode] = useState<SampleMode>("full");
  const [sampleSize, setSampleSize] = useState(100);
  const [seed, setSeed] = useState(1);
  const [colChooserOpen, setColChooserOpen] = useState(false);
  const [inspected, setInspected] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setVisibleCols(allFields);
    setColFilters({});
    setSearch("");
    setSortKey(null);
    setPage(0);
  }, [allFields, dataset.id]);

  const sampled = useMemo(
    () => sampleRows(rows, sampleMode, sampleSize, seed),
    [rows, sampleMode, sampleSize, seed],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let out = sampled;
    if (s) {
      out = out.filter((r) =>
        Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(s)),
      );
    }
    for (const [k, v] of Object.entries(colFilters)) {
      if (!v) continue;
      const vl = v.toLowerCase();
      out = out.filter((r) => String(r[k] ?? "").toLowerCase().includes(vl));
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const av = String(a[sortKey] ?? "");
        const bv = String(b[sortKey] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [sampled, search, colFilters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="surface-card p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Search all</label>
            <Input
              placeholder="Search any field…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="bg-background text-foreground h-9"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Sample mode</label>
            <select
              value={sampleMode}
              onChange={(e) => {
                setSampleMode(e.target.value as SampleMode);
                setPage(0);
              }}
              className="w-full h-9 bg-background text-foreground border border-input rounded-md px-2 text-sm"
            >
              <option value="full">Full dataset</option>
              <option value="first">First records</option>
              <option value="latest">Latest records</option>
              <option value="earliest">Earliest records</option>
              <option value="random">Random sample</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Sample size</label>
            <select
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              disabled={sampleMode === "full"}
              className="w-full h-9 bg-background text-foreground border border-input rounded-md px-2 text-sm disabled:opacity-50"
            >
              {[10, 25, 50, 100, 250, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Page size</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="w-full h-9 bg-background text-foreground border border-input rounded-md px-2 text-sm"
            >
              {[25, 50, 100, 250].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {sampleMode === "random" && (
            <Button size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>
              Generate new sample
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearch("");
              setColFilters({});
              setSortKey(null);
              setPage(0);
            }}
          >
            Reset filters
          </Button>
          <Button size="sm" variant="outline" onClick={() => setColChooserOpen((o) => !o)}>
            Columns ({visibleCols.length}/{allFields.length})
          </Button>
          <div className="text-xs text-muted-foreground ml-auto">
            {filtered.length.toLocaleString()} rows after filter · {rows.length.toLocaleString()} total
          </div>
        </div>

        {colChooserOpen && (
          <div className="border border-white/10 rounded-md p-2 bg-white/[0.02] max-h-40 overflow-auto">
            <div className="flex gap-2 mb-1">
              <button
                className="text-[11px] text-primary hover:underline"
                onClick={() => setVisibleCols(allFields)}
              >
                All
              </button>
              <button
                className="text-[11px] text-primary hover:underline"
                onClick={() => setVisibleCols([])}
              >
                None
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
              {allFields.map((c) => (
                <label key={c} className="flex items-center gap-1 text-[11px] text-foreground/80">
                  <input
                    type="checkbox"
                    checked={visibleCols.includes(c)}
                    onChange={(e) =>
                      setVisibleCols((cols) =>
                        e.target.checked ? [...cols, c] : cols.filter((x) => x !== c),
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Downloads */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
          <Button size="sm" variant="outline" onClick={() => downloadOriginal(getSourceFor(dataset).url, dataset.filename)}>
            <Download className="w-3 h-3" /> Source file
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadText(`${dataset.id}_filtered.csv`, rowsToCsv(filtered), "text/csv")}
          >
            <Download className="w-3 h-3" /> Filtered CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadText(`${dataset.id}_filtered.json`, JSON.stringify(filtered, null, 2), "application/json")
            }
          >
            <Download className="w-3 h-3" /> Filtered JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadText(`${dataset.id}_sample.csv`, rowsToCsv(sampled), "text/csv")}
          >
            <Download className="w-3 h-3" /> Sample CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadText(`${dataset.id}_sample.json`, JSON.stringify(sampled, null, 2), "application/json")
            }
          >
            <Download className="w-3 h-3" /> Sample JSON
          </Button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {slice.map((r, i) => {
          const rowNum = safePage * pageSize + i + 1;
          return (
            <button
              key={i}
              onClick={() => setInspected(r)}
              className="surface-card p-3 w-full text-left"
            >
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>#{rowNum}</span>
                <span>Tap for details</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[12px]">
                {visibleCols.slice(0, 6).map((c) => (
                  <div key={c} className="min-w-0">
                    <div className="text-[10px] uppercase text-muted-foreground">{c}</div>
                    <div className="text-card-foreground truncate">{String(r[c] ?? "—")}</div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
        {slice.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No records.</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card overflow-x-auto max-h-[65vh]">
        <table className="text-xs min-w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-black/10">
              <th className="px-2 py-2 text-left font-medium text-card-foreground">#</th>
              {visibleCols.map((c) => (
                <th
                  key={c}
                  className="px-2 py-2 text-left font-medium text-card-foreground whitespace-nowrap cursor-pointer hover:text-primary"
                  onClick={() => toggleSort(c)}
                >
                  <div className="flex items-center gap-1">
                    {c}
                    {sortKey === c && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-black/10 bg-muted/30">
              <th></th>
              {visibleCols.map((c) => (
                <th key={c} className="px-1 py-1">
                  <input
                    value={colFilters[c] ?? ""}
                    onChange={(e) => {
                      setColFilters((f) => ({ ...f, [c]: e.target.value }));
                      setPage(0);
                    }}
                    placeholder="filter…"
                    className="w-full text-[11px] px-1 py-0.5 bg-background border border-input rounded"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={i}
                onClick={() => setInspected(r)}
                className="border-t border-black/5 text-card-foreground hover:bg-muted/40 cursor-pointer"
              >
                <td className="px-2 py-1 text-muted-foreground tabular-nums">
                  {safePage * pageSize + i + 1}
                </td>
                {visibleCols.map((c) => (
                  <td key={c} className="px-2 py-1 whitespace-nowrap max-w-[260px] truncate" title={String(r[c] ?? "")}>
                    {String(r[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 1} className="text-center py-6 text-muted-foreground">
                  No records match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Prev
        </Button>
        <span>
          Page {safePage + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      {inspected && <RecordInspector record={inspected} onClose={() => setInspected(null)} />}
    </div>
  );
}

/* ============================== INSPECTOR ============================== */

function RecordInspector({
  record,
  onClose,
}: {
  record: Record<string, unknown>;
  onClose: () => void;
}) {
  const [view, setView] = useState<"fields" | "json">("fields");
  const json = JSON.stringify(record, null, 2);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center md:justify-center">
      <div className="bg-card text-card-foreground w-full md:max-w-2xl max-h-[85vh] rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-black/10">
          <div className="font-semibold">Record details</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 p-2 border-b border-black/5">
          <button
            onClick={() => setView("fields")}
            className={`px-2 py-1 text-xs rounded ${view === "fields" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Fields
          </button>
          <button
            onClick={() => setView("json")}
            className={`px-2 py-1 text-xs rounded ${view === "json" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Pretty JSON
          </button>
          <button
            onClick={() => copyToClipboard(json)}
            className="ml-auto px-2 py-1 text-xs rounded bg-muted inline-flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> Copy record JSON
          </button>
        </div>
        <div className="overflow-auto p-3">
          {view === "fields" ? (
            <div className="space-y-2">
              {Object.entries(record).map(([k, v]) => {
                const type = inferType(v);
                const empty = isEmpty(v);
                const display = v == null ? "null" : String(v);
                return (
                  <div key={k} className="border border-black/5 rounded-md p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {k}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{type}</span>
                        {empty && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
                            empty
                          </span>
                        )}
                        <button
                          onClick={() => copyToClipboard(display)}
                          className="text-[10px] inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                    </div>
                    <div className="font-mono text-xs break-all mt-1">{display || <em className="text-muted-foreground">—</em>}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="text-xs whitespace-pre-wrap break-all bg-muted/40 rounded p-2">{json}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== SCHEMA ============================== */

function SchemaTab({ rows, dataset }: { rows: Record<string, unknown>[]; dataset: DatasetDef }) {
  const profile = useMemo(() => profileRows(rows), [rows]);

  const csv = useMemo(() => {
    const head = "field,type,non_empty,missing,missing_pct,unique,min,max,avg,median,earliest,latest,example";
    const lines = profile.map((p) =>
      [
        p.field,
        p.type,
        p.nonEmpty,
        p.missing,
        p.missingPct.toFixed(2),
        p.unique,
        p.min ?? "",
        p.max ?? "",
        p.avg?.toFixed(3) ?? "",
        p.median ?? "",
        p.earliest ?? "",
        p.latest ?? "",
        JSON.stringify(p.example),
      ].join(","),
    );
    return [head, ...lines].join("\n");
  }, [profile]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => downloadText(`${dataset.id}_schema.csv`, csv, "text/csv")}>
          <Download className="w-3 h-3" /> Schema CSV
        </Button>
      </div>
      <div className="space-y-2">
        {profile.map((p) => (
          <FieldProfileCard key={p.field} p={p} />
        ))}
        {!profile.length && (
          <div className="text-sm text-muted-foreground text-center py-6">No data loaded.</div>
        )}
      </div>
    </div>
  );
}

function FieldProfileCard({ p }: { p: FieldProfile }) {
  return (
    <div className="surface-card p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-semibold text-card-foreground">{p.field}</div>
        <span className="chip bg-primary/10 text-primary border border-primary/20">{p.type}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Info label="Non-empty" value={p.nonEmpty.toLocaleString()} />
        <Info label="Missing" value={`${p.missing.toLocaleString()} (${p.missingPct.toFixed(1)}%)`} />
        <Info label="Unique" value={p.unique.toLocaleString()} />
        <Info label="Example" value={p.example || "—"} />
        {(p.type === "integer" || p.type === "number") && (
          <>
            <Info label="Min" value={String(p.min ?? "—")} />
            <Info label="Max" value={String(p.max ?? "—")} />
            <Info label="Avg" value={p.avg != null ? p.avg.toFixed(2) : "—"} />
            <Info label="Median" value={p.median != null ? String(p.median) : "—"} />
          </>
        )}
        {p.type === "date" && (
          <>
            <Info label="Earliest" value={p.earliest ? new Date(p.earliest).toLocaleDateString() : "—"} />
            <Info label="Latest" value={p.latest ? new Date(p.latest).toLocaleDateString() : "—"} />
          </>
        )}
      </div>
      {p.top && p.top.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Top values</div>
          <div className="flex flex-wrap gap-1">
            {p.top.map((t) => (
              <span key={t.value} className="chip bg-muted text-card-foreground">
                {t.value} · {t.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== QUALITY ============================== */

function QualityTab({ rows, dataset }: { rows: Record<string, unknown>[]; dataset: DatasetDef }) {
  const q = useMemo(() => qualityReport(rows), [rows]);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadText(`${dataset.id}_quality.json`, JSON.stringify(q, null, 2), "application/json")}
        >
          <Download className="w-3 h-3" /> Quality JSON
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Total rows" value={q.totalRows} />
        <Stat label="Duplicate game IDs" value={q.duplicateGameIds} warn={q.duplicateGameIds > 0} />
        <Stat label="Missing team names" value={q.missingTeamNames} warn={q.missingTeamNames > 0} />
        <Stat label="Missing dates" value={q.missingDates} warn={q.missingDates > 0} />
        <Stat label="Missing scores" value={q.missingScores} />
        <Stat label="Invalid numeric" value={q.invalidNumeric} warn={q.invalidNumeric > 0} />
        <Stat label="Invalid timestamps" value={q.invalidTimestamps} warn={q.invalidTimestamps > 0} />
        <Stat label="Unique teams" value={q.uniqueTeams} />
        <Stat label="Completed" value={q.completed} />
        <Stat label="Scheduled" value={q.scheduled} />
        <Stat label="Live" value={q.live} />
        <Stat label="Seasons" value={q.seasons.join(", ") || "—"} />
      </div>
      <div className="surface-card p-3">
        <div className="text-[11px] uppercase text-muted-foreground mb-1">Date range</div>
        <div className="text-sm">
          {q.dateRange.earliest
            ? `${new Date(q.dateRange.earliest).toLocaleDateString()} → ${new Date(q.dateRange.latest!).toLocaleDateString()}`
            : "—"}
        </div>
      </div>
      <div className="surface-card p-3">
        <div className="text-[11px] uppercase text-muted-foreground mb-2">Status distribution</div>
        <div className="flex flex-wrap gap-1">
          {q.statusDistribution.map((s) => (
            <span key={s.status} className="chip bg-muted text-card-foreground">
              {s.status || "(blank)"} · {s.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`surface-card p-3 ${warn ? "ring-1 ring-amber-500/40" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${warn ? "text-amber-500" : "text-card-foreground"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

/* ============================== JSON ============================== */

function JsonTab({
  data,
  dataset,
  sourceUrl,
}: {
  data: unknown;
  dataset: DatasetDef;
  sourceUrl: string;
}) {
  if (data == null) {
    return <div className="surface-card p-4 text-sm text-muted-foreground">No JSON data loaded.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => downloadOriginal(sourceUrl, dataset.filename)}>
          <Download className="w-3 h-3" /> Source file
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadText(`${dataset.id}.json`, JSON.stringify(data, null, 2), "application/json")
          }
        >
          <Download className="w-3 h-3" /> Parsed JSON
        </Button>
      </div>
      <JsonTree data={data} />
    </div>
  );
}

/* ============================== LINEAGE ============================== */

function LineageTab({ dataset, rows }: { dataset: DatasetDef; rows: Record<string, unknown>[] }) {
  const { results } = useData();
  const r = results[dataset.sourceKey];
  const source = getSourceFor(dataset);
  return (
    <div className="space-y-3">
      <div className="surface-card p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Source lineage</div>
        <ol className="space-y-2 text-sm">
          <Step n={1} title="Upstream sports API / scoreboard" desc="Public live and historical sports feeds (ESPN / API-Sports). Not reached from this site." />
          <Step n={2} title="GitHub Actions" desc="Scheduled workflows in the LindaData repository fetch, normalize, and publish snapshots." />
          <Step n={3} title="Public GitHub CSV / JSON" desc="Static files committed to the repo and served via raw.githubusercontent.com." />
          <Step n={4} title="LindaData Sports Hub (this site)" desc="Static Vite app fetches files directly in the browser. No backend." />
        </ol>
      </div>

      <div className="surface-card p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Info label="File type" value={dataset.kind.toUpperCase()} />
          <Info label="Filename" value={dataset.filename} />
          <Info label="Row count" value={r ? r.rows.toLocaleString() : "—"} />
          <Info label="Origin" value={r?.origin ?? "—"} />
          <Info label="Fallback used" value={r?.origin === "fallback" ? "Yes" : "No"} />
          <Info label="Cache used" value={r?.origin === "cache" ? "Yes" : "No"} />
          <Info label="Last refresh" value={r ? new Date(r.fetchedAt).toLocaleString() : "—"} />
          <Info label="Loaded rows in memory" value={rows.length.toLocaleString()} />
        </div>
        <div className="pt-2 border-t border-white/5 space-y-1">
          <a
            href={r?.url ?? source.url}
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] text-primary break-all hover:underline"
          >
            Source URL: {r?.url ?? source.url}
          </a>
          {source.fallbackUrl && (
            <a
              href={source.fallbackUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-[11px] text-primary break-all hover:underline"
            >
              Fallback URL: {source.fallbackUrl}
            </a>
          )}
          <a
            href="https://github.com/LindaData/world-cup-2026-betting-model"
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] text-primary hover:underline"
          >
            Repository: LindaData/world-cup-2026-betting-model
          </a>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="w-6 h-6 flex-shrink-0 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
        {n}
      </div>
      <div>
        <div className="font-medium text-card-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </li>
  );
}
