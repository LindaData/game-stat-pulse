import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCatalog, type CatalogEntry } from "@/lib/catalog";
import { downloadCsv, streamCsvSample } from "@/lib/download";

const STORAGE_KEY = "gsp:data-approval:v1";
const SAMPLE_LIMIT = 25;

type Decision = "pending" | "approved" | "changes_requested";
type Review = { decision: Decision; notes: string; reviewed_at_utc: string | null };
type SchemaColumn = { name: string; type: string };
type Preview = {
  columns: string[];
  rows: Record<string, unknown>[];
  schema: SchemaColumn[];
  raw: unknown;
};

const EMPTY: Preview = { columns: [], rows: [], schema: [], raw: null };

export default function Approval() {
  const [params, setParams] = useSearchParams();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [selectedId, setSelectedId] = useState(params.get("dataset") ?? "");
  const [reviews, setReviews] = useState<Record<string, Review>>(readReviews);
  const [preview, setPreview] = useState<Preview>(EMPTY);
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [decision, setDecision] = useState<Decision | "all">("all");
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogMeta, setCatalogMeta] = useState("");
  const [tab, setTab] = useState<"data" | "schema" | "raw">("data");

  const refresh = async () => {
    setLoading(true);
    setCatalogError(null);
    try {
      const catalog = await loadCatalog(true);
      setEntries(catalog.entries);
      setCatalogMeta(`${catalog.source} · ${formatDate(catalog.generated_at_utc)}`);
      setSelectedId((current) =>
        catalog.entries.some((entry) => entry.dataset_id === current)
          ? current
          : catalog.entries[0]?.dataset_id ?? "",
      );
    } catch (cause) {
      setCatalogError((cause as Error).message || "The dataset catalog could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    } catch {
      // Approval still works for this session when browser storage is unavailable.
    }
  }, [reviews]);

  useEffect(() => {
    if (!selectedId) return;
    setParams({ dataset: selectedId }, { replace: true });
    const entry = entries.find((item) => item.dataset_id === selectedId);
    if (entry) void fetchPreview(entry, setPreview, setLoadingPreview, setError);
  }, [selectedId, entries, setParams]);

  const selected = entries.find((entry) => entry.dataset_id === selectedId) ?? null;
  const currentReview = selected ? reviews[selected.dataset_id] ?? blankReview() : blankReview();
  const sports = ["all", ...Array.from(new Set(entries.map((entry) => entry.sport))).sort()];

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const text = `${entry.display_name} ${entry.dataset_id} ${entry.source_endpoint ?? ""}`.toLowerCase();
        const review = reviews[entry.dataset_id] ?? blankReview();
        return (
          (!query || text.includes(query.toLowerCase())) &&
          (sport === "all" || entry.sport === sport) &&
          (decision === "all" || review.decision === decision)
        );
      }),
    [entries, reviews, query, sport, decision],
  );

  const counts = useMemo(
    () => ({
      total: entries.length,
      pending: entries.filter(
        (entry) => (reviews[entry.dataset_id]?.decision ?? "pending") === "pending",
      ).length,
      approved: entries.filter((entry) => reviews[entry.dataset_id]?.decision === "approved").length,
      changes: entries.filter(
        (entry) => reviews[entry.dataset_id]?.decision === "changes_requested",
      ).length,
    }),
    [entries, reviews],
  );

  const reviewedCount = counts.approved + counts.changes;
  const progress = counts.total ? Math.round((reviewedCount / counts.total) * 100) : 0;

  const updateReview = (patch: Partial<Review>) => {
    if (!selected) return;
    setReviews((all) => ({
      ...all,
      [selected.dataset_id]: {
        ...(all[selected.dataset_id] ?? blankReview()),
        ...patch,
      },
    }));
  };

  const chooseNextPending = () => {
    if (!selected) return;
    const next = entries.find(
      (entry) =>
        entry.dataset_id !== selected.dataset_id &&
        (reviews[entry.dataset_id]?.decision ?? "pending") === "pending",
    );
    if (next) {
      setSelectedId(next.dataset_id);
      setTab("data");
    }
  };

  const setReviewDecision = (next: Decision, moveNext = false) => {
    updateReview({
      decision: next,
      reviewed_at_utc: next === "pending" ? null : new Date().toISOString(),
    });
    if (moveNext && next !== "pending") chooseNextPending();
  };

  const exportDecisions = () =>
    downloadCsv(
      "game_stat_pulse_data_approvals.csv",
      entries.map((entry) => {
        const review = reviews[entry.dataset_id] ?? blankReview();
        return {
          dataset_id: entry.dataset_id,
          dataset_name: entry.display_name,
          sport: entry.sport,
          entity: entry.entity,
          source_endpoint: entry.source_endpoint,
          row_count: entry.row_count ?? "",
          column_count: entry.column_count ?? "",
          availability_status: entry.availability_status,
          decision: review.decision,
          notes: review.notes,
          reviewed_at_utc: review.reviewed_at_utc ?? "",
        };
      }),
    );

  return (
    <div className="space-y-5">
      <header className="surface-card p-5 md:p-6 bg-gradient-to-br from-[hsl(var(--navy-light))] to-[hsl(var(--navy-deep))] border-white/10">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary mb-2">
              Approval workspace
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Review football data before modeling</h1>
            <p className="text-sm text-foreground/70 mt-2 max-w-3xl">
              Review every discovered column using a maximum of {SAMPLE_LIMIT} sample rows.
            </p>
            <p className="text-[11px] text-muted-foreground mt-3">
              Catalog: {catalogMeta || "loading"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" onClick={exportDecisions} disabled={!entries.length}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>{reviewedCount} of {counts.total} reviewed</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      {catalogError && (
        <div className="surface-card p-4 text-sm text-amber-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {catalogError}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Datasets" value={counts.total} />
        <Metric label="Pending" value={counts.pending} />
        <Metric label="Approved" value={counts.approved} />
        <Metric label="Changes" value={counts.changes} />
      </section>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
        <aside className="surface-card p-3 lg:sticky lg:top-20 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search datasets"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className="min-h-[42px] rounded-md border border-input bg-background px-2 text-sm"
            >
              {sports.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All sports" : value}
                </option>
              ))}
            </select>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value as Decision | "all")}
              className="min-h-[42px] rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All decisions</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes</option>
            </select>
          </div>
          <div className="max-h-[62vh] overflow-auto space-y-2 pr-1">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground flex gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : filtered.length ? (
              filtered.map((entry) => {
                const review = reviews[entry.dataset_id] ?? blankReview();
                return (
                  <button
                    key={entry.dataset_id}
                    onClick={() => setSelectedId(entry.dataset_id)}
                    className={`w-full rounded-lg border p-3 text-left ${
                      selectedId === entry.dataset_id
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-sm">{entry.display_name}</span>
                      <DecisionIcon decision={review.decision} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                      {entry.entity} · {entry.source_endpoint}
                    </div>
                    <div className="flex justify-between gap-2 text-[10px] text-muted-foreground mt-2">
                      <span>{entry.column_count ?? "?"} columns · {entry.row_count ?? "?"} rows</span>
                      <AvailabilityBadge status={entry.availability_status} />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No datasets match these filters.</div>
            )}
          </div>
        </aside>

        {!selected ? (
          <div className="surface-card p-8 text-sm text-muted-foreground">Select a dataset.</div>
        ) : (
          <div className="space-y-4 min-w-0">
            <section className="surface-card p-4 md:p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{selected.display_name}</h2>
                    <DecisionBadge decision={currentReview.decision} />
                    <AvailabilityBadge status={selected.availability_status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selected.source_endpoint} · {preview.columns.length} visible columns · {preview.rows.length} sample rows
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setReviewDecision("approved", true)}>
                    <CheckCircle2 className="w-4 h-4" /> Approve & next
                  </Button>
                  <Button variant="destructive" onClick={() => setReviewDecision("changes_requested", true)}>
                    <XCircle className="w-4 h-4" /> Changes & next
                  </Button>
                  <Button variant="outline" onClick={() => setReviewDecision("pending")}>
                    Reset
                  </Button>
                </div>
              </div>
              <textarea
                value={currentReview.notes}
                onChange={(event) => updateReview({ notes: event.target.value })}
                placeholder="Notes: missing fields, incorrect values, naming changes, or approval reason."
                className="mt-4 w-full min-h-24 rounded-md border border-input bg-background p-3 text-sm"
              />
              {counts.pending > 0 && currentReview.decision !== "pending" && (
                <button
                  onClick={chooseNextPending}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Go to next pending dataset <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </section>

            <section className="surface-card overflow-hidden">
              <div className="flex flex-wrap justify-between gap-2 p-3 border-b border-white/10">
                <div className="flex gap-1">
                  {(["data", "schema", "raw"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`min-h-[40px] px-3 rounded-md text-sm font-medium ${
                        tab === key ? "bg-primary text-primary-foreground" : "bg-white/5"
                      }`}
                    >
                      {key === "data" ? "Data sample" : key === "schema" ? "Schema" : "Raw JSON"}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  All {preview.columns.length} columns · maximum {SAMPLE_LIMIT} rows
                </div>
              </div>
              {loadingPreview ? (
                <div className="p-8 text-sm text-muted-foreground flex gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading preview…
                </div>
              ) : error ? (
                <div className="p-6 text-sm text-amber-300 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              ) : tab === "data" ? (
                <DataTable preview={preview} />
              ) : tab === "schema" ? (
                <SchemaTable preview={preview} />
              ) : (
                <pre className="max-h-[65vh] overflow-auto p-4 text-xs bg-black/20">
                  {preview.raw
                    ? JSON.stringify(preview.raw, null, 2)
                    : "Raw JSON is intentionally not published on the public review site."}
                </pre>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchPreview(
  entry: CatalogEntry,
  setPreview: (value: Preview) => void,
  setLoading: (value: boolean) => void,
  setError: (value: string | null) => void,
) {
  setLoading(true);
  setError(null);
  setPreview(EMPTY);
  try {
    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];
    let raw: unknown = null;
    let schema: SchemaColumn[] = [];

    if (entry.sample_csv_url) {
      const sample = await streamCsvSample(entry.sample_csv_url, SAMPLE_LIMIT);
      rows = sample.rows;
      columns = sample.headers;
    }
    if (entry.raw_json_url) {
      const response = await fetch(bust(entry.raw_json_url), { cache: "no-store" });
      if (response.ok) raw = await response.json();
    }
    if (!rows.length && raw) {
      rows = extractRows(raw).slice(0, SAMPLE_LIMIT).map((row) => flatten(row));
      columns = unionColumns(rows);
    }
    if (entry.schema_url) {
      const response = await fetch(bust(entry.schema_url), { cache: "no-store" });
      if (response.ok) {
        schema = ((await response.json()) as { columns?: SchemaColumn[] }).columns ?? [];
      }
    }
    if (!columns.length) columns = schema.map((column) => column.name);
    if (!schema.length) schema = columns.map((name) => ({ name, type: inferType(rows, name) }));
    if (!columns.length) {
      throw new Error(
        entry.availability_status === "missing"
          ? "This endpoint did not return a review sample. Check its API access or parameters."
          : "No review sample is available for this dataset yet.",
      );
    }
    setPreview({ columns, rows, schema, raw });
  } catch (cause) {
    setError((cause as Error).message);
  } finally {
    setLoading(false);
  }
}

function DataTable({ preview }: { preview: Preview }) {
  if (!preview.columns.length) {
    return <div className="p-8 text-sm text-muted-foreground">No sampled columns available.</div>;
  }
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="min-w-max w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr>
            <th className="sticky left-0 bg-card p-2 z-20">#</th>
            {preview.columns.map((column) => (
              <th key={column} className="p-2 text-left whitespace-nowrap">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, index) => (
            <tr key={index} className="border-t border-white/5">
              <td className="sticky left-0 bg-card p-2 text-muted-foreground">{index + 1}</td>
              {preview.columns.map((column) => {
                const value = cell(row[column]);
                return (
                  <td key={column} className="p-2 max-w-[320px] whitespace-nowrap">
                    <span className="block max-w-[320px] truncate" title={value}>
                      {value || "—"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaTable({ preview }: { preview: Preview }) {
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr>
            <th className="p-3 text-left">#</th>
            <th className="p-3 text-left">Field</th>
            <th className="p-3 text-left">Type</th>
          </tr>
        </thead>
        <tbody>
          {preview.schema.map((column, index) => (
            <tr key={`${column.name}-${index}`} className="border-t border-white/5">
              <td className="p-3 text-muted-foreground">{index + 1}</td>
              <td className="p-3 font-mono text-xs">{column.name}</td>
              <td className="p-3 text-muted-foreground">{column.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function DecisionIcon({ decision }: { decision: Decision }) {
  return decision === "approved" ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
  ) : decision === "changes_requested" ? (
    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
  ) : (
    <span className="w-4 h-4 rounded-full border border-muted-foreground shrink-0" />
  );
}

function DecisionBadge({ decision }: { decision: Decision }) {
  const label = decision === "approved" ? "Approved" : decision === "changes_requested" ? "Changes requested" : "Pending";
  const style = decision === "approved"
    ? "bg-emerald-500/15 text-emerald-300"
    : decision === "changes_requested"
      ? "bg-red-500/15 text-red-300"
      : "bg-white/10 text-muted-foreground";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${style}`}>{label}</span>;
}

function AvailabilityBadge({ status }: { status: CatalogEntry["availability_status"] }) {
  const style = status === "available"
    ? "text-emerald-300"
    : status === "degraded"
      ? "text-amber-300"
      : "text-red-300";
  return <span className={`capitalize ${style}`}>{status}</span>;
}

function blankReview(): Review {
  return { decision: "pending", notes: "", reviewed_at_utc: null };
}

function readReviews(): Record<string, Review> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function bust(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (!isRecord(raw)) return [];
  const response = raw.response;
  return Array.isArray(response)
    ? response.filter(isRecord)
    : isRecord(response)
      ? [response]
      : [raw];
}

function flatten(
  record: Record<string, unknown>,
  prefix = "",
  output: Record<string, unknown> = {},
) {
  Object.entries(record).forEach(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value)) flatten(value, name, output);
    else output[name] = Array.isArray(value) ? JSON.stringify(value) : value;
  });
  return output;
}

function unionColumns(rows: Record<string, unknown>[]) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
}

function inferType(rows: Record<string, unknown>[], column: string) {
  const value = rows.map((row) => row[column]).find((item) => item != null && item !== "");
  return value == null ? "unknown" : typeof value;
}

function cell(value: unknown) {
  return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
}
