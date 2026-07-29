import { describe, expect, it } from "vitest";
import {
  isPanePreviewStatusCurrent,
  isPaneResultCurrent,
  isPaneSelectionCurrent,
  isTabRevisionCurrent,
  resolvePaneTabPresentationState,
  resolveTabAccessibilityState,
  type PanePreviewStatus,
} from "./paneRuntime";
import { reduceSplitView, type SplitViewState } from "./splitView";

const status = (phase: PanePreviewStatus["phase"]): PanePreviewStatus => ({
  tabId: "a",
  revision: 1,
  phase,
  errorMessage: phase === "error" ? "failed" : null,
});

function stateWithPaneTabs(
  primary: string[] = ["a"],
  secondary: string[] = [],
): SplitViewState {
  return {
    mode: "split",
    activePaneId: "primary",
    primary: {
      orderedTabIds: primary,
      activeTabId: primary[0] ?? null,
      pendingNavigation: null,
    },
    secondary: {
      orderedTabIds: secondary,
      activeTabId: secondary[0] ?? null,
      pendingNavigation: null,
    },
    requestedSplitRatio: 0.5,
  };
}

describe("pane runtime guard", () => {
  it("keeps pane selection and tab revision checks independent", () => {
    const state = stateWithPaneTabs();
    expect(isPaneSelectionCurrent("primary", "a", state)).toBe(true);
    expect(isPaneSelectionCurrent("primary", "b", state)).toBe(false);
    expect(isTabRevisionCurrent("a", 1, [{ id: "a", revision: 1 }])).toBe(true);
    expect(isTabRevisionCurrent("a", 2, [{ id: "a", revision: 1 }])).toBe(false);
  });

  it("accepts only the current pane, tab, and revision", () => {
    const state = stateWithPaneTabs();
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

  it("rejects source results and accepts destination results after move", () => {
    const moved = reduceSplitView(stateWithPaneTabs(["a", "b"], ["c"]), {
      type: "move-tab",
      sourcePaneId: "primary",
      destinationPaneId: "secondary",
      tabId: "a",
    });
    const identities = [
      { id: "a", revision: 1 },
      { id: "b", revision: 1 },
      { id: "c", revision: 1 },
    ];
    expect(
      isPaneResultCurrent(
        { paneId: "primary", tabId: "a", revision: 1 },
        moved,
        identities,
      ),
    ).toBe(false);
    expect(
      isPaneResultCurrent(
        { paneId: "secondary", tabId: "a", revision: 1 },
        moved,
        identities,
      ),
    ).toBe(true);
  });

  it("rejects a retained secondary result while single and restores revision guard after enable", () => {
    const split = stateWithPaneTabs(["a"], ["b"]);
    const single = reduceSplitView(split, { type: "disable-split" });
    expect(single.secondary.activeTabId).toBe("b");
    expect(
      isPaneResultCurrent(
        { paneId: "secondary", tabId: "b", revision: 1 },
        single,
        [{ id: "b", revision: 1 }],
      ),
    ).toBe(false);

    const enabled = reduceSplitView(single, { type: "enable-split" });
    expect(
      isPaneResultCurrent(
        { paneId: "secondary", tabId: "b", revision: 1 },
        enabled,
        [{ id: "b", revision: 1 }],
      ),
    ).toBe(true);
    expect(
      isPaneResultCurrent(
        { paneId: "secondary", tabId: "b", revision: 1 },
        enabled,
        [{ id: "b", revision: 2 }],
      ),
    ).toBe(false);
  });

  it("rejects status after tab eviction or selection change", () => {
    const state = stateWithPaneTabs(["a", "b"]);
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
  it.each([
    ["ready", { labelSuffix: null, busy: false }],
    ["loading", { labelSuffix: "Loading", busy: true }],
    ["rendering", { labelSuffix: "Rendering", busy: true }],
    ["error", { labelSuffix: "Error", busy: false }],
  ] as const)("maps %s to one accessible state", (presentation, expected) => {
    expect(resolveTabAccessibilityState(presentation)).toEqual(expected);
  });

  it.each(["loading", "rendering", "error"] as const)(
    "keeps shared %s ahead of pane runtime",
    (loadState) => {
      expect(
        resolvePaneTabPresentationState(
          { id: "a", revision: 1, loadState },
          "primary",
          stateWithPaneTabs(),
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
        stateWithPaneTabs(),
        status(phase),
      ),
    ).toBe(expected);
  });

  it("does not mix one pane error into the other pane for a shared document", () => {
    const sameTab = stateWithPaneTabs(["a"], ["a"]);
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
        stateWithPaneTabs(["a", "b"]),
        status("error"),
      ),
    ).toBe("ready");
    expect(
      resolvePaneTabPresentationState(
        { id: "a", revision: 2, loadState: "ready" },
        "primary",
        stateWithPaneTabs(),
        status("error"),
      ),
    ).toBe("ready");
  });
});
