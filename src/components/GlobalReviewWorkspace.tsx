import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronUp,
  Clipboard,
  Download,
  FileUp,
  Globe2,
  NotebookPen,
  Trash2,
} from "lucide-react";
import {
  REVIEW_WORKSPACE_EVENT,
  type ReviewContext,
  type ReviewLocale,
  type ReviewNote,
  downloadReviewWorkspace,
  getReviewContext,
  importReviewWorkspace,
  persistContextNote,
  persistGlobalNote,
  persistReviewLocale,
  readApprovalNote,
  readReviewWorkspace,
  reviewWorkspaceToMarkdown,
  writeReviewWorkspace,
} from "@/lib/reviewWorkspace";

const english = {
  notebook: "Review notebook",
  notes: "Notes",
  current: "Current",
  global: "Global",
  all: "All notes",
  currentNote: "Page note",
  globalNote: "Global scratchpad",
  currentPlaceholder: "Write feedback for this page or dataset…",
  globalPlaceholder: "Keep notes that should follow you everywhere…",
  saved: "Saved on this device",
  copied: "Copied",
  imported: "Backup restored",
  importFailed: "Could not restore that backup",
  approvalSync: "Also synced to this dataset’s approval record.",
  noNotes: "No saved notes yet.",
  updated: "Updated",
  open: "Open",
  minimise: "Minimise notebook",
  expand: "Open review notebook",
  export: "Export",
  copyAll: "Copy all",
  restore: "Restore",
  clear: "Clear",
  clearConfirm: "Clear this note?",
  deleteConfirm: "Delete this saved note?",
  language: "Language",
  storageNote: "Autosaves as you type. Export a backup for long-term or cross-device storage.",
};

type Messages = typeof english;

const messages: Record<ReviewLocale, Messages> = {
  "en-US": english,
  "en-GB": english,
  "en-AU": english,
  es: {
    notebook: "Cuaderno de revisión",
    notes: "Notas",
    current: "Actual",
    global: "Global",
    all: "Todas",
    currentNote: "Nota de esta página",
    globalNote: "Notas generales",
    currentPlaceholder: "Escribe comentarios sobre esta página o conjunto de datos…",
    globalPlaceholder: "Guarda notas que deben acompañarte en todas las páginas…",
    saved: "Guardado en este dispositivo",
    copied: "Copiado",
    imported: "Copia restaurada",
    importFailed: "No se pudo restaurar la copia",
    approvalSync: "También se sincroniza con la aprobación de este conjunto de datos.",
    noNotes: "Todavía no hay notas guardadas.",
    updated: "Actualizado",
    open: "Abrir",
    minimise: "Minimizar cuaderno",
    expand: "Abrir cuaderno de revisión",
    export: "Exportar",
    copyAll: "Copiar todo",
    restore: "Restaurar",
    clear: "Borrar",
    clearConfirm: "¿Borrar esta nota?",
    deleteConfirm: "¿Eliminar esta nota guardada?",
    language: "Idioma",
    storageNote: "Se guarda mientras escribes. Exporta una copia para conservarla o usarla en otro dispositivo.",
  },
  fr: {
    notebook: "Carnet de révision",
    notes: "Notes",
    current: "Actuelle",
    global: "Global",
    all: "Toutes",
    currentNote: "Note de cette page",
    globalNote: "Bloc-notes général",
    currentPlaceholder: "Saisissez vos commentaires pour cette page ou ce jeu de données…",
    globalPlaceholder: "Conservez ici les notes qui doivent vous suivre partout…",
    saved: "Enregistré sur cet appareil",
    copied: "Copié",
    imported: "Sauvegarde restaurée",
    importFailed: "Impossible de restaurer cette sauvegarde",
    approvalSync: "Également synchronisé avec la validation de ce jeu de données.",
    noNotes: "Aucune note enregistrée.",
    updated: "Mis à jour",
    open: "Ouvrir",
    minimise: "Réduire le carnet",
    expand: "Ouvrir le carnet de révision",
    export: "Exporter",
    copyAll: "Tout copier",
    restore: "Restaurer",
    clear: "Effacer",
    clearConfirm: "Effacer cette note ?",
    deleteConfirm: "Supprimer cette note enregistrée ?",
    language: "Langue",
    storageNote: "Enregistrement automatique pendant la saisie. Exportez une sauvegarde pour la conservation ou un autre appareil.",
  },
};

