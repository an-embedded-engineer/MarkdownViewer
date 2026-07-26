import { describe, expect, it } from "vitest";
import {
  isPanePreviewStatusCurrent,
  isPaneResultCurrent,
  resolvePaneTabPresentationState,
  type PanePreviewStatus,
} from "./paneRuntime";
import { createInitialSplitViewState, reduceSplitView } from "./splitView";

const status = (phase: PanePreviewStatus["phase"]): PanePreviewStatus => ({
  tabId: "a",
  revision: 1,
  phase,
  errorMessage: phase === "error" ? "failed" : null,
});

describe("pane runtime guard", () => {
  it("accepts only the current pane, tab, and revision", () => {
    const state = createInitialSplitViewState("a");
    expect(
      isPaneResultCurrent(
        { paneId: "primary", tabId: "a", revision: 1 },
        state,
        [{ id: "a", revision: 1 }],
      ),
    ).toBe(true);
    expect(
      isPaneResultCurrent(
        { paneId: "primary", tabId: "b", revision: 1 },
        state,
        [{ id: "a", revision: 1 }],
      ),
    ).toBe(false);
    expect(
      isPaneResultCurrent(
        { paneId: "primary", tabId: "a", revision: 1 },
        state,
        [{ id: "a", revision: 2 }],
      ),
    ).toBe(false);
  });

  it("rejects a secondary result after split is disabled", () => {
    let state = reduceSplitView(createInitialSplitViewState("a"), {
      type: "enable-split",
      orderedTabIds: ["a", "b"],
    });
    expect(
      isPaneResultCurrent(
        { paneId: "secondary", tabId: "b", revision: 1 },
        state,
        [{ id: "a", revision: 1 }, { id: "b", revision: 1 }],
      ),
    ).toBe(true);
    state = reduceSplitView(state, { type: "disable-split", orderedTabIds: ["a", "b"] });
    expect(
      isPaneResultCurrent(
        { paneId: "secondary", tabId: "b", revision: 1 },
        state,
        [{ id: "a", revision: 1 }, { id: "b", revision: 1 }],
      ),
    ).toBe(false);
  });

  it("rejects status after tab close or selection change", () => {
    const state = createInitialSplitViewState("a");
    expect(isPanePreviewStatusCurrent("primary", status("ready"), state, [])).toBe(false);
    const changed = reduceSplitView(state, {
      type: "select-tab",
      paneId: "primary",
      tabId: "b",
    });
    expect(
      isPanePreviewStatusCurrent(
        "primary",
        status("ready"),
        changed,
        [{ id: "a", revision: 1 }, { id: "b", revision: 1 }],
      ),
    ).toBe(false);
  });
});

describe("pane tab presentation", () => {
  it.each(["loading", "rendering", "error"] as const)(
    "keeps shared %s ahead of pane runtime",
    (loadState) => {
      expect(
        resolvePaneTabPresentationState(
          { id: "a", revision: 1, loadState },
          "primary",
          createInitialSplitViewState("a"),
          status("error"),
        ),
      ).toBe(loadState);
    },
  );

  it.each([
    ["loading-html", "loading"],
    ["rendering-mermaid", "rendering"],
    ["error", "error"],
    ["ready", "ready"],
  ] as const)("maps selected pane phase %s to %s", (phase, expected) => {
    expect(
      resolvePaneTabPresentationState(
        { id: "a", revision: 1, loadState: "ready" },
        "primary",
        createInitialSplitViewState("a"),
        status(phase),
      ),
    ).toBe(expected);
  });

  it("does not mix one pane error into the other pane", () => {
    const split = reduceSplitView(createInitialSplitViewState("a"), {
      type: "enable-split",
      orderedTabIds: ["a", "b"],
    });
    const sameTab = reduceSplitView(split, {
      type: "select-tab",
      paneId: "secondary",
      tabId: "a",
    });
    expect(
      resolvePaneTabPresentationState(
        { id: "a", revision: 1, loadState: "ready" },
        "primary",
        sameTab,
        status("ready"),
      ),
    ).toBe("ready");
    expect(
      resolvePaneTabPresentationState(
        { id: "a", revision: 1, loadState: "ready" },
        "secondary",
        sameTab,
        status("error"),
      ),
    ).toBe("error");
  });

  it("ignores a status for an unselected tab or stale revision", () => {
    expect(
      resolvePaneTabPresentationState(
        { id: "b", revision: 1, loadState: "ready" },
        "primary",
        createInitialSplitViewState("a"),
        status("error"),
      ),
    ).toBe("ready");
    expect(
      resolvePaneTabPresentationState(
        { id: "a", revision: 2, loadState: "ready" },
        "primary",
        createInitialSplitViewState("a"),
        status("error"),
      ),
    ).toBe("ready");
  });
});
