import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCatalog, type CatalogEntry } from "@/lib/catalog";
import { downloadCsv, streamCsvSample } from "@/lib/download";

const STORAGE_KEY = "gsp:data-approval:v1";
const SAMPLE_LIMIT = 25;
type Decision = "pending" | "approved" | "changes_requested";
type Review = { decision: Decision; notes: string; reviewed_at_utc: string | null };
type SchemaColumn = { name: string; type: string };
type Preview = { columns: string[]; rows: Record<string, unknown>[]; schema: SchemaColumn[]; raw: unknown };
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
  const [catalogMeta, setCatalogMeta] = useState("");
  const [tab, setTab] = useState<"data" | "schema" | "raw">("data");

  const refresh = async () => {
    setLoading(true);
    const catalog = await loadCatalog(true);
    setEntries(catalog.entries);
    setCatalogMeta(`${catalog.source} · ${new Date(catalog.generated_at_utc).toLocaleString()}`);
    setSelectedId((current) => current || catalog.entries[0]?.dataset_id || "");
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => {
    if (!selectedId) return;
    setParams({ dataset: selectedId }, { replace: true });
    const entry = entries.find((item) => item.dataset_id === selectedId);
    if (entry) void fetchPreview(entry, setPreview, setLoadingPreview, setError);
  }, [selectedId, entries, setParams]);

  const selected = entries.find((entry) => entry.dataset_id === selectedId) ?? null;
  const currentReview = selected ? reviews[selected.dataset_id] ?? blankReview() : blankReview();
  const sports = ["all", ...Array.from(new Set(entries.map((entry) => entry.sport))).sort()];
  const filtered = useMemo(() => entries.filter((entry) => {
    const text = `${entry.display_name} ${entry.dataset_id} ${entry.source_endpoint ?? ""}`.toLowerCase();
    const review = reviews[entry.dataset_id] ?? blankReview();
    return (!query || text.includes(query.toLowerCase())) &&
      (sport === "all" || entry.sport === sport) &&
      (decision === "all" || review.decision === decision);
  }), [entries, reviews, query, sport, decision]);

  const counts = useMemo(() => ({
    total: entries.length,
    pending: entries.filter((entry) => (reviews[entry.dataset_id]?.decision ?? "pending") === "pending").length,
    approved: entries.filter((entry) => reviews[entry.dataset_id]?.decision === "approved").length,
    changes: entries.filter((entry) => reviews[entry.dataset_id]?.decision === "changes_requested").length,
  }), [entries, reviews]);

  const updateReview = (patch: Partial<Review>) => {
    if (!selected) return;
    setReviews((all) => ({ ...all, [selected.dataset_id]: { ...currentReview, ...patch } }));
  };

  const setReviewDecision = (next: Decision) => updateReview({
    decision: next,
    reviewed_at_utc: next === "pending" ? null : new Date().toISOString(),
  });

  const exportDecisions = () => downloadCsv("game_stat_pulse_data_approvals.csv", entries.map((entry) => {
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
  }));

  return <div className="space-y-5">
    <header className="surface-card p-5 md:p-6 bg-gradient-to-br from-[hsl(var(--navy-light))] to-[hsl(var(--navy-deep))] border-white/10">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-primary mb-2">Approval workspace</div>
          <h1 className="text-2xl md:text-3xl font-bold">Review API-Football data before modeling</h1>
          <p className="text-sm text-foreground/70 mt-2 max-w-3xl">Every discovered column is visible. Rows are intentionally limited to a representative sample until the data structure is approved.</p>
          <p className="text-[11px] text-muted-foreground mt-3">Catalog: {catalogMeta || "loading"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          <Button variant="outline" onClick={exportDecisions} disabled={!entries.length}><Download className="w-4 h-4" /> Export decisions</Button>
        </div>
      </div>
    </header>

    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Metric label="Datasets" value={counts.total} />
      <Metric label="Pending" value={counts.pending} />
      <Metric label="Approved" value={counts.approved} />
      <Metric label="Changes requested" value={counts.changes} />
    </section>

    <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
      <aside className="surface-card p-3 lg:sticky lg:top-20 space-y-3">
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search datasets" className="pl-9" /></div>
        <div className="grid grid-cols-2 gap-2">
          <select value={sport} onChange={(event) => setSport(event.target.value)} className="min-h-[42px] rounded-md border border-input bg-background px-2 text-sm">
            {sports.map((value) => <option key={value} value={value}>{value === "all" ? "All sports" : value}</option>)}
          </select>
          <select value={decision} onChange={(event) => setDecision(event.target.value as Decision | "all")} className="min-h-[42px] rounded-md border border-input bg-background px-2 text-sm">
            <option value="all">All decisions</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="changes_requested">Changes</option>
          </select>
        </div>
        <div className="max-h-[62vh] overflow-auto space-y-2 pr-1">
          {loading ? <div className="p-4 text-sm text-muted-foreground flex gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div> : filtered.map((entry) => {
            const review = reviews[entry.dataset_id] ?? blankReview();
            return <button key={entry.dataset_id} onClick={() => setSelectedId(entry.dataset_id)} className={`w-full rounded-lg border p-3 text-left ${selectedId === entry.dataset_id ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.02]"}`}>
              <div className="flex justify-between gap-2"><span className="font-medium text-sm">{entry.display_name}</span><DecisionIcon decision={review.decision} /></div>
              <div className="text-[11px] text-muted-foreground mt-1 truncate">{entry.sport} · {entry.entity} · {entry.source_endpoint}</div>
              <div className="text-[10px] text-muted-foreground mt-2">{entry.column_count ?? "?"} columns · {entry.row_count ?? "?"} sampled rows</div>
            </button>;
          })}
        </div>
      </aside>

      {!selected ? <div className="surface-card p-8 text-sm text-muted-foreground">Select a dataset.</div> : <div className="space-y-4 min-w-0">
        <section className="surface-card p-4 md:p-5">
          <div className="flex flex-wrap justify-between gap-4">
            <div><h2 className="text-xl font-semibold">{selected.display_name}</h2><p className="text-sm text-muted-foreground mt-1">{selected.description}</p><p className="text-xs text-muted-foreground mt-2">{selected.source_endpoint} · {preview.columns.length} visible columns · {preview.rows.length} sample rows</p></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setReviewDecision("approved")}><CheckCircle2 className="w-4 h-4" /> Approve</Button>
              <Button variant="destructive" onClick={() => setReviewDecision("changes_requested")}><XCircle className="w-4 h-4" /> Request changes</Button>
              <Button variant="outline" onClick={() => setReviewDecision("pending")}>Reset</Button>
            </div>
          </div>
          <textarea value={currentReview.notes} onChange={(event) => updateReview({ notes: event.target.value })} placeholder="Reviewer notes: missing fields, incorrect values, naming changes, or approval rationale." className="mt-4 w-full min-h-24 rounded-md border border-input bg-background p-3 text-sm" />
        </section>

        <section className="surface-card overflow-hidden">
          <div className="flex flex-wrap justify-between gap-2 p-3 border-b border-white/10">
            <div className="flex gap-1">{(["data", "schema", "raw"] as const).map((key) => <button key={key} onClick={() => setTab(key)} className={`min-h-[40px] px-3 rounded-md text-sm font-medium ${tab === key ? "bg-primary text-primary-foreground" : "bg-white/5"}`}>{key === "data" ? "Data sample" : key === "schema" ? "Schema" : "Raw JSON"}</button>)}</div>
            <div className="text-[11px] text-muted-foreground">All {preview.columns.length} columns · maximum {SAMPLE_LIMIT} rows</div>
          </div>
          {loadingPreview ? <div className="p-8 text-sm text-muted-foreground flex gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading preview…</div> : error ? <div className="p-6 text-sm text-amber-300 flex gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div> : tab === "data" ? <DataTable preview={preview} /> : tab === "schema" ? <SchemaTable preview={preview} /> : <pre className="max-h-[65vh] overflow-auto p-4 text-xs bg-black/20">{preview.raw ? JSON.stringify(preview.raw, null, 2) : "Raw JSON is not published for this dataset."}</pre>}
        </section>
      </div>}
    </div>
  </div>;
}

