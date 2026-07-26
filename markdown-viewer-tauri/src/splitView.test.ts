import { describe, expect, it } from "vitest";
import {
  createInitialSplitViewState,
  getPrimaryPaneWidth,
  getRequestedRatioForPrimaryWidth,
  getSplitPaneWidthBounds,
  getSplitRatioForKey,
  initialSplitRatio,
  reduceSplitView,
  splitSeparatorWidth,
} from "./splitView";

describe("split view state policy", () => {
  it("creates a single primary view", () => {
    expect(createInitialSplitViewState("a")).toEqual({
      mode: "single",
      activePaneId: "primary",
      primary: { activeTabId: "a", pendingNavigation: null },
      secondary: { activeTabId: null, pendingNavigation: null },
      requestedSplitRatio: 0.5,
    });
  });

  it("selects the right adjacent tab when enabling split", () => {
    const state = reduceSplitView(createInitialSplitViewState("b"), {
      type: "enable-split",
      orderedTabIds: ["a", "b", "c"],
    });
    expect(state.mode).toBe("split");
    expect(state.activePaneId).toBe("primary");
    expect(state.secondary.activeTabId).toBe("c");
  });

  it("uses the left tab only when there is no right tab", () => {
    const state = reduceSplitView(createInitialSplitViewState("b"), {
      type: "enable-split",
      orderedTabIds: ["a", "b"],
    });
    expect(state.secondary.activeTabId).toBe("a");
  });

  it("leaves secondary empty for one tab or an empty primary", () => {
    expect(
      reduceSplitView(createInitialSplitViewState("a"), {
        type: "enable-split",
        orderedTabIds: ["a"],
      }).secondary.activeTabId,
    ).toBeNull();
    expect(
      reduceSplitView(createInitialSplitViewState(), {
        type: "enable-split",
        orderedTabIds: ["a", "b"],
      }).secondary.activeTabId,
    ).toBeNull();
  });

  it("keeps pane-local selections and navigation", () => {
    const split = reduceSplitView(createInitialSplitViewState("a"), {
      type: "enable-split",
      orderedTabIds: ["a", "b"],
    });
    const selected = reduceSplitView(split, {
      type: "select-tab",
      paneId: "secondary",
      tabId: "a",
      anchor: "details",
    });
    expect(selected.primary.activeTabId).toBe("a");
    expect(selected.secondary).toEqual({
      activeTabId: "a",
      pendingNavigation: { tabId: "a", anchor: "details" },
    });
    expect(selected.activePaneId).toBe("secondary");
    expect(
      reduceSplitView(selected, {
        type: "consume-navigation",
        paneId: "primary",
        tabId: "a",
        anchor: "details",
      }),
    ).toBe(selected);
  });

  it("inherits a selected active secondary pane when disabling split", () => {
    let state = reduceSplitView(createInitialSplitViewState("a"), {
      type: "enable-split",
      orderedTabIds: ["a", "b"],
    });
    state = reduceSplitView(state, {
      type: "select-tab",
      paneId: "secondary",
      tabId: "b",
      anchor: "target",
    });
    const single = reduceSplitView(state, {
      type: "disable-split",
      orderedTabIds: ["a", "b"],
    });
    expect(single.primary).toEqual({
      activeTabId: "b",
      pendingNavigation: { tabId: "b", anchor: "target" },
    });
    expect(single.secondary.activeTabId).toBeNull();
    expect(single.activePaneId).toBe("primary");
  });

  it("does not erase primary when an empty secondary is active", () => {
    let state = reduceSplitView(createInitialSplitViewState("a"), {
      type: "enable-split",
      orderedTabIds: ["a"],
    });
    state = reduceSplitView(state, { type: "activate-pane", paneId: "secondary" });
    expect(
      reduceSplitView(state, { type: "disable-split", orderedTabIds: ["a"] }).primary
        .activeTabId,
    ).toBe("a");
  });

  it("falls back to the first tab only when both panes are empty", () => {
    let state = reduceSplitView(createInitialSplitViewState(), {
      type: "enable-split",
      orderedTabIds: ["b", "c"],
    });
    state = reduceSplitView(state, { type: "activate-pane", paneId: "secondary" });
    expect(
      reduceSplitView(state, { type: "disable-split", orderedTabIds: ["b", "c"] })
        .primary.activeTabId,
    ).toBe("b");
  });

  it("updates every pane that references a closed tab", () => {
    let state = reduceSplitView(createInitialSplitViewState("a"), {
      type: "enable-split",
      orderedTabIds: ["a", "b"],
    });
    state = reduceSplitView(state, {
      type: "select-tab",
      paneId: "secondary",
      tabId: "a",
    });
    const closed = reduceSplitView(state, {
      type: "remove-tab",
      tabId: "a",
      fallbackTabId: "b",
    });
    expect(closed.primary.activeTabId).toBe("b");
    expect(closed.secondary.activeTabId).toBe("b");
  });

  it("keeps mode and ratio while resetting root selection", () => {
    const state = {
      ...reduceSplitView(createInitialSplitViewState("a"), {
        type: "enable-split" as const,
        orderedTabIds: ["a", "b"],
      }),
      requestedSplitRatio: 0.7,
    };
    const reset = reduceSplitView(state, { type: "reset-root" });
    expect(reset.mode).toBe("split");
    expect(reset.requestedSplitRatio).toBe(0.7);
    expect(reset.primary.activeTabId).toBeNull();
    expect(reset.secondary.activeTabId).toBeNull();
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
