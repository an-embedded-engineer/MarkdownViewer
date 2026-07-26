export const splitSeparatorWidth = 6;
export const preferredPaneMinimumWidth = 240;
export const splitKeyboardStep = 16;
export const initialSplitRatio = 0.5;

export type PaneId = "primary" | "secondary";
export type ViewMode = "single" | "split";

export type PendingPaneNavigation = {
  tabId: string;
  anchor: string;
};

export type PaneState = {
  activeTabId: string | null;
  pendingNavigation: PendingPaneNavigation | null;
};

export type SplitViewState = {
  mode: ViewMode;
  activePaneId: PaneId;
  primary: PaneState;
  secondary: PaneState;
  requestedSplitRatio: number;
};

export type SplitPaneWidthBounds = {
  min: number;
  max: number;
  available: number;
};

export type SplitViewAction =
  | { type: "select-tab"; paneId: PaneId; tabId: string | null; anchor?: string }
  | { type: "activate-pane"; paneId: PaneId }
  | { type: "enable-split"; orderedTabIds: string[] }
  | { type: "disable-split"; orderedTabIds: string[] }
  | { type: "remove-tab"; tabId: string; fallbackTabId: string | null }
  | { type: "reset-root" }
  | { type: "consume-navigation"; paneId: PaneId; tabId: string; anchor: string }
  | { type: "set-requested-ratio"; ratio: number };

const emptyPaneState = (): PaneState => ({ activeTabId: null, pendingNavigation: null });

export function createInitialSplitViewState(activeTabId: string | null = null): SplitViewState {
  return {
    mode: "single",
    activePaneId: "primary",
    primary: { activeTabId, pendingNavigation: null },
    secondary: emptyPaneState(),
    requestedSplitRatio: initialSplitRatio,
  };
}

export function getPaneState(state: SplitViewState, paneId: PaneId): PaneState {
  assertPaneId(paneId);
  return state[paneId];
}

export function reduceSplitView(state: SplitViewState, action: SplitViewAction): SplitViewState {
  switch (action.type) {
    case "select-tab": {
      assertPaneId(action.paneId);
      const pane = getPaneState(state, action.paneId);
      return {
        ...state,
        activePaneId: action.paneId,
        [action.paneId]: {
          ...pane,
          activeTabId: action.tabId,
          pendingNavigation:
            action.tabId !== null && action.anchor
              ? { tabId: action.tabId, anchor: action.anchor }
              : null,
        },
      };
    }
    case "activate-pane":
      assertPaneId(action.paneId);
      return { ...state, activePaneId: action.paneId };
    case "enable-split": {
      const primaryTabId = state.primary.activeTabId;
      return {
        ...state,
        mode: "split",
        activePaneId: "primary",
        secondary: {
          activeTabId: primaryTabId
            ? findAdjacentTabId(primaryTabId, action.orderedTabIds)
            : null,
          pendingNavigation: null,
        },
      };
    }
    case "disable-split": {
      const activePane = getPaneState(state, state.activePaneId);
      const inherited = activePane.activeTabId !== null ? activePane : state.primary;
      const primary =
        inherited.activeTabId !== null
          ? inherited
          : {
              activeTabId: action.orderedTabIds[0] ?? null,
              pendingNavigation: null,
            };
      return {
        ...state,
        mode: "single",
        activePaneId: "primary",
        primary,
        secondary: emptyPaneState(),
      };
    }
    case "remove-tab": {
      const removeFromPane = (pane: PaneState): PaneState =>
        pane.activeTabId === action.tabId
          ? { activeTabId: action.fallbackTabId, pendingNavigation: null }
          : {
              ...pane,
              pendingNavigation:
                pane.pendingNavigation?.tabId === action.tabId ? null : pane.pendingNavigation,
            };
      return {
        ...state,
        primary: removeFromPane(state.primary),
        secondary: removeFromPane(state.secondary),
      };
    }
    case "reset-root":
      return {
        ...state,
        activePaneId: "primary",
        primary: emptyPaneState(),
        secondary: emptyPaneState(),
      };
    case "consume-navigation": {
      assertPaneId(action.paneId);
      const pane = getPaneState(state, action.paneId);
      if (
        pane.activeTabId !== action.tabId ||
        pane.pendingNavigation?.tabId !== action.tabId ||
        pane.pendingNavigation.anchor !== action.anchor
      ) {
        return state;
      }
      return {
        ...state,
        [action.paneId]: { ...pane, pendingNavigation: null },
      };
    }
    case "set-requested-ratio":
      assertSplitRatio(action.ratio);
      return { ...state, requestedSplitRatio: action.ratio };
  }
}

export function findAdjacentTabId(activeTabId: string, orderedTabIds: string[]): string | null {
  const index = orderedTabIds.indexOf(activeTabId);
  if (index < 0) {
    return null;
  }
  return orderedTabIds[index + 1] ?? orderedTabIds[index - 1] ?? null;
}

export function getSplitPaneWidthBounds(
  workspaceWidth: number | null,
): SplitPaneWidthBounds | null {
  if (
    workspaceWidth === null ||
    !Number.isFinite(workspaceWidth) ||
    workspaceWidth <= splitSeparatorWidth
  ) {
    return null;
  }
  const available = workspaceWidth - splitSeparatorWidth;
  if (available < 2) {
    return null;
  }
  const min = Math.min(preferredPaneMinimumWidth, Math.floor(available / 2));
  return { min, max: available - min, available };
}

export function getPrimaryPaneWidth(
  requestedRatio: number,
  workspaceWidth: number | null,
): number | null {
  assertSplitRatio(requestedRatio);
  const bounds = getSplitPaneWidthBounds(workspaceWidth);
  if (!bounds) {
    return null;
  }
  return clamp(requestedRatio * bounds.available, bounds.min, bounds.max);
}

export function getRequestedRatioForPrimaryWidth(
  primaryWidth: number,
  workspaceWidth: number | null,
  currentRatio: number,
): number {
  assertSplitRatio(currentRatio);
  const bounds = getSplitPaneWidthBounds(workspaceWidth);
  if (!bounds || bounds.min === bounds.max || !Number.isFinite(primaryWidth)) {
    return currentRatio;
  }
  return clamp(primaryWidth, bounds.min, bounds.max) / bounds.available;
}

export function getSplitRatioForKey(
  key: string,
  currentRatio: number,
  workspaceWidth: number | null,
): number | null {
  assertSplitRatio(currentRatio);
  const bounds = getSplitPaneWidthBounds(workspaceWidth);
  if (!bounds || bounds.min === bounds.max) {
    return null;
  }
  const currentWidth = getPrimaryPaneWidth(currentRatio, workspaceWidth);
  if (currentWidth === null) {
    return null;
  }
  switch (key) {
    case "ArrowLeft":
      return getRequestedRatioForPrimaryWidth(
        currentWidth - splitKeyboardStep,
        workspaceWidth,
        currentRatio,
      );
    case "ArrowRight":
      return getRequestedRatioForPrimaryWidth(
        currentWidth + splitKeyboardStep,
        workspaceWidth,
        currentRatio,
      );
    case "Home":
      return bounds.min / bounds.available;
    case "End":
      return bounds.max / bounds.available;
    default:
      return null;
  }
}

function assertPaneId(paneId: PaneId): void {
  if (paneId !== "primary" && paneId !== "secondary") {
    throw new Error(`Unknown pane ID: ${String(paneId)}`);
  }
}

function assertSplitRatio(ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
    throw new Error(`Split ratio must be finite and between 0 and 1: ${ratio}`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
