import type { LoadResult, SourceDef } from "./dataSources";
import { SOURCES } from "./dataSources";

export interface DatasetDef {
  id: string;
  label: string;
  group: "NBA" | "MLB" | "Meta";
  sourceKey: string; // matches SOURCES key
  kind: "csv" | "json";
  filename: string;
  season?: string;
  description: string;
}

const byKey = (k: string) => SOURCES.find((s) => s.key === k) as SourceDef;

export const DATASETS: DatasetDef[] = [
  {
    id: "nba_games",
    label: "NBA Games",
    group: "NBA",
    sourceKey: "basketball_games",
    kind: "csv",
    filename: "basketball_games_full.csv",
    season: "2024-2025",
    description: "Per-game NBA results, scores, status.",
  },
  {
    id: "nba_standings",
    label: "NBA Standings",
    group: "NBA",
    sourceKey: "basketball_standings",
    kind: "csv",
    filename: "basketball_standings.csv",
    description: "NBA team standings.",
  },
  {
    id: "nba_snapshot",
    label: "NBA Snapshot JSON",
    group: "NBA",
    sourceKey: "basketball_snapshot",
    kind: "json",
    filename: "basketball_snapshot.json",
    description: "Aggregated NBA snapshot.",
  },
  {
    id: "nba_live",
    label: "NBA Live Events",
    group: "NBA",
    sourceKey: "nba_live",
    kind: "json",
    filename: "nba_live.json",
    description: "Today's NBA scoreboard.",
  },
  {
    id: "mlb_games",
    label: "MLB Games",
    group: "MLB",
    sourceKey: "baseball_games",
    kind: "csv",
    filename: "baseball_games_full.csv",
    season: "2025",
    description: "Per-game MLB results, scores, status.",
  },
  {
    id: "mlb_standings",
    label: "MLB Standings",
    group: "MLB",
    sourceKey: "baseball_standings",
    kind: "csv",
    filename: "baseball_standings.csv",
    description: "MLB team standings.",
  },
  {
    id: "mlb_snapshot",
    label: "MLB Snapshot JSON",
    group: "MLB",
    sourceKey: "baseball_snapshot",
    kind: "json",
    filename: "baseball_snapshot.json",
    description: "Aggregated MLB snapshot.",
  },
  {
    id: "mlb_live",
    label: "MLB Live Events",
    group: "MLB",
    sourceKey: "mlb_live",
    kind: "json",
    filename: "mlb_live.json",
    description: "Today's MLB scoreboard.",
  },
  {
    id: "manifest",
    label: "Historical Manifest",
    group: "Meta",
    sourceKey: "manifest",
    kind: "json",
    filename: "manifest.json",
    description: "Index of historical datasets.",
  },
  {
    id: "live_manifest",
    label: "Live Manifest",
    group: "Meta",
    sourceKey: "live_manifest",
    kind: "json",
    filename: "live_manifest.json",
    description: "Index of live feeds.",
  },
];

export function getSourceFor(dataset: DatasetDef): SourceDef {
  return byKey(dataset.sourceKey);
}

/* --- Type inference --- */
export type InferredType = "number" | "integer" | "boolean" | "date" | "string" | "empty";

export function inferType(v: unknown): InferredType {
  if (v == null) return "empty";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  if (typeof v !== "string") return "string";
  const s = v.trim();
  if (s === "") return "empty";
  if (s === "true" || s === "false") return "boolean";
  if (/^-?\d+$/.test(s)) return "integer";
  if (/^-?\d+\.\d+$/.test(s)) return "number";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return "date";
  }
  return "string";
}

export function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/* --- Schema profile (CSV) --- */
export interface FieldProfile {
  field: string;
  type: InferredType;
  nonEmpty: number;
  missing: number;
  missingPct: number;
  unique: number;
  example: string;
  min?: string | number;
  max?: string | number;
  avg?: number;
  median?: number;
  top?: { value: string; count: number }[];
  earliest?: string;
  latest?: string;
}

