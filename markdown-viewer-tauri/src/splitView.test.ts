import { describe, expect, it } from "vitest";
import {
  createInitialSplitViewState,
  getPrimaryPaneWidth,
  getReferencedTabIds,
  getRequestedRatioForPrimaryWidth,
  getSplitPaneWidthBounds,
  getSplitRatioForKey,
  initialSplitRatio,
  reduceSplitView,
  resolveGroupTabs,
  splitSeparatorWidth,
  type PaneId,
  type PaneState,
  type SplitViewState,
} from "./splitView";

type PaneFixture = {
  orderedTabIds?: string[];
  activeTabId?: string | null;
  pendingNavigation?: PaneState["pendingNavigation"];
};

function stateWithPaneTabs({
  primary = {},
  secondary = {},
  activePaneId = "primary",
  mode = "split",
  requestedSplitRatio = initialSplitRatio,
}: {
  primary?: PaneFixture;
  secondary?: PaneFixture;
  activePaneId?: PaneId;
  mode?: SplitViewState["mode"];
  requestedSplitRatio?: number;
} = {}): SplitViewState {
  const pane = (fixture: PaneFixture): PaneState => {
    const orderedTabIds = fixture.orderedTabIds ?? [];
    return {
      orderedTabIds,
      activeTabId: fixture.activeTabId ?? orderedTabIds[0] ?? null,
      pendingNavigation: fixture.pendingNavigation ?? null,
    };
  };
  return {
    mode,
    activePaneId,
    primary: pane(primary),
    secondary: pane(secondary),
    requestedSplitRatio,
  };
}