async function fetchPreview(entry: CatalogEntry, setPreview: (value: Preview) => void, setLoading: (value: boolean) => void, setError: (value: string | null) => void) {
  setLoading(true); setError(null); setPreview(EMPTY);
  try {
    let rows: Record<string, unknown>[] = []; let columns: string[] = []; let raw: unknown = null; let schema: SchemaColumn[] = [];
    if (entry.sample_csv_url) { const sample = await streamCsvSample(entry.sample_csv_url, SAMPLE_LIMIT); rows = sample.rows; columns = sample.headers; }
    if (entry.raw_json_url) { const response = await fetch(bust(entry.raw_json_url), { cache: "no-store" }); if (response.ok) raw = await response.json(); }
    if (!rows.length && raw) { rows = extractRows(raw).slice(0, SAMPLE_LIMIT).map((row) => flatten(row)); columns = unionColumns(rows); }
    if (entry.schema_url) { const response = await fetch(bust(entry.schema_url), { cache: "no-store" }); if (response.ok) schema = ((await response.json()) as { columns?: SchemaColumn[] }).columns ?? []; }
    if (!columns.length) columns = schema.map((column) => column.name);
    if (!schema.length) schema = columns.map((name) => ({ name, type: inferType(rows, name) }));
    setPreview({ columns, rows, schema, raw });
  } catch (cause) { setError((cause as Error).message); } finally { setLoading(false); }
}

