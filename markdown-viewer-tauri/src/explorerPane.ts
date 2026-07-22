export const initialExplorerWidth = 280;
export const minimumExplorerWidth = 180;
export const maximumExplorerWidth = 640;
export const previewReservedWidth = 320;
export const explorerSeparatorWidth = 6;
export const explorerKeyboardStep = 16;

export type ExplorerWidthBounds = {
  min: number;
  max: number;
};

export function getExplorerWidthBounds(workspaceWidth: number | null): ExplorerWidthBounds {
  if (workspaceWidth === null || !Number.isFinite(workspaceWidth) || workspaceWidth <= 0) {
    return { min: minimumExplorerWidth, max: maximumExplorerWidth };
  }

  return {
    min: minimumExplorerWidth,
    max: Math.max(
      minimumExplorerWidth,
      Math.min(maximumExplorerWidth, workspaceWidth - previewReservedWidth - explorerSeparatorWidth),
    ),
  };
}

export function clampExplorerWidth(width: number, workspaceWidth: number | null): number {
  const normalizedWidth = Number.isFinite(width) ? width : initialExplorerWidth;
  const bounds = getExplorerWidthBounds(workspaceWidth);
  return Math.min(bounds.max, Math.max(bounds.min, normalizedWidth));
}

export function getExplorerWidthForKey(
  key: string,
  currentWidth: number,
  workspaceWidth: number | null,
): number | null {
  const bounds = getExplorerWidthBounds(workspaceWidth);

  switch (key) {
    case "ArrowLeft":
      return clampExplorerWidth(currentWidth - explorerKeyboardStep, workspaceWidth);
    case "ArrowRight":
      return clampExplorerWidth(currentWidth + explorerKeyboardStep, workspaceWidth);
    case "Home":
      return bounds.min;
    case "End":
      return bounds.max;
    default:
      return null;
  }
}
