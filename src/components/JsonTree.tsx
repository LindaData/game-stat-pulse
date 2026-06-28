import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Copy } from "lucide-react";
import { copyToClipboard, inferType } from "@/lib/rawData";

interface NodeProps {
  name?: string;
  value: unknown;
  depth: number;
  defaultOpen?: boolean;
  search?: string;
  forceState?: "open" | "closed" | null;
}

function matchesSearch(name: string | undefined, value: unknown, search: string): boolean {
  if (!search) return true;
  const s = search.toLowerCase();
  if (name && name.toLowerCase().includes(s)) return true;
  if (value != null && typeof value !== "object") return String(value).toLowerCase().includes(s);
  return false;
}

function Node({ name, value, depth, defaultOpen, search = "", forceState }: NodeProps) {
  const isObj = value && typeof value === "object";
  const isArr = Array.isArray(value);
  const [openLocal, setOpenLocal] = useState(defaultOpen ?? depth < 1);
  const open = forceState === "open" ? true : forceState === "closed" ? false : openLocal;

  const indent = { paddingLeft: `${depth * 12}px` };

  if (!isObj) {
    if (search && !matchesSearch(name, value, search)) return null;
    const t = inferType(value);
    const display =
      value == null
        ? "null"
        : typeof value === "string"
          ? `"${value}"`
          : String(value);
    const color =
      t === "number" || t === "integer"
        ? "text-emerald-400"
        : t === "boolean"
          ? "text-amber-400"
          : t === "empty" || value == null
            ? "text-muted-foreground"
            : "text-sky-300";
    return (
      <div style={indent} className="font-mono text-[11px] leading-relaxed flex gap-1 group">
        {name !== undefined && <span className="text-foreground/80">{name}:</span>}
        <span className={`${color} break-all`}>{display}</span>
      </div>
    );
  }

  const entries = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  // search filter: include if name matches OR any child matches
  if (search) {
    const text = JSON.stringify(value).toLowerCase();
    if (!(name && name.toLowerCase().includes(search.toLowerCase())) && !text.includes(search.toLowerCase()))
      return null;
  }

  return (
    <div style={indent} className="font-mono text-[11px] leading-relaxed">
      <button
        onClick={() => setOpenLocal((o) => !o)}
        className="inline-flex items-center gap-1 text-foreground/80 hover:text-primary"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {name !== undefined && <span>{name}:</span>}
        <span className="text-muted-foreground">
          {isArr ? `Array(${entries.length})` : `Object{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div>
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} search={search} forceState={forceState} />
          ))}
        </div>
      )}
    </div>
  );
}

export function JsonTree({ data }: { data: unknown }) {
  const [view, setView] = useState<"tree" | "raw">("tree");
  const [search, setSearch] = useState("");
  const [force, setForce] = useState<"open" | "closed" | null>(null);

  const raw = useMemo(() => JSON.stringify(data, null, 2), [data]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md overflow-hidden border border-white/10 text-xs">
          <button
            onClick={() => setView("tree")}
            className={`px-2 py-1 ${view === "tree" ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
          >
            Tree
          </button>
          <button
            onClick={() => setView("raw")}
            className={`px-2 py-1 ${view === "raw" ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
          >
            Raw
          </button>
        </div>
        {view === "tree" && (
          <>
            <button
              onClick={() => setForce("open")}
              className="text-xs px-2 py-1 rounded border border-white/10 text-foreground/70 hover:text-primary"
            >
              Expand all
            </button>
            <button
              onClick={() => setForce("closed")}
              className="text-xs px-2 py-1 rounded border border-white/10 text-foreground/70 hover:text-primary"
            >
              Collapse all
            </button>
            <button
              onClick={() => setForce(null)}
              className="text-xs px-2 py-1 rounded border border-white/10 text-foreground/70 hover:text-primary"
            >
              Reset
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys/values"
              className="flex-1 min-w-[140px] text-xs px-2 py-1 rounded bg-card text-card-foreground border border-white/10"
            />
          </>
        )}
        <button
          onClick={() => copyToClipboard(raw)}
          className="text-xs px-2 py-1 rounded border border-white/10 text-foreground/70 hover:text-primary inline-flex items-center gap-1"
        >
          <Copy className="w-3 h-3" /> Copy JSON
        </button>
      </div>

      <div className="bg-[hsl(var(--navy-deep))] rounded-md p-3 max-h-[60vh] overflow-auto border border-white/10">
        {view === "tree" ? (
          <Node value={data} depth={0} defaultOpen search={search} forceState={force} />
        ) : (
          <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap break-all">{raw}</pre>
        )}
      </div>
    </div>
  );
}
