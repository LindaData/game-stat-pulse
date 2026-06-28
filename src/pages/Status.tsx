import { RefreshCw } from "lucide-react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { SOURCES } from "@/lib/dataSources";

export default function Status() {
  const { results, loading, lastRefresh, refresh } = useData();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Data Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live view of every upstream source. Cached data is kept between refreshes.
          </p>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground mt-1">
              Last refresh attempt: {new Date(lastRefresh).toLocaleString()}
            </p>
          )}
        </div>
        <Button onClick={() => refresh()} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-2">
        {SOURCES.map((s) => {
          const r = results[s.key];
          return (
            <div key={s.key} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-card-foreground">{s.label}</div>
                  <a
                    href={r?.url ?? s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary break-all hover:underline"
                  >
                    {r?.url ?? s.url}
                  </a>
                </div>
                {r ? (
                  <StatusBadge origin={r.origin} />
                ) : (
                  <span className="chip bg-muted text-muted-foreground">Loading…</span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Info label="Rows" value={r ? r.rows.toLocaleString() : "—"} />
                <Info label="Type" value={s.kind.toUpperCase()} />
                <Info
                  label="Fallback used"
                  value={r?.origin === "fallback" ? "Yes" : "No"}
                />
                <Info
                  label="Last success"
                  value={r ? new Date(r.fetchedAt).toLocaleString() : "—"}
                />
              </div>
              {r?.error && (
                <div className="mt-2 text-[11px] text-amber-400">Note: {r.error}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-card-foreground font-medium truncate">{value}</div>
    </div>
  );
}
