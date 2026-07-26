import { describe, expect, it } from "vitest";
import {
  clampImageViewerTransform,
  createImageViewerFitTransform,
  createImageViewerResetTransform,
  getImageViewerFitScale,
  getImageViewerPanBounds,
  getImageViewerWheelFactor,
  panImageViewerTransform,
  resizeImageViewerTransform,
  resolveIntrinsicSize,
  zoomImageViewerTransform,
  type ImageViewerGeometry,
} from "./imageViewer";

const geometry: ImageViewerGeometry = {
  intrinsicWidth: 1600,
  intrinsicHeight: 900,
  viewportWidth: 1000,
  viewportHeight: 700,
  padding: 24,
};

describe("image viewer transform policy", () => {
  it("fits large, small, and narrow-screen images without enlarging above 100%", () => {
    expect(getImageViewerFitScale(geometry)).toBe(0.595);
    expect(
      getImageViewerFitScale({ ...geometry, intrinsicWidth: 400, intrinsicHeight: 300 }),
    ).toBe(1);
    expect(
      getImageViewerFitScale({ ...geometry, viewportWidth: 360, padding: 12 }),
    ).toBeCloseTo(0.21);
    expect(
      getImageViewerFitScale({ ...geometry, intrinsicWidth: 600, intrinsicHeight: 2000 }),
    ).toBe(0.326);
  });

  it("rejects invalid geometry and transform values", () => {
    expect(() => getImageViewerFitScale({ ...geometry, intrinsicWidth: 0 })).toThrow(RangeError);
    expect(() => getImageViewerFitScale({ ...geometry, viewportHeight: Number.NaN })).toThrow(
      RangeError,
    );
    expect(() =>
      clampImageViewerTransform(
        { scale: Number.POSITIVE_INFINITY, offsetX: 0, offsetY: 0, mode: "custom" },
        geometry,
      ),
    ).toThrow(RangeError);
  });

  it("clamps zoom between the current fit scale and 800%", () => {
    const fit = createImageViewerFitTransform(geometry);
    expect(zoomImageViewerTransform(fit, geometry, 0.01).scale).toBeCloseTo(fit.scale);
    expect(zoomImageViewerTransform(fit, geometry, 100).scale).toBe(8);
  });

  it("keeps a pointer-anchored image coordinate stable when bounds do not clamp", () => {
    const roomy = { ...geometry, intrinsicWidth: 3000, intrinsicHeight: 2000 };
    const current = { scale: 1, offsetX: 80, offsetY: -40, mode: "custom" as const };
    const anchor = { x: 150, y: 90 };
    const before = {
      x: (anchor.x - current.offsetX) / current.scale,
      y: (anchor.y - current.offsetY) / current.scale,
    };
    const next = zoomImageViewerTransform(current, roomy, 1.25, anchor);
    expect((anchor.x - next.offsetX) / next.scale).toBeCloseTo(before.x);
    expect((anchor.y - next.offsetY) / next.scale).toBeCloseTo(before.y);
  });

  it("scales a non-zero offset around the viewport center", () => {
    const roomy = { ...geometry, intrinsicWidth: 3000, intrinsicHeight: 2000 };
    const next = zoomImageViewerTransform(
      { scale: 1, offsetX: 100, offsetY: -60, mode: "custom" },
      roomy,
      1.25,
    );
    expect(next.offsetX).toBe(125);
    expect(next.offsetY).toBe(-75);
  });

  it("clamps only the overflowing pan axis", () => {
    const wide = { ...geometry, intrinsicWidth: 2000, intrinsicHeight: 100 };
    const next = panImageViewerTransform(
      { scale: 1, offsetX: 0, offsetY: 0, mode: "custom" },
      wide,
      { x: 5000, y: 5000 },
    );
    expect(next.offsetX).toBe(getImageViewerPanBounds(wide, 1).x);
    expect(next.offsetY).toBe(0);
  });

  it("clamps drag and keyboard-equivalent pan deltas at each edge", () => {
    const start = createImageViewerResetTransform(geometry);
    const right = panImageViewerTransform(start, geometry, { x: 10000, y: 48 });
    const bounds = getImageViewerPanBounds(geometry, 1);
    expect(right.offsetX).toBe(bounds.x);
    expect(right.offsetY).toBe(48);
    expect(panImageViewerTransform(right, geometry, { x: 160, y: -10000 }).offsetY).toBe(
      -bounds.y,
    );
  });

  it("resets to natural size and center", () => {
    expect(createImageViewerResetTransform(geometry)).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      mode: "custom",
    });
  });

  it("refits fit mode but preserves and clamps custom mode on resize", () => {
    const resized = { ...geometry, viewportWidth: 600, viewportHeight: 400 };
    expect(resizeImageViewerTransform(createImageViewerFitTransform(geometry), resized)).toEqual(
      createImageViewerFitTransform(resized),
    );
    const custom = resizeImageViewerTransform(
      { scale: 2, offsetX: 10000, offsetY: -10000, mode: "custom" },
      resized,
    );
    expect(custom.scale).toBe(2);
    const bounds = getImageViewerPanBounds(resized, 2);
    expect(custom.offsetX).toBe(bounds.x);
    expect(custom.offsetY).toBe(-bounds.y);
  });

  it("normalizes wheel delta modes and clamps each event factor", () => {
    expect(getImageViewerWheelFactor(10, 0, 700)).toBeCloseTo(Math.exp(-0.02));
    expect(getImageViewerWheelFactor(1, 1, 700)).toBeCloseTo(Math.exp(-0.032));
    expect(getImageViewerWheelFactor(1, 2, 700)).toBeCloseTo(Math.exp(-0.2));
    expect(getImageViewerWheelFactor(-10000, 0, 700)).toBeCloseTo(Math.exp(0.2));
  });
});

describe("image viewer intrinsic size policy", () => {
  it("prefers a valid viewBox", () => {
    expect(
      resolveIntrinsicSize({
        viewBox: { width: 800, height: 600 },
        explicit: { width: 400, height: 300 },
        bounds: { width: 200, height: 100 },
      }),
    ).toEqual({ width: 800, height: 600 });
  });

  it("falls back through explicit size and rendered bounds", () => {
    expect(
      resolveIntrinsicSize({
        viewBox: { width: 0, height: 600 },
        explicit: { width: 400, height: 300 },
        bounds: { width: 200, height: 100 },
      }),
    ).toEqual({ width: 400, height: 300 });
    expect(
      resolveIntrinsicSize({
        explicit: { width: Number.NaN, height: 300 },
        bounds: { width: 200, height: 100 },
      }),
    ).toEqual({ width: 200, height: 100 });
    expect(resolveIntrinsicSize({ bounds: { width: 0, height: 0 } })).toBeNull();
  });
});
