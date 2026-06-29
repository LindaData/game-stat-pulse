// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  APPROVAL_STORAGE_KEY,
  REVIEW_WORKSPACE_STORAGE_KEY,
  detectReviewLocale,
  getReviewContext,
  importReviewWorkspace,
  persistContextNote,
  readApprovalNote,
  readReviewWorkspace,
  reviewWorkspaceToMarkdown,
  setContextNote,
  setGlobalNote,
} from "./reviewWorkspace";

describe("review workspace", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("tracks dataset notes separately from general page notes", () => {
    const dataset = getReviewContext("/approval", "?dataset=football-fixtures");
    const catalog = getReviewContext("/datasets");

    expect(dataset.key).toBe("dataset:football-fixtures");
    expect(dataset.route).toBe("/approval?dataset=football-fixtures");
    expect(catalog.key).toBe("route:/datasets");
  });

  it("persists a dataset note into both the notebook and approval record", () => {
    const context = getReviewContext("/", "?dataset=teams");
    persistContextNote(context, "Check team name aliases", "Teams");

    expect(readReviewWorkspace().notes[context.key].text).toBe("Check team name aliases");
    expect(readApprovalNote("teams")).toBe("Check team name aliases");

    const approvals = JSON.parse(localStorage.getItem(APPROVAL_STORAGE_KEY) ?? "{}");
    expect(approvals.teams.decision).toBe("pending");
  });

  it("preserves existing approval decisions when updating notes", () => {
    localStorage.setItem(
      APPROVAL_STORAGE_KEY,
      JSON.stringify({ teams: { decision: "approved", notes: "old", reviewed_at_utc: "2026-01-01T00:00:00.000Z" } }),
    );

    persistContextNote(getReviewContext("/approval", "?dataset=teams"), "new note");

    const approvals = JSON.parse(localStorage.getItem(APPROVAL_STORAGE_KEY) ?? "{}");
    expect(approvals.teams.decision).toBe("approved");
    expect(approvals.teams.notes).toBe("new note");
    expect(approvals.teams.reviewed_at_utc).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps global and contextual notes in the exported markdown", () => {
    let workspace = readReviewWorkspace();
    workspace = setGlobalNote(workspace, "Executive summary", "2026-01-01T00:00:00.000Z");
    workspace = setContextNote(
      workspace,
      getReviewContext("/quality"),
      "Investigate null-rate threshold",
      "Data quality",
      "2026-01-02T00:00:00.000Z",
    );

    const markdown = reviewWorkspaceToMarkdown(workspace);
    expect(markdown).toContain("Executive summary");
    expect(markdown).toContain("Investigate null-rate threshold");
    expect(markdown).toContain("/quality");
  });

  it("restores a valid multilingual backup", () => {
    const restored = importReviewWorkspace({
      version: 2,
      locale: "fr",
      globalText: "À vérifier",
      globalUpdatedAt: "2026-01-01T00:00:00.000Z",
      notes: {},
    });

    expect(restored.locale).toBe("fr");
    expect(readReviewWorkspace().globalText).toBe("À vérifier");
    expect(localStorage.getItem(REVIEW_WORKSPACE_STORAGE_KEY)).toBeTruthy();
  });

  it("maps supported browser languages to product locales", () => {
    expect(detectReviewLocale("en-GB")).toBe("en-GB");
    expect(detectReviewLocale("en-AU")).toBe("en-AU");
    expect(detectReviewLocale("es-MX")).toBe("es");
    expect(detectReviewLocale("fr-CA")).toBe("fr");
    expect(detectReviewLocale("de-DE")).toBe("en-US");
  });
});
