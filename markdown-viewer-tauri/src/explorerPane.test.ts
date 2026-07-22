import { describe, expect, it } from "vitest";
import {
  clampExplorerWidth,
  getExplorerWidthBounds,
  getExplorerWidthForKey,
  initialExplorerWidth,
  maximumExplorerWidth,
  minimumExplorerWidth,
} from "./explorerPane";

describe("Explorer pane width policy", () => {
  it("uses the hard bounds before the workspace is measured", () => {
    expect(getExplorerWidthBounds(null)).toEqual({
      min: minimumExplorerWidth,
      max: maximumExplorerWidth,
    });
    expect(getExplorerWidthBounds(Number.NaN)).toEqual({
      min: minimumExplorerWidth,
      max: maximumExplorerWidth,
    });
    expect(getExplorerWidthBounds(0)).toEqual({
      min: minimumExplorerWidth,
      max: maximumExplorerWidth,
    });
  });

  it("reserves preview and separator width in an 800px workspace", () => {
    expect(getExplorerWidthBounds(800)).toEqual({ min: 180, max: 474 });
  });

  it("floors the maximum at the minimum in a narrow workspace", () => {
    expect(getExplorerWidthBounds(400)).toEqual({ min: 180, max: 180 });
  });

  it("keeps Home and End at the same valid bound in a narrow workspace", () => {
    expect(getExplorerWidthForKey("Home", 280, 400)).toBe(180);
    expect(getExplorerWidthForKey("End", 280, 400)).toBe(180);
  });

  it("clamps widths below, inside, and above the effective bounds", () => {
    expect(clampExplorerWidth(100, 800)).toBe(180);
    expect(clampExplorerWidth(320, 800)).toBe(320);
    expect(clampExplorerWidth(700, 800)).toBe(474);
  });

  it("normalizes non-finite requested widths to the initial width", () => {
    expect(clampExplorerWidth(Number.NaN, 800)).toBe(initialExplorerWidth);
    expect(clampExplorerWidth(Number.POSITIVE_INFINITY, 800)).toBe(initialExplorerWidth);
  });

  it("moves by the keyboard step without crossing effective bounds", () => {
    expect(getExplorerWidthForKey("ArrowLeft", 300, 800)).toBe(284);
    expect(getExplorerWidthForKey("ArrowRight", 300, 800)).toBe(316);
    expect(getExplorerWidthForKey("ArrowLeft", 180, 800)).toBe(180);
    expect(getExplorerWidthForKey("ArrowRight", 474, 800)).toBe(474);
  });

  it("moves Home and End to the current effective bounds", () => {
    expect(getExplorerWidthForKey("Home", 300, 800)).toBe(180);
    expect(getExplorerWidthForKey("End", 300, 800)).toBe(474);
  });

  it("does not handle unrelated keys", () => {
    expect(getExplorerWidthForKey("PageDown", 300, 800)).toBeNull();
  });
});