function DataTable({ preview }: { preview: Preview }) {
  if (!preview.columns.length) return <div className="p-8 text-sm text-muted-foreground">No sampled columns available.</div>;
  return <div className="max-h-[65vh] overflow-auto"><table className="min-w-max w-full text-xs"><thead className="sticky top-0 bg-card"><tr><th className="sticky left-0 bg-card p-2">#</th>{preview.columns.map((column) => <th key={column} className="p-2 text-left whitespace-nowrap">{column}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index} className="border-t border-white/5"><td className="sticky left-0 bg-card p-2 text-muted-foreground">{index + 1}</td>{preview.columns.map((column) => <td key={column} className="p-2 max-w-[320px] whitespace-nowrap"><span className="block max-w-[320px] truncate" title={cell(row[column])}>{cell(row[column]) || "—"}</span></td>)}</tr>)}</tbody></table></div>;
}

function SchemaTable({ preview }: { preview: Preview }) {
  return <div className="max-h-[65vh] overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-card"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Field</th><th className="p-3 text-left">Type</th></tr></thead><tbody>{preview.schema.map((column, index) => <tr key={`${column.name}-${index}`} className="border-t border-white/5"><td className="p-3 text-muted-foreground">{index + 1}</td><td className="p-3 font-mono text-xs">{column.name}</td><td className="p-3 text-muted-foreground">{column.type}</td></tr>)}</tbody></table></div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface-card p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-xl font-bold mt-1">{value}</div></div>; }
function DecisionIcon({ decision }: { decision: Decision }) { return decision === "approved" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : decision === "changes_requested" ? <XCircle className="w-4 h-4 text-red-400" /> : <span className="w-4 h-4 rounded-full border border-muted-foreground" />; }
function blankReview(): Review { return { decision: "pending", notes: "", reviewed_at_utc: null }; }
function readReviews(): Record<string, Review> { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; } }
function bust(url: string) { return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function extractRows(raw: unknown): Record<string, unknown>[] { if (Array.isArray(raw)) return raw.filter(isRecord); if (!isRecord(raw)) return []; const response = raw.response; return Array.isArray(response) ? response.filter(isRecord) : isRecord(response) ? [response] : [raw]; }
function flatten(record: Record<string, unknown>, prefix = "", output: Record<string, unknown> = {}) { Object.entries(record).forEach(([key, value]) => { const name = prefix ? `${prefix}.${key}` : key; if (isRecord(value)) flatten(value, name, output); else output[name] = Array.isArray(value) ? JSON.stringify(value) : value; }); return output; }
function unionColumns(rows: Record<string, unknown>[]) { return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))); }
function inferType(rows: Record<string, unknown>[], column: string) { const value = rows.map((row) => row[column]).find((item) => item != null && item !== ""); return value == null ? "unknown" : typeof value; }
function cell(value: unknown) { return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); }
