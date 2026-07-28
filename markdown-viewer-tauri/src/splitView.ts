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
  orderedTabIds: string[];
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
  | { type: "open-tab"; paneId: PaneId; tabId: string; anchor?: string }
  | { type: "select-tab"; paneId: PaneId; tabId: string }
  | { type: "activate-pane"; paneId: PaneId }
  | { type: "enable-split" }
  | { type: "disable-split" }
  | { type: "close-pane-tab"; paneId: PaneId; tabId: string }
  | {
      type: "move-tab";
      sourcePaneId: PaneId;
      destinationPaneId: PaneId;
      tabId: string;
    }
  | { type: "reset-root" }
  | { type: "consume-navigation"; paneId: PaneId; tabId: string; anchor: string }
  | { type: "set-requested-ratio"; ratio: number };

const emptyPaneState = (): PaneState => ({
  orderedTabIds: [],
  activeTabId: null,
  pendingNavigation: null,
});

export function createInitialSplitViewState(): SplitViewState {
  return {
    mode: "single",
    activePaneId: "primary",
    primary: emptyPaneState(),
    secondary: emptyPaneState(),
    requestedSplitRatio: initialSplitRatio,
  };
}

export function getPaneState(state: SplitViewState, paneId: PaneId): PaneState {
  assertPaneId(paneId);
  return state[paneId];
}

export function reduceSplitView(state: SplitViewState, action: SplitViewAction): SplitViewState {
  assertSplitViewState(state);
  let next: SplitViewState;
  switch (action.type) {
    case "open-tab": {
      assertPaneAvailable(state, action.paneId);
      const pane = getPaneState(state, action.paneId);
      next = {
        ...state,
        activePaneId: action.paneId,
        [action.paneId]: {
          orderedTabIds: pane.orderedTabIds.includes(action.tabId)
            ? pane.orderedTabIds
            : [...pane.orderedTabIds, action.tabId],
          activeTabId: action.tabId,
          pendingNavigation: action.anchor
            ? { tabId: action.tabId, anchor: action.anchor }
            : null,
        },
      };
      break;
    }
    case "select-tab": {
      assertPaneAvailable(state, action.paneId);
      const pane = getPaneState(state, action.paneId);
      assertPaneMember(pane, action.tabId, action.paneId);
      next = {
        ...state,
        activePaneId: action.paneId,
        [action.paneId]: {
          ...pane,
          activeTabId: action.tabId,
          pendingNavigation: null,
        },
      };
      break;
    }
    case "activate-pane":
      assertPaneAvailable(state, action.paneId);
      next = { ...state, activePaneId: action.paneId };
      break;
    case "enable-split":
      next = {
        ...state,
        mode: "split",
        activePaneId: "primary",
      };
      break;
    case "disable-split":
      next = {
        ...state,
        mode: "single",
        activePaneId: "primary",
        secondary: { ...state.secondary, pendingNavigation: null },
      };
      break;
    case "close-pane-tab": {
      assertPaneAvailable(state, action.paneId);
      const pane = getPaneState(state, action.paneId);
      assertPaneMember(pane, action.tabId, action.paneId);
      const isActive = pane.activeTabId === action.tabId;
      next = {
        ...state,
        [action.paneId]: {
          orderedTabIds: pane.orderedTabIds.filter((tabId) => tabId !== action.tabId),
          activeTabId: isActive
            ? findAdjacentTabId(action.tabId, pane.orderedTabIds)
            : pane.activeTabId,
          pendingNavigation: isActive ? null : pane.pendingNavigation,
        },
      };
      break;
    }
    case "move-tab": {
      if (state.mode !== "split") {
        throw new Error("Tabs can only move between panes in split view");
      }
      if (action.sourcePaneId === action.destinationPaneId) {
        throw new Error("Source and destination panes must be different");
      }
      assertPaneId(action.sourcePaneId);
      assertPaneId(action.destinationPaneId);
      const source = getPaneState(state, action.sourcePaneId);
      const destination = getPaneState(state, action.destinationPaneId);
      assertPaneMember(source, action.tabId, action.sourcePaneId);
      const sourceWasActive = source.activeTabId === action.tabId;
      const destinationSelectionChanged = destination.activeTabId !== action.tabId;
      next = {
        ...state,
        activePaneId: action.destinationPaneId,
        [action.sourcePaneId]: {
          orderedTabIds: source.orderedTabIds.filter((tabId) => tabId !== action.tabId),
          activeTabId: sourceWasActive
            ? findAdjacentTabId(action.tabId, source.orderedTabIds)
            : source.activeTabId,
          pendingNavigation: sourceWasActive ? null : source.pendingNavigation,
        },
        [action.destinationPaneId]: {
          orderedTabIds: destination.orderedTabIds.includes(action.tabId)
            ? destination.orderedTabIds
            : [...destination.orderedTabIds, action.tabId],
          activeTabId: action.tabId,
          pendingNavigation: destinationSelectionChanged
            ? null
            : destination.pendingNavigation,
        },
      };
      break;
    }
    case "reset-root":
      next = {
        ...state,
        activePaneId: "primary",
        primary: emptyPaneState(),
        secondary: emptyPaneState(),
      };
      break;
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
      next = {
        ...state,
        [action.paneId]: { ...pane, pendingNavigation: null },
      };
      break;
    }
    case "set-requested-ratio":
      assertSplitRatio(action.ratio);
      next = { ...state, requestedSplitRatio: action.ratio };
      break;
  }
  assertSplitViewState(next);
  return next;
}