describe("pane-local tab group policy", () => {
  it("creates an empty single primary view", () => {
    expect(createInitialSplitViewState()).toEqual({
      mode: "single",
      activePaneId: "primary",
      primary: { orderedTabIds: [], activeTabId: null, pendingNavigation: null },
      secondary: { orderedTabIds: [], activeTabId: null, pendingNavigation: null },
      requestedSplitRatio: 0.5,
    });
  });

  it("opens primary tabs in local insertion order and deduplicates membership", () => {
    const opened = reduceSplitView(createInitialSplitViewState(), {
      type: "open-tab",
      paneId: "primary",
      tabId: "a",
    });
    const second = reduceSplitView(opened, {
      type: "open-tab",
      paneId: "primary",
      tabId: "b",
      anchor: "details",
    });
    const reopened = reduceSplitView(second, {
      type: "open-tab",
      paneId: "primary",
      tabId: "a",
    });
    expect(reopened.primary).toEqual({
      orderedTabIds: ["a", "b"],
      activeTabId: "a",
      pendingNavigation: null,
    });
  });

  it("allows the same document in both pane groups", () => {
    const split = reduceSplitView(
      stateWithPaneTabs({ mode: "single", primary: { orderedTabIds: ["a"] } }),
      { type: "enable-split" },
    );
    const shared = reduceSplitView(split, {
      type: "open-tab",
      paneId: "secondary",
      tabId: "a",
      anchor: "shared",
    });
    expect(shared.primary.orderedTabIds).toEqual(["a"]);
    expect(shared.secondary).toEqual({
      orderedTabIds: ["a"],
      activeTabId: "a",
      pendingNavigation: { tabId: "a", anchor: "shared" },
    });
    expect(shared.activePaneId).toBe("secondary");
  });

  it("selects only members and clears pending navigation", () => {
    const state = stateWithPaneTabs({
      primary: {
        orderedTabIds: ["a", "b"],
        activeTabId: "a",
        pendingNavigation: { tabId: "a", anchor: "old" },
      },
    });
    const selected = reduceSplitView(state, {
      type: "select-tab",
      paneId: "primary",
      tabId: "b",
    });
    expect(selected.primary.activeTabId).toBe("b");
    expect(selected.primary.pendingNavigation).toBeNull();
    expect(() =>
      reduceSplitView(state, { type: "select-tab", paneId: "primary", tabId: "missing" }),
    ).toThrow("not a member");
  });

  it("closes an active tab with right, left, then empty fallback", () => {
    const right = reduceSplitView(
      stateWithPaneTabs({
        primary: { orderedTabIds: ["a", "b", "c"], activeTabId: "b" },
      }),
      { type: "close-pane-tab", paneId: "primary", tabId: "b" },
    );
    expect(right.primary).toEqual({
      orderedTabIds: ["a", "c"],
      activeTabId: "c",
      pendingNavigation: null,
    });

    const left = reduceSplitView(right, {
      type: "close-pane-tab",
      paneId: "primary",
      tabId: "c",
    });
    expect(left.primary.activeTabId).toBe("a");
    const empty = reduceSplitView(left, {
      type: "close-pane-tab",
      paneId: "primary",
      tabId: "a",
    });
    expect(empty.primary).toEqual({
      orderedTabIds: [],
      activeTabId: null,
      pendingNavigation: null,
    });
  });

  it("keeps source selection, pending navigation, and the other group on non-active close", () => {
    const state = stateWithPaneTabs({
      primary: {
        orderedTabIds: ["a", "b"],
        activeTabId: "a",
        pendingNavigation: { tabId: "a", anchor: "keep" },
      },
      secondary: { orderedTabIds: ["b"] },
    });
    const closed = reduceSplitView(state, {
      type: "close-pane-tab",
      paneId: "primary",
      tabId: "b",
    });
    expect(closed.primary).toEqual({
      orderedTabIds: ["a"],
      activeTabId: "a",
      pendingNavigation: { tabId: "a", anchor: "keep" },
    });
    expect(closed.secondary).toBe(state.secondary);
    expect(getReferencedTabIds(closed)).toEqual(new Set(["a", "b"]));
  });

  it("moves an active tab atomically and selects the destination", () => {
    const moved = reduceSplitView(
      stateWithPaneTabs({
        primary: { orderedTabIds: ["a", "b"], activeTabId: "a" },
        secondary: { orderedTabIds: ["c"] },
      }),
      {
        type: "move-tab",
        sourcePaneId: "primary",
        destinationPaneId: "secondary",
        tabId: "a",
      },
    );
    expect(moved.primary).toEqual({
      orderedTabIds: ["b"],
      activeTabId: "b",
      pendingNavigation: null,
    });
    expect(moved.secondary).toEqual({
      orderedTabIds: ["c", "a"],
      activeTabId: "a",
      pendingNavigation: null,
    });
    expect(moved.activePaneId).toBe("secondary");
  });

  it("keeps a non-active source selection and deduplicates an existing destination", () => {
    const state = stateWithPaneTabs({
      primary: {
        orderedTabIds: ["a", "b"],
        activeTabId: "a",
        pendingNavigation: { tabId: "a", anchor: "keep" },
      },
      secondary: {
        orderedTabIds: ["b", "c"],
        activeTabId: "b",
        pendingNavigation: { tabId: "b", anchor: "destination" },
      },
    });
    const moved = reduceSplitView(state, {
      type: "move-tab",
      sourcePaneId: "primary",
      destinationPaneId: "secondary",
      tabId: "b",
    });
    expect(moved.primary).toEqual({
      orderedTabIds: ["a"],
      activeTabId: "a",
      pendingNavigation: { tabId: "a", anchor: "keep" },
    });
    expect(moved.secondary).toEqual(state.secondary);
  });

  it("moves the last source tab and clears changed destination pending navigation", () => {
    const moved = reduceSplitView(
      stateWithPaneTabs({
        primary: { orderedTabIds: ["a"] },
        secondary: {
          orderedTabIds: ["b"],
          pendingNavigation: { tabId: "b", anchor: "old" },
        },
      }),
      {
        type: "move-tab",
        sourcePaneId: "primary",
        destinationPaneId: "secondary",
        tabId: "a",
      },
    );
    expect(moved.primary.activeTabId).toBeNull();
    expect(moved.primary.orderedTabIds).toEqual([]);
    expect(moved.secondary.activeTabId).toBe("a");
    expect(moved.secondary.pendingNavigation).toBeNull();
  });

  it("rejects invalid move and unavailable secondary actions", () => {
    const single = stateWithPaneTabs({
      mode: "single",
      primary: { orderedTabIds: ["a"] },
      secondary: { orderedTabIds: ["b"] },
    });
    expect(() =>
      reduceSplitView(single, {
        type: "move-tab",
        sourcePaneId: "primary",
        destinationPaneId: "secondary",
        tabId: "a",
      }),
    ).toThrow("split view");
    for (const action of [
      { type: "open-tab", paneId: "secondary", tabId: "b" },
      { type: "select-tab", paneId: "secondary", tabId: "b" },
      { type: "close-pane-tab", paneId: "secondary", tabId: "b" },
      { type: "activate-pane", paneId: "secondary" },
    ] as const) {
      expect(() => reduceSplitView(single, action)).toThrow("unavailable");
    }

    const split = stateWithPaneTabs({ primary: { orderedTabIds: ["a"] } });
    expect(() =>
      reduceSplitView(split, {
        type: "move-tab",
        sourcePaneId: "primary",
        destinationPaneId: "primary",
        tabId: "a",
      }),
    ).toThrow("different");
    expect(() =>
      reduceSplitView(split, {
        type: "move-tab",
        sourcePaneId: "primary",
        destinationPaneId: "secondary",
        tabId: "missing",
      }),
    ).toThrow("not a member");
  });

  it("preserves both groups across split off and on while clearing hidden pending navigation", () => {
    const split = stateWithPaneTabs({
      activePaneId: "secondary",
      primary: { orderedTabIds: ["a"] },
      secondary: {
        orderedTabIds: ["b", "c"],
        activeTabId: "c",
        pendingNavigation: { tabId: "c", anchor: "hidden" },
      },
    });
    const single = reduceSplitView(split, { type: "disable-split" });
    expect(single.mode).toBe("single");
    expect(single.activePaneId).toBe("primary");
    expect(single.primary).toBe(split.primary);
    expect(single.secondary.orderedTabIds).toEqual(["b", "c"]);
    expect(single.secondary.activeTabId).toBe("c");
    expect(single.secondary.pendingNavigation).toBeNull();

    const enabled = reduceSplitView(single, { type: "enable-split" });
    expect(enabled.secondary.orderedTabIds).toEqual(["b", "c"]);
    expect(enabled.secondary.activeTabId).toBe("c");
    expect(enabled.activePaneId).toBe("primary");
  });

  it("keeps mode and ratio while resetting root groups", () => {
    const state = stateWithPaneTabs({
      requestedSplitRatio: 0.7,
      activePaneId: "secondary",
      primary: { orderedTabIds: ["a"] },
      secondary: { orderedTabIds: ["b"] },
    });
    const reset = reduceSplitView(state, { type: "reset-root" });
    expect(reset.mode).toBe("split");
    expect(reset.requestedSplitRatio).toBe(0.7);
    expect(reset.activePaneId).toBe("primary");
    expect(reset.primary.orderedTabIds).toEqual([]);
    expect(reset.secondary.orderedTabIds).toEqual([]);
  });

  it("consumes only matching navigation identity", () => {
    const state = stateWithPaneTabs({
      primary: {
        orderedTabIds: ["a"],
        pendingNavigation: { tabId: "a", anchor: "details" },
      },
    });
    expect(
      reduceSplitView(state, {
        type: "consume-navigation",
        paneId: "primary",
        tabId: "a",
        anchor: "other",
      }),
    ).toBe(state);
    expect(
      reduceSplitView(state, {
        type: "consume-navigation",
        paneId: "primary",
        tabId: "a",
        anchor: "details",
      }).primary.pendingNavigation,
    ).toBeNull();
  });

  it("rejects invalid group invariants", () => {
    const valid = stateWithPaneTabs({ primary: { orderedTabIds: ["a"] } });
    const invalidStates: SplitViewState[] = [
      { ...valid, primary: { ...valid.primary, orderedTabIds: ["a", "a"] } },
      { ...valid, primary: { ...valid.primary, activeTabId: "missing" } },
      { ...valid, primary: { ...valid.primary, activeTabId: null } },
      {
        ...valid,
        primary: {
          ...valid.primary,
          pendingNavigation: { tabId: "missing", anchor: "bad" },
        },
      },
      { ...valid, mode: "single", activePaneId: "secondary" },
    ];
    for (const state of invalidStates) {
      expect(() => reduceSplitView(state, { type: "enable-split" })).toThrow();
    }
  });

  it("resolves pane-local order, rejects missing IDs, and derives references", () => {
    const tabs = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(resolveGroupTabs(["c", "a"], tabs)).toEqual([{ id: "c" }, { id: "a" }]);
    expect(() => resolveGroupTabs(["missing"], tabs)).toThrow("missing tab");
    expect(() => resolveGroupTabs(["a", "a"], tabs)).toThrow("Duplicate IDs");
    expect(
      getReferencedTabIds(
        stateWithPaneTabs({
          primary: { orderedTabIds: ["a", "b"] },
          secondary: { orderedTabIds: ["b", "c"] },
        }),
      ),
    ).toEqual(new Set(["a", "b", "c"]));
  });

  it("rejects invalid ratios", () => {
    expect(() =>
      reduceSplitView(createInitialSplitViewState(), {
        type: "set-requested-ratio",
        ratio: Number.NaN,
      }),
    ).toThrow();
    expect(() => getPrimaryPaneWidth(1, 800)).toThrow();
  });
});

