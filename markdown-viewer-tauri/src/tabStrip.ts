import { type PaneId, type ViewMode } from "./splitView";

export const tabDragThreshold = 6;

export type TabStripDebugSnapshot = {
  paneId: PaneId;
  pointerInside: boolean;
  keyboardFocusInside: boolean;
  shouldShow: boolean;
  classVisible: boolean;
  rawPointInside: boolean | null;
  cssHover: boolean;
  focusWithin: boolean;
  thumbBackground: string;
  overflow: boolean;
  activeElement: string;
  lastEvent: string;
  pointer: string;
};

export function formatTabStripDebugLines(snapshot: TabStripDebugSnapshot): string[] {
  return [
    `state: pointerInside=${Number(snapshot.pointerInside)} keyboardFocusInside=${Number(snapshot.keyboardFocusInside)} shouldShow=${Number(snapshot.shouldShow)}`,
    `dom: classVisible=${Number(snapshot.classVisible)} rawPointInside=${snapshot.rawPointInside === null ? "-" : Number(snapshot.rawPointInside)} cssHover=${Number(snapshot.cssHover)} focusWithin=${Number(snapshot.focusWithin)}`,
    `scrollbar: thumbBackground=${snapshot.thumbBackground || "-"} overflow=${Number(snapshot.overflow)}`,
    `context: activeElement=${snapshot.activeElement} lastEvent=${snapshot.lastEvent} pointer=${snapshot.pointer}`,
  ];
}

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
  leadingPeekStart: number = itemStart,
  trailingPeekEnd: number = itemEnd,
): number {
  assertFiniteGeometry([
    viewportStart,
    viewportEnd,
    itemStart,
    itemEnd,
    padding,
    leadingPeekStart,
    trailingPeekEnd,
  ]);
  if (
    viewportEnd < viewportStart ||
    itemEnd < itemStart ||
    padding < 0 ||
    leadingPeekStart > itemStart ||
    trailingPeekEnd < itemEnd
  ) {
    throw new Error("Tab reveal geometry is invalid");
  }

  const visibleStart = viewportStart + padding;
  const visibleEnd = viewportEnd - padding;
  const visibleWidth = Math.max(0, visibleEnd - visibleStart);
  const itemWidth = itemEnd - itemStart;
  if (itemWidth > visibleWidth) {
    return itemStart - visibleStart;
  }
  if (itemStart < visibleStart) {
    const contextDelta = leadingPeekStart - visibleStart;
    const minimumDeltaForItemEnd = itemEnd - visibleEnd;
    return Math.max(contextDelta, minimumDeltaForItemEnd);
  }
  if (itemEnd > visibleEnd) {
    const contextDelta = trailingPeekEnd - visibleEnd;
    const maximumDeltaForItemStart = itemStart - visibleStart;
    return Math.min(contextDelta, maximumDeltaForItemStart);
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