const localeOptions: Array<{ value: ReviewLocale; label: string }> = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

const APPROVAL_TEXTAREA_SELECTOR = [
  'textarea[placeholder^="Optional note"]',
  'textarea[aria-label="Feedback and notes for this dataset"]',
  'textarea[data-gsp-feedback-box="true"]',
].join(",");

type Tab = "current" | "global" | "all";

export default function GlobalReviewWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(readReviewWorkspace);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("current");
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef(workspace);

  const context = useMemo(
    () => getReviewContext(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const locale = workspace.locale;
  const text = messages[locale];
  const savedRecord = workspace.notes[context.key];
  const approvalFallback = context.datasetId ? readApprovalNote(context.datasetId) : "";
  const currentText = savedRecord?.text ?? approvalFallback;
  const noteCount = Object.keys(workspace.notes).length + (workspace.globalText.trim() ? 1 : 0);
  const isApproval = location.pathname === "/" || location.pathname === "/approval";
  const mobileBottom = isApproval
    ? "bottom-[calc(8.75rem+env(safe-area-inset-bottom))]"
    : "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]";

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    const refresh = () => setWorkspace(readReviewWorkspace());
    const storageRefresh = (event: StorageEvent) => {
      if (!event.key || event.key === "gsp:review-workspace:v2" || event.key === "gsp:data-approval:v1") refresh();
    };
    window.addEventListener(REVIEW_WORKSPACE_EVENT, refresh);
    window.addEventListener("storage", storageRefresh);
    return () => {
      window.removeEventListener(REVIEW_WORKSPACE_EVENT, refresh);
      window.removeEventListener("storage", storageRefresh);
    };
  }, []);

  useEffect(() => {
    if (!context.datasetId || savedRecord || !approvalFallback.trim()) return;
    setWorkspace(persistContextNote(context, approvalFallback, liveContextLabel(context)));
  }, [approvalFallback, context, savedRecord]);

  useEffect(() => {
    const captureInlineApprovalNote = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || !target.matches(APPROVAL_TEXTAREA_SELECTOR)) return;
      if (!context.datasetId) return;
      setWorkspace(persistContextNote(context, target.value, liveContextLabel(context)));
    };
    document.addEventListener("input", captureInlineApprovalNote, true);
    return () => document.removeEventListener("input", captureInlineApprovalNote, true);
  }, [context]);

  useEffect(() => {
    const flush = () => writeReviewWorkspace(workspaceRef.current);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const saveCurrent = (value: string) => {
    const next = persistContextNote(context, value, liveContextLabel(context));
    setWorkspace(next);
    setNotice(text.saved);
    if (context.datasetId) syncApprovalTextarea(value);
  };

  const saveGlobal = (value: string) => {
    setWorkspace(persistGlobalNote(value));
    setNotice(text.saved);
  };

  const changeLocale = (value: ReviewLocale) => {
    setWorkspace(persistReviewLocale(value));
  };

  const copyAll = async () => {
    const markdown = reviewWorkspaceToMarkdown(workspaceRef.current);
    await copyText(markdown);
    setNotice(text.copied);
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      const next = importReviewWorkspace(value);
      setWorkspace(next);
      setNotice(messages[next.locale].imported);
    } catch {
      setNotice(text.importFailed);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearCurrent = () => {
    if (!window.confirm(text.clearConfirm)) return;
    saveCurrent("");
  };

  const removeNote = (key: string, note: ReviewNote) => {
    if (!window.confirm(text.deleteConfirm)) return;
    const noteContext: ReviewContext = {
      key,
      label: note.label,
      route: note.route,
      datasetId: note.datasetId,
    };
    setWorkspace(persistContextNote(noteContext, "", note.label));
  };

  const allNotes = Object.entries(workspace.notes).sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt));
  const savedAt = savedRecord?.updatedAt ?? (context.datasetId && approvalFallback ? new Date().toISOString() : null);

  return (
    <div lang={locale}>
      {!expanded && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setTab("current");
          }}
          aria-expanded="false"
          aria-controls="global-review-workspace"
          aria-label={text.expand}
          className={`fixed ${mobileBottom} right-3 lg:right-6 lg:bottom-6 z-[60] min-h-12 px-4 rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-2xl flex items-center gap-2 font-semibold active:scale-[0.98]`}
        >
          <NotebookPen className="w-5 h-5" />
          <span>{text.notes}</span>
          {noteCount > 0 && (
            <span className="min-w-6 h-6 px-1.5 rounded-full bg-black/20 text-xs flex items-center justify-center">
              {noteCount}
            </span>
          )}
        </button>
      )}

      {expanded && (
        <section
          id="global-review-workspace"
          role="complementary"
          aria-label={text.notebook}
          className={`fixed ${mobileBottom} left-2 right-2 lg:left-auto lg:right-6 lg:bottom-6 lg:w-[430px] z-[70] max-h-[68vh] overflow-hidden rounded-2xl border border-white/15 bg-[hsl(var(--card))] shadow-2xl flex flex-col`}
        >
          <header className="min-h-14 px-3 py-2.5 border-b border-white/10 bg-white/[0.035] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold leading-tight truncate">{text.notebook}</h2>
              <div className="text-[11px] text-muted-foreground truncate">{liveContextLabel(context)}</div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={text.minimise}
              className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center active:bg-white/10"
            >
              <ChevronUp className="w-5 h-5 rotate-180" />
            </button>
          </header>

          <div className="grid grid-cols-3 gap-1.5 p-2 border-b border-white/10" role="tablist" aria-label={text.notebook}>
            {([
              ["current", text.current],
              ["global", text.global],
              ["all", text.all],
            ] as Array<[Tab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-11 rounded-lg px-2 text-sm font-medium ${
                  tab === value ? "bg-primary text-primary-foreground" : "bg-white/5 text-foreground/75"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto overscroll-contain p-3 flex-1">
            {tab === "current" && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{text.currentNote}</div>
                    <div className="text-xs text-muted-foreground break-all mt-0.5">{liveContextLabel(context)}</div>
                  </div>
                  {currentText.trim() && (
                    <button type="button" onClick={clearCurrent} className="min-h-11 px-3 rounded-lg bg-white/5 text-xs flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> {text.clear}
                    </button>
                  )}
                </div>
                <textarea
                  value={currentText}
                  onChange={(event) => saveCurrent(event.target.value)}
                  placeholder={text.currentPlaceholder}
                  aria-label={text.currentNote}
                  className="w-full min-h-[13rem] max-h-[34vh] resize-y rounded-xl border border-input bg-background p-3 text-base leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
                />
                {context.datasetId && <p className="text-xs text-primary/90">{text.approvalSync}</p>}
                <SaveStatus text={notice ?? text.saved} updatedAt={savedAt} locale={locale} updatedLabel={text.updated} />
              </div>
            )}

            {tab === "global" && (
              <div className="space-y-3">
                <div className="text-sm font-semibold">{text.globalNote}</div>
                <textarea
                  value={workspace.globalText}
                  onChange={(event) => saveGlobal(event.target.value)}
                  placeholder={text.globalPlaceholder}
                  aria-label={text.globalNote}
                  className="w-full min-h-[13rem] max-h-[34vh] resize-y rounded-xl border border-input bg-background p-3 text-base leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
                />
                <SaveStatus text={notice ?? text.saved} updatedAt={workspace.globalUpdatedAt} locale={locale} updatedLabel={text.updated} />
              </div>
            )}

            {tab === "all" && (
              <div className="space-y-2.5">
                {workspace.globalText.trim() && (
                  <article className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="font-medium text-sm">{text.globalNote}</div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{workspace.globalText}</p>
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={() => setTab("global")} className="min-h-11 px-3 rounded-lg bg-primary/15 text-primary text-sm">
                        {text.open}
                      </button>
                      <button type="button" onClick={() => void copyText(workspace.globalText)} className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center" aria-label={text.copied}>
                        <Clipboard className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                )}

                {allNotes.map(([key, note]) => (
                  <article key={key} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="font-medium text-sm break-words">{note.label}</div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{note.text}</p>
                    <div className="text-[10px] text-muted-foreground mt-2">{formatTimestamp(note.updatedAt, locale)}</div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          navigate(note.route);
                          setTab("current");
                        }}
                        className="min-h-11 px-3 rounded-lg bg-primary/15 text-primary text-sm"
                      >
                        {text.open}
                      </button>
                      <button type="button" onClick={() => void copyText(note.text)} className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center" aria-label={text.copied}>
                        <Clipboard className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => removeNote(key, note)} className="w-11 h-11 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center" aria-label={text.clear}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                ))}

                {!workspace.globalText.trim() && !allNotes.length && (
                  <div className="py-10 text-center text-sm text-muted-foreground">{text.noNotes}</div>
                )}
              </div>
            )}
          </div>

          <footer className="border-t border-white/10 p-2.5 space-y-2 bg-white/[0.02]">
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => downloadReviewWorkspace(workspaceRef.current)} className="min-h-11 rounded-lg bg-white/5 text-xs flex items-center justify-center gap-1.5">
                <Download className="w-4 h-4" /> {text.export}
              </button>
              <button type="button" onClick={() => void copyAll()} className="min-h-11 rounded-lg bg-white/5 text-xs flex items-center justify-center gap-1.5">
                <Clipboard className="w-4 h-4" /> {text.copyAll}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-11 rounded-lg bg-white/5 text-xs flex items-center justify-center gap-1.5">
                <FileUp className="w-4 h-4" /> {text.restore}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => void restoreBackup(event.target.files?.[0])}
              className="sr-only"
            />
            <label className="min-h-11 rounded-lg border border-white/10 px-3 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground shrink-0">{text.language}</span>
              <select
                value={locale}
                onChange={(event) => changeLocale(event.target.value as ReviewLocale)}
                className="min-h-10 flex-1 bg-transparent text-sm outline-none"
              >
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-background">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[10px] leading-relaxed text-muted-foreground">{text.storageNote}</p>
          </footer>
        </section>
      )}
    </div>
  );
}

function SaveStatus({
  text,
  updatedAt,
  locale,
  updatedLabel,
}: {
  text: string;
  updatedAt: string | null;
  locale: ReviewLocale;
  updatedLabel: string;
}) {
  return (
    <div className="min-h-6 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <Check className="w-3.5 h-3.5 text-primary" />
      <span>{text}</span>
      {updatedAt && <span>· {updatedLabel} {formatTimestamp(updatedAt, locale)}</span>}
    </div>
  );
}

function liveContextLabel(context: ReviewContext): string {
  if (context.datasetId) {
    const heading = document.querySelector("#dataset-review h2")?.textContent?.trim();
    if (heading) return heading;
  }
  return context.label;
}

function syncApprovalTextarea(value: string): void {
  const textarea = document.querySelector(APPROVAL_TEXTAREA_SELECTOR);
  if (!(textarea instanceof HTMLTextAreaElement) || textarea.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(textarea, value);
  else textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function formatTimestamp(value: string, locale: ReviewLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
