import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Table2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCatalog, type CatalogEntry } from "@/lib/catalog";
import { downloadCsv, streamCsvSample } from "@/lib/download";

const REVIEW_STORAGE_KEY = "gsp:data-approval:v1";
const SAMPLE_LIMIT = 25;

type Decision = "pending" | "approved" | "changes_requested";

type ReviewRecord = {
  dataset_id: string;
  decision: Decision;
  notes: string;
  reviewed_at_utc: string | null;
};

type SchemaColumn = {
  name: string;
  type: string;
};

type PreviewState = {
  columns: string[];
  rows: Record<string, unknown>[];
  schema: SchemaColumn[];
  raw: unknown;
  source: "csv" | "json" | "none";
};

const EMPTY_PREVIEW: PreviewState = {
  columns: [],
  rows: [],
  schema: [],
  raw: null,
  source: "none",
};

export default function Approval() {
  const [params, setParams] = useSearchParams();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [catalogSource, setCatalogSource] = useState("");
  const [catalogGeneratedAt, setCatalogGeneratedAt] = useState("");
  const [selectedId, setSelectedId] = useState(params.get("dataset") ?? "");
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "all">("all");
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>(() => loadReviews());
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tab, setTab] = useState<"data" | "schema" | "raw">("data");

  const refreshCatalog = async () => {
    setLoadingCatalog(true);
    const catalog = await loadCatalog(true);
    setEntries(catalog.entries);
    setCatalogSource(catalog.source);
    setCatalogGeneratedAt(catalog.generated_at_utc);
    setLoadingCatalog(false);
    if (!selectedId && catalog.entries.length) setSelectedId(catalog.entries[0].dataset_id);
  };

  useEffect(() => {
    void refreshCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId && entries.length) setSelectedId(entries[0].dataset_id);
  }, [entries, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setParams({ dataset: selectedId }, { replace: true });
    const entry = entries.find((item) => item.dataset_id === selectedId);
    if (entry) void loadPreview(entry, setPreview, setLoadingPreview, setPreviewError);
  }, [selectedId, entries, setParams]);

  useEffect(() => {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
  }, [reviews]);

  const selected = entries.find((entry) => entry.dataset_id === selectedId) ?? null;
  const sports = useMemo(
    () => ["all", ...Array.from(new Set(entries.map((entry) => entry.sport))).sort()],
    [entries],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const review = reviews[entry.dataset_id] ?? emptyReview(entry.dataset_id);
      const matchesSearch =
        !query ||
        entry.display_name.toLowerCase().includes(query) ||
        entry.dataset_id.toLowerCase().includes(query) ||
        (entry.source_endpoint ?? "").toLowerCase().includes(query);
      return (
        matchesSearch &&
        (sport === "all" || entry.sport === sport) &&
        (decisionFilter === "all" || review.decision === decisionFilter)
      );
    });
  }, [entries, reviews, search, sport, decisionFilter]);

  const counts = useMemo(() => {
    const allReviews = entries.map((entry) => reviews[entry.dataset_id]?.decision ?? "pending");
    return {
      total: entries.length,
      available: entries.filter((entry) => entry.availability_status === "available").length,
      approved: allReviews.filter((decision) => decision === "approved").length,
      changes: allReviews.filter((decision) => decision === "changes_requested").length,
      pending: allReviews.filter((decision) => decision === "pending").length,
    };
  }, [entries, reviews]);

  const currentReview = selected ? reviews[selected.dataset_id] ?? emptyReview(selected.dataset_id) : null;

  const saveDecision = (decision: Decision) => {
    if (!selected || !currentReview) return;
    setReviews((current) => ({
      ...current,
      [selected.dataset_id]: {
        ...currentReview,
        decision,
        reviewed_at_utc: decision === "pending" ? null : new Date().toISOString(),
      },
    }));
  };

  const saveNotes = (notes: string) => {
    if (!selected || !currentReview) return;
    setReviews((current) => ({
      ...current,
      [selected.dataset_id]: { ...currentReview, notes },
    }));
  };

  const exportReviews = () => {
    const rows = entries.map((entry) => {
      const review = reviews[entry.dataset_id] ?? emptyReview(entry.dataset_id);
      return {
        dataset_id: entry.dataset_id,
        dataset_name: entry.display_name,
        sport: entry.sport,
        entity: entry.entity,
        source_endpoint: entry.source_endpoint,
        availability_status: entry.availability_status,
        row_count: entry.row_count ?? "",
        column_count: entry.column_count ?? "",
        decision: review.decision,
        notes: review.notes,
        reviewed_at_utc: review.reviewed_at_utc ?? "",
      };
    });
    downloadCsv("game_stat_pulse_data_approvals.csv", rows);
  };

  return (
    <div className="space-y-5">
      <header className="surface-card p-5 md:p-6 bg-gradient-to-br from-[hsl(var(--navy-light))] to-[hsl(var(--navy-deep))] border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary mb-2">Approval workspace</div>
            <h1 className="text-2xl md:text-3xl font-bold">Review API-Football data before modeling</h1>
            <p className="text-sm text-foreground/70 mt-2 max-w-3xl">
              Review a limited row sample while keeping every discovered column visible. Approve the schema, request
              changes, and export the decision log before any predictive model work begins.
            </p>
            <p className="text-[11px] text-muted-foreground mt-3">
              Catalog: {catalogSource || "loading"}
              {catalogGeneratedAt ? ` · generated ${new Date(catalogGeneratedAt).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void refreshCatalog()} disabled={loadingCatalog}>
              <RefreshCw className={`w-4 h-4 ${loadingCatalog ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={exportReviews} disabled={!entries.length}>
              <Download className="w-4 h-4" /> Export decisions
            </Button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-label="Approval status">
        <Metric label="Datasets" value={counts.total} />
        <Metric label="Available" value={counts.available} />
        <Metric label="Pending" value={counts.pending} />
        <Metric label="Approved" value={counts.approved} />
        <Metric label="Changes requested" value={counts.changes} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
        <aside className="surface-card p-3 lg:sticky lg:top-20 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search datasets or endpoints"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className="min-h-[42px] rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Filter by sport"
            >
              {sports.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All sports" : value}
                </option>
              ))}
            </select>
            <select
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value as Decision | "all")}
              className="min-h-[42px] rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Filter by review decision"
            >
              <option value="all">All decisions</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes</option>
            </select>
          </div>

          <div className="max-h-[62vh] overflow-auto space-y-2 pr-1" aria-label="Dataset review queue">
            {loadingCatalog ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No datasets match the filters.</div>
            ) : (
              filtered.map((entry) => {
                const review = reviews[entry.dataset_id] ?? emptyReview(entry.dataset_id);
                return (
                  <button
                    key={entry.dataset_id}
                    onClick={() => setSelectedId(entry.dataset_id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedId === entry.dataset_id
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm leading-tight">{entry.display_name}</div>
                      <DecisionIcon decision={review.decision} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground truncate">
                      {entry.sport} · {entry.entity} · {entry.source_endpoint}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <AvailabilityBadge status={entry.availability_status} />
                      <span className="text-muted-foreground">
                        {entry.column_count ?? "?"} cols · {entry.row_count ?? "?"} rows
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {!selected ? (
            <div className="surface-card p-8 text-sm text-muted-foreground">Select a dataset to begin review.</div>
          ) : (
            <div className="space-y-4">
              <section className="surface-card p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold">{selected.display_name}</h2>
                      <AvailabilityBadge status={selected.availability_status} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                    <dl className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <Detail label="Endpoint" value={selected.source_endpoint} />
                      <Detail label="Entity" value={selected.entity} />
                      <Detail label="Sample rows" value={String(preview.rows.length)} />
                      <Detail label="Visible columns" value={String(preview.columns.length)} />
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => saveDecision("approved")}
                      className={currentReview?.decision === "approved" ? "ring-2 ring-emerald-300" : ""}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => saveDecision("changes_requested")}
                      className={currentReview?.decision === "changes_requested" ? "ring-2 ring-red-300" : ""}
                    >
                      <XCircle className="w-4 h-4" /> Request changes
                    </Button>
                    <Button variant="outline" onClick={() => saveDecision("pending")}>
                      Reset
                    </Button>
                  </div>
                </div>

                <label className="block mt-4">
                  <span className="text-xs font-medium">Reviewer notes</span>
                  <textarea
                    value={currentReview?.notes ?? ""}
                    onChange={(event) => saveNotes(event.target.value)}
                    placeholder="Document missing fields, incorrect values, naming changes, or approval rationale."
                    className="mt-1 w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </section>

              <section className="surface-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
                  <div className="flex gap-1">
                    <TabButton active={tab === "data"} onClick={() => setTab("data")} icon={<Table2 className="w-4 h-4" />}>
                      Data sample
                    </TabButton>
                    <TabButton active={tab === "schema"} onClick={() => setTab("schema")} icon={<FileSpreadsheet className="w-4 h-4" />}>
                      Schema
                    </TabButton>
                    <TabButton active={tab === "raw"} onClick={() => setTab("raw")} icon={<Braces className="w-4 h-4" />}>
                      Raw JSON
                    </TabButton>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Review scope: all {preview.columns.length} discovered columns · maximum {SAMPLE_LIMIT} rows
                  </div>
                </div>

                {loadingPreview ? (
                  <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading sample and schema…
                  </div>
                ) : previewError ? (
                  <div className="p-6 text-sm text-amber-300 flex gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Preview unavailable</div>
                      <div className="text-muted-foreground mt-1">{previewError}</div>
                    </div>
                  </div>
                ) : tab === "data" ? (
                  <DataTable preview={preview} />
                ) : tab === "schema" ? (
                  <SchemaTable preview={preview} />
                ) : (
                  <RawPanel raw={preview.raw} />
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

async function loadPreview(
  entry: CatalogEntry,
  setPreview: (preview: PreviewState) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
) {
  setLoading(true);
  setError(null);
  setPreview(EMPTY_PREVIEW);
  try {
    let columns: string[] = [];
    let rows: Record<string, unknown>[] = [];
    let raw: unknown = null;
    let source: PreviewState["source"] = "none";

    if (entry.sample_csv_url) {
      const sample = await streamCsvSample(entry.sample_csv_url, SAMPLE_LIMIT);
      columns = sample.headers;
      rows = sample.rows;
      source = "csv";
    } else if (entry.raw_json_url) {
      const response = await fetch(cacheBust(entry.raw_json_url), { cache: "no-store" });
      if (!response.ok) throw new Error(`Raw data returned HTTP ${response.status}`);
      raw = await response.json();
      rows = extractRows(raw).slice(0, SAMPLE_LIMIT).map(flattenRecord);
      columns = unionColumns(rows);
      source = "json";
    }

    let schema: SchemaColumn[] = [];
    if (entry.schema_url) {
      try {
        const response = await fetch(cacheBust(entry.schema_url), { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { columns?: SchemaColumn[] };
          schema = Array.isArray(data.columns) ? data.columns : [];
        }
      } catch {
        // Infer schema from the preview when published schema metadata is unavailable.
      }
    }

    if (!raw && entry.raw_json_url) {
      try {
        const response = await fetch(cacheBust(entry.raw_json_url), { cache: "no-store" });
        if (response.ok) raw = await response.json();
      } catch {
        // The CSV and schema remain usable even when raw JSON is unavailable.
      }
    }

    if (!columns.length && schema.length) columns = schema.map((column) => column.name);
    if (!schema.length) schema = columns.map((name) => ({ name, type: inferType(rows, name) }));
    if (!columns.length && rows.length) columns = unionColumns(rows);

    setPreview({ columns, rows, schema, raw, source });
  } catch (error) {
    setError((error as Error).message);
  } finally {
    setLoading(false);
  }
}

function DataTable({ preview }: { preview: PreviewState }) {
  if (!preview.columns.length) {
    return <div className="p-8 text-sm text-muted-foreground">No sampled columns are available for this endpoint.</div>;
  }
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="min-w-max w-full text-xs">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-white/10">
            <th className="sticky left-0 z-20 bg-card px-3 py-2 text-left font-medium">#</th>
            {preview.columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-white/5 hover:bg-white/[0.03]">
              <td className="sticky left-0 bg-card px-3 py-2 text-muted-foreground tabular-nums">{rowIndex + 1}</td>
              {preview.columns.map((column) => (
                <td key={column} className="max-w-[320px] px-3 py-2 align-top whitespace-nowrap" title={formatCell(row[column])}>
                  <span className="block max-w-[320px] truncate">{formatCell(row[column]) || "—"}</span>
                </td>
              ))}
            </tr>
          ))}
          {!preview.rows.length && (
            <tr>
              <td colSpan={preview.columns.length + 1} className="p-8 text-center text-muted-foreground">
                The endpoint returned a schema but no sample rows.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SchemaTable({ preview }: { preview: PreviewState }) {
  if (!preview.schema.length) {
    return <div className="p-8 text-sm text-muted-foreground">No schema metadata is available.</div>;
  }
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-white/10">
            <th className="p-3 text-left font-medium">Position</th>
            <th className="p-3 text-left font-medium">Field</th>
            <th className="p-3 text-left font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          {preview.schema.map((column, index) => (
            <tr key={`${column.name}-${index}`} className="border-t border-white/5">
              <td className="p-3 text-muted-foreground tabular-nums">{index + 1}</td>
              <td className="p-3 font-mono text-xs">{column.name}</td>
              <td className="p-3 text-muted-foreground">{column.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawPanel({ raw }: { raw: unknown }) {
  if (raw == null) {
    return <div className="p-8 text-sm text-muted-foreground">Raw JSON is not published for this dataset.</div>;
  }
  return (
    <pre className="max-h-[65vh] overflow-auto p-4 text-xs leading-relaxed bg-black/20">
      {JSON.stringify(raw, null, 2)}
    </pre>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium truncate" title={value}>{value || "—"}</dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[40px] px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 ${
        active ? "bg-primary text-primary-foreground" : "bg-white/5 text-foreground/80 hover:bg-white/10"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function DecisionIcon({ decision }: { decision: Decision }) {
  if (decision === "approved") return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (decision === "changes_requested") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return <span className="w-4 h-4 rounded-full border border-muted-foreground flex-shrink-0" aria-label="Pending" />;
}

function AvailabilityBadge({ status }: { status: CatalogEntry["availability_status"] }) {
  const styles = {
    available: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    degraded: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    missing: "bg-red-500/15 text-red-300 border-red-500/30",
  } as const;
  return <span className={`chip border ${styles[status]}`}>{status}</span>;
}

function loadReviews(): Record<string, ReviewRecord> {
  try {
    const stored = localStorage.getItem(REVIEW_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, ReviewRecord>) : {};
  } catch {
    return {};
  }
}

function emptyReview(datasetId: string): ReviewRecord {
  return { dataset_id: datasetId, decision: "pending", notes: "", reviewed_at_utc: null };
}

function cacheBust(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (!isRecord(raw)) return [];
  const response = raw.response;
  if (Array.isArray(response)) return response.filter(isRecord);
  if (isRecord(response)) return [response];
  const events = raw.events;
  if (Array.isArray(events)) return events.filter(isRecord);
  return [raw];
}

function flattenRecord(record: Record<string, unknown>, prefix = "", output: Record<string, unknown> = {}) {
  for (const [key, value] of Object.entries(record)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value)) flattenRecord(value, name, output);
    else if (Array.isArray(value)) output[name] = JSON.stringify(value);
    else output[name] = value;
  }
  return output;
}

function unionColumns(rows: Record<string, unknown>[]) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
}

function inferType(rows: Record<string, unknown>[], column: string) {
  const value = rows.map((row) => row[column]).find((candidate) => candidate != null && candidate !== "");
  if (value == null) return "unknown";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
