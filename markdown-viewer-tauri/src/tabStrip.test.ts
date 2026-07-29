import { describe, expect, it } from "vitest";
import {
  getTabRevealDelta,
  hasExceededTabDragThreshold,
  resolveTabDropPane,
} from "./tabStrip";

describe("tab reveal policy", () => {
  it.each([
    [0, 100, 10, 90, 4, 0],
    [0, 100, 4, 96, 4, 0],
    [0, 100, -10, 60, 4, -14],
    [0, 100, 40, 110, 4, 14],
    [0, 100, 0, 100, 0, 0],
  ])("returns the nearest reveal delta", (start, end, itemStart, itemEnd, padding, expected) => {
    expect(getTabRevealDelta(start, end, itemStart, itemEnd, padding)).toBe(expected);
  });

  it("aligns an oversized item to the left edge deterministically", () => {
    expect(getTabRevealDelta(0, 100, 30, 150, 4)).toBe(26);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite geometry: %s",
    (value) => {
      expect(() => getTabRevealDelta(0, 100, value, 90, 4)).toThrow("finite");
    },
  );
});

describe("tab drag threshold", () => {
  it("starts at the exact six pixel threshold", () => {
    expect(hasExceededTabDragThreshold(0, 0, 5, 0)).toBe(false);
    expect(hasExceededTabDragThreshold(0, 0, 6, 0)).toBe(true);
    expect(hasExceededTabDragThreshold(0, 0, 4, 4)).toBe(false);
    expect(hasExceededTabDragThreshold(0, 0, 5, 4)).toBe(true);
  });
});

describe("tab drop pane policy", () => {
  it.each([
    ["primary", "secondary", "split", "secondary"],
    ["secondary", "primary", "split", "primary"],
    ["primary", "primary", "split", null],
    ["primary", "unknown", "split", null],
    ["primary", null, "split", null],
    ["primary", "secondary", "single", null],
  ] as const)("narrows a candidate pane", (source, candidate, mode, expected) => {
    expect(resolveTabDropPane(source, candidate, mode)).toBe(expected);
  });
});
