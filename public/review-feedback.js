(() => {
  const STYLE_ID = "gsp-review-feedback-style";
  const LABEL_ATTR = "data-gsp-feedback-label";
  const STATUS_ATTR = "data-gsp-feedback-status";

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [${LABEL_ATTR}] {
        margin-top: 0.25rem;
        padding: 0.9rem 1rem 0.65rem;
        border: 1px solid rgba(255,255,255,.12);
        border-bottom: 0;
        border-radius: 0.75rem 0.75rem 0 0;
        background: rgba(255,255,255,.035);
      }
      [${LABEL_ATTR}] strong {
        display: block;
        font-size: 0.95rem;
        line-height: 1.3;
      }
      [${LABEL_ATTR}] span {
        display: block;
        margin-top: 0.25rem;
        color: hsl(var(--muted-foreground));
        font-size: 0.75rem;
        line-height: 1.4;
      }
      textarea[data-gsp-feedback-box="true"] {
        min-height: 10rem !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border-color: rgba(255,255,255,.12) !important;
        background: rgba(0,0,0,.16) !important;
        font-size: 1rem !important;
        line-height: 1.5 !important;
      }
      [${STATUS_ATTR}] {
        padding: 0.55rem 1rem 0.75rem;
        border: 1px solid rgba(255,255,255,.12);
        border-top: 0;
        border-radius: 0 0 0.75rem 0.75rem;
        background: rgba(255,255,255,.035);
        color: hsl(var(--muted-foreground));
        font-size: 0.72rem;
      }
      @media (min-width: 1024px) {
        textarea[data-gsp-feedback-box="true"] { min-height: 8rem !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceTextarea(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (!textarea.placeholder?.toLowerCase().includes("optional note")) return;
    if (textarea.dataset.gspFeedbackBox === "true") return;

    textarea.dataset.gspFeedbackBox = "true";
    textarea.setAttribute("aria-label", "Feedback and notes for this dataset");
    textarea.placeholder = "Write anything you notice: missing fields, wrong values, confusing names, or why you approved it.";

    const label = document.createElement("div");
    label.setAttribute(LABEL_ATTR, "true");
    label.innerHTML = `
      <strong>Feedback / notes</strong>
      <span>These notes belong to this dataset and stay saved while you move around.</span>
    `;

    const status = document.createElement("div");
    status.setAttribute(STATUS_ATTR, "true");
    status.textContent = textarea.value ? "Saved notes loaded on this phone." : "Autosaves on this phone as you type.";

    textarea.insertAdjacentElement("beforebegin", label);
    textarea.insertAdjacentElement("afterend", status);

    textarea.addEventListener("input", () => {
      status.textContent = "Saved automatically on this phone.";
    });
  }

  function cleanOrphans() {
    document.querySelectorAll(`[${LABEL_ATTR}]`).forEach((node) => {
      const next = node.nextElementSibling;
      if (!(next instanceof HTMLTextAreaElement) || next.dataset.gspFeedbackBox !== "true") node.remove();
    });
    document.querySelectorAll(`[${STATUS_ATTR}]`).forEach((node) => {
      const previous = node.previousElementSibling;
      if (!(previous instanceof HTMLTextAreaElement) || previous.dataset.gspFeedbackBox !== "true") node.remove();
    });
  }

  function enhance() {
    addStyles();
    cleanOrphans();
    document.querySelectorAll("textarea").forEach(enhanceTextarea);
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", enhance);
  window.addEventListener("hashchange", enhance);
  document.addEventListener("DOMContentLoaded", enhance);
  enhance();
})();