export function profileRows(rows: Record<string, unknown>[]): FieldProfile[] {
  if (!rows.length) return [];
  const fields = Array.from(
    rows.reduce((acc, r) => {
      Object.keys(r || {}).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );

  return fields.map((field) => {
    const values = rows.map((r) => r[field]);
    const nonEmptyValues = values.filter((v) => !isEmpty(v));
    const nonEmpty = nonEmptyValues.length;
    const missing = values.length - nonEmpty;
    const uniqueSet = new Set(nonEmptyValues.map((v) => String(v)));
    const example = nonEmptyValues.length ? String(nonEmptyValues[0]) : "";

    // detect dominant type
    const typeCounts: Record<string, number> = {};
    for (const v of nonEmptyValues) {
      const t = inferType(v);
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const type =
      (Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as InferredType) || "string";

    const profile: FieldProfile = {
      field,
      type,
      nonEmpty,
      missing,
      missingPct: values.length ? (missing / values.length) * 100 : 0,
      unique: uniqueSet.size,
      example,
    };

    if (type === "integer" || type === "number") {
      const nums = nonEmptyValues
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (nums.length) {
        profile.min = nums[0];
        profile.max = nums[nums.length - 1];
        profile.avg = nums.reduce((s, n) => s + n, 0) / nums.length;
        profile.median =
          nums.length % 2 === 0
            ? (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
            : nums[(nums.length - 1) / 2];
      }
    } else if (type === "date") {
      const dates = nonEmptyValues
        .map((v) => new Date(String(v)))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      if (dates.length) {
        profile.earliest = dates[0].toISOString();
        profile.latest = dates[dates.length - 1].toISOString();
      }
    } else {
      // categorical top 5
      const counts = new Map<string, number>();
      for (const v of nonEmptyValues) {
        const k = String(v);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      profile.top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));
    }

    return profile;
  });
}

/* --- Data quality --- */
export interface QualityReport {
  totalRows: number;
  duplicateGameIds: number;
  missingTeamNames: number;
  missingDates: number;
  missingScores: number;
  invalidNumeric: number;
  invalidTimestamps: number;
  completed: number;
  scheduled: number;
  live: number;
  uniqueTeams: number;
  dateRange: { earliest?: string; latest?: string };
  seasons: string[];
  statusDistribution: { status: string; count: number }[];
}

export function qualityReport(rows: Record<string, unknown>[]): QualityReport {
  const out: QualityReport = {
    totalRows: rows.length,
    duplicateGameIds: 0,
    missingTeamNames: 0,
    missingDates: 0,
    missingScores: 0,
    invalidNumeric: 0,
    invalidTimestamps: 0,
    completed: 0,
    scheduled: 0,
    live: 0,
    uniqueTeams: 0,
    dateRange: {},
    seasons: [],
    statusDistribution: [],
  };
  const ids = new Map<string, number>();
  const teams = new Set<string>();
  const seasons = new Set<string>();
  const statusMap = new Map<string, number>();
  const dates: Date[] = [];

  for (const r of rows) {
    const gid = String(r.game_id ?? "");
    if (gid) ids.set(gid, (ids.get(gid) || 0) + 1);
    if (isEmpty(r.home_team) || isEmpty(r.away_team)) out.missingTeamNames++;
    else {
      teams.add(String(r.home_team));
      teams.add(String(r.away_team));
    }
    if (isEmpty(r.date_utc)) out.missingDates++;
    else {
      const d = new Date(String(r.date_utc));
      if (isNaN(d.getTime())) out.invalidTimestamps++;
      else dates.push(d);
    }
    const hs = r.home_score;
    const as = r.away_score;
    if (isEmpty(hs) || isEmpty(as)) out.missingScores++;
    else if (!Number.isFinite(Number(hs)) || !Number.isFinite(Number(as))) out.invalidNumeric++;

    const status = String(r.status ?? "").toLowerCase();
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
    if (status.includes("final") || status === "ft" || status.includes("complete")) out.completed++;
    else if (status.includes("sched") || status === "ns" || status.includes("upcoming")) out.scheduled++;
    else if (status.includes("live") || status.includes("progress") || status.includes("q") || status.includes("inning")) out.live++;

    if (!isEmpty(r.season)) seasons.add(String(r.season));
  }

  out.duplicateGameIds = Array.from(ids.values()).filter((c) => c > 1).length;
  out.uniqueTeams = teams.size;
  out.seasons = Array.from(seasons).sort();
  if (dates.length) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    out.dateRange = {
      earliest: dates[0].toISOString(),
      latest: dates[dates.length - 1].toISOString(),
    };
  }
  out.statusDistribution = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return out;
}

/* --- Sampling --- */
export type SampleMode = "full" | "first" | "latest" | "earliest" | "random";

// mulberry32 deterministic RNG
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleRows<T extends Record<string, unknown>>(
  rows: T[],
  mode: SampleMode,
  size: number,
  seed: number,
  dateField = "date_utc",
): T[] {
  if (mode === "full") return rows;
  if (mode === "first") return rows.slice(0, size);
  if (mode === "latest" || mode === "earliest") {
    const sorted = [...rows].sort((a, b) => {
      const av = String(a[dateField] ?? "");
      const bv = String(b[dateField] ?? "");
      return av.localeCompare(bv);
    });
    return mode === "latest" ? sorted.slice(-size).reverse() : sorted.slice(0, size);
  }
  // random
  const rand = rng(seed);
  const idx = rows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, size).map((i) => rows[i]);
}

/* --- Downloads --- */
export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Array.from(
    rows.reduce((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\n");
}

export async function downloadOriginal(url: string, filename: string) {
  try {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}t=${Date.now()}`);
    const text = await res.text();
    const mime = filename.endsWith(".json") ? "application/json" : "text/csv";
    downloadText(filename, text, mime);
  } catch (e) {
    alert(`Download failed: ${(e as Error).message}`);
  }
}

export function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function resultRowsFor(r: LoadResult | undefined): Record<string, unknown>[] {
  if (!r || !r.data) return [];
  if (Array.isArray(r.data)) return r.data as Record<string, unknown>[];
  return [];
}
