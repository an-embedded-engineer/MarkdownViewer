import { type PaneId, type ViewMode } from "./splitView";

export const tabDragThreshold = 6;

function assertFiniteGeometry(values: number[]): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Tab reveal geometry must be finite");
  }
}

export function getTabRevealDelta(
  viewportStart: number,
  viewportEnd: number,
  itemStart: number,
  itemEnd: number,
  padding: number,
): number {
  assertFiniteGeometry([viewportStart, viewportEnd, itemStart, itemEnd, padding]);
  if (viewportEnd < viewportStart || itemEnd < itemStart || padding < 0) {
    throw new Error("Tab reveal geometry is invalid");
  }

  const visibleStart = viewportStart + padding;
  const visibleEnd = viewportEnd - padding;
  const visibleWidth = Math.max(0, visibleEnd - visibleStart);
  const itemWidth = itemEnd - itemStart;
  if (itemWidth > visibleWidth || itemStart < visibleStart) {
    return itemStart - visibleStart;
  }
  if (itemEnd > visibleEnd) {
    return itemEnd - visibleEnd;
  }
  return 0;
}

export function hasExceededTabDragThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): boolean {
  assertFiniteGeometry([startX, startY, currentX, currentY]);
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  return deltaX * deltaX + deltaY * deltaY >= tabDragThreshold * tabDragThreshold;
}

export function isPointInsideTabStrip(
  left: number,
  right: number,
  top: number,
  bottom: number,
  clientX: number,
  clientY: number,
): boolean {
  assertFiniteGeometry([left, right, top, bottom, clientX, clientY]);
  if (right < left || bottom < top) {
    throw new Error("Tab strip geometry is invalid");
  }
  return clientX >= left && clientX < right && clientY >= top && clientY < bottom;
}

export function shouldShowTabScrollbar(
  pointerInside: boolean,
  keyboardFocusInside: boolean,
): boolean {
  return pointerInside || keyboardFocusInside;
}

export function resolveTabDropPane(
  sourcePaneId: PaneId,
  candidatePaneId: string | null,
  mode: ViewMode,
): PaneId | null {
  if (mode !== "split") {
    return null;
  }
  if (
    (candidatePaneId === "primary" || candidatePaneId === "secondary") &&
    candidatePaneId !== sourcePaneId
  ) {
    return candidatePaneId;
  }
  return null;
}