describe("split pane width policy", () => {
  it("returns null before measurement and at the separator width", () => {
    expect(getSplitPaneWidthBounds(null)).toBeNull();
    expect(getSplitPaneWidthBounds(Number.NaN)).toBeNull();
    expect(getSplitPaneWidthBounds(splitSeparatorWidth)).toBeNull();
    expect(getSplitPaneWidthBounds(splitSeparatorWidth + 1)).toBeNull();
    expect(getSplitRatioForKey("Home", initialSplitRatio, splitSeparatorWidth + 1)).toBeNull();
    expect(
      getRequestedRatioForPrimaryWidth(0, splitSeparatorWidth + 1, initialSplitRatio),
    ).toBe(initialSplitRatio);
  });

  it("uses preferred minimums in a normal workspace", () => {
    expect(getSplitPaneWidthBounds(1000)).toEqual({ min: 240, max: 754, available: 994 });
    expect(getPrimaryPaneWidth(0.5, 1000)).toBe(497);
  });

  it("shrinks to equal effective minimums in a narrow workspace", () => {
    expect(getSplitPaneWidthBounds(486)).toEqual({ min: 240, max: 240, available: 480 });
    expect(getSplitRatioForKey("ArrowRight", 0.7, 486)).toBeNull();
    expect(getRequestedRatioForPrimaryWidth(300, 486, 0.7)).toBe(0.7);
  });

  it("clamps without overwriting the requested ratio", () => {
    expect(getPrimaryPaneWidth(0.8, 600)).toBe(354);
    expect(getPrimaryPaneWidth(0.8, 1200)).toBe(954);
  });

  it("handles keyboard step, Home, End, and unrelated keys", () => {
    expect(getSplitRatioForKey("ArrowLeft", initialSplitRatio, 1000)).toBeCloseTo(481 / 994);
    expect(getSplitRatioForKey("ArrowRight", initialSplitRatio, 1000)).toBeCloseTo(513 / 994);
    expect(getSplitRatioForKey("Home", initialSplitRatio, 1000)).toBeCloseTo(240 / 994);
    expect(getSplitRatioForKey("End", initialSplitRatio, 1000)).toBeCloseTo(754 / 994);
    expect(getSplitRatioForKey("PageDown", initialSplitRatio, 1000)).toBeNull();
  });
});