export function getReferencedTabIds(state: SplitViewState): Set<string> {
  return new Set([...state.primary.orderedTabIds, ...state.secondary.orderedTabIds]);
}

export function resolveGroupTabs<T extends { id: string }>(
  orderedTabIds: string[],
  tabs: T[],
): T[] {
  assertUniqueIds(orderedTabIds, "pane tab group");
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  return orderedTabIds.map((tabId) => {
    const tab = tabsById.get(tabId);
    if (!tab) {
      throw new Error(`Pane tab group references missing tab: ${tabId}`);
    }
    return tab;
  });
}

function findAdjacentTabId(activeTabId: string, orderedTabIds: string[]): string | null {
  const index = orderedTabIds.indexOf(activeTabId);
  if (index < 0) {
    return null;
  }
  return orderedTabIds[index + 1] ?? orderedTabIds[index - 1] ?? null;
}

function assertPaneAvailable(state: SplitViewState, paneId: PaneId): void {
  assertPaneId(paneId);
  if (paneId === "secondary" && state.mode !== "split") {
    throw new Error("Secondary pane is unavailable in single view");
  }
}

function assertPaneMember(pane: PaneState, tabId: string, paneId: PaneId): void {
  if (!pane.orderedTabIds.includes(tabId)) {
    throw new Error(`Tab ${tabId} is not a member of the ${paneId} pane`);
  }
}

function assertSplitViewState(state: SplitViewState): void {
  assertPaneId(state.activePaneId);
  assertSplitRatio(state.requestedSplitRatio);
  if (state.mode !== "single" && state.mode !== "split") {
    throw new Error(`Unknown view mode: ${String(state.mode)}`);
  }
  if (state.mode === "single" && state.activePaneId !== "primary") {
    throw new Error("Single view must keep the primary pane active");
  }
  for (const paneId of ["primary", "secondary"] as const) {
    const pane = state[paneId];
    assertUniqueIds(pane.orderedTabIds, `${paneId} pane tab group`);
    if (pane.orderedTabIds.length === 0 && pane.activeTabId !== null) {
      throw new Error(`Empty ${paneId} pane cannot have an active tab`);
    }
    if (pane.orderedTabIds.length > 0 && pane.activeTabId === null) {
      throw new Error(`Non-empty ${paneId} pane must have an active tab`);
    }
    if (pane.activeTabId !== null && !pane.orderedTabIds.includes(pane.activeTabId)) {
      throw new Error(`Active tab is not a member of the ${paneId} pane`);
    }
    if (
      pane.pendingNavigation !== null &&
      pane.pendingNavigation.tabId !== pane.activeTabId
    ) {
      throw new Error(`Pending navigation does not match the ${paneId} active tab`);
    }
  }
}

function assertUniqueIds(ids: string[], description: string): void {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate IDs in ${description}`);
  }
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
