import { getPaneState, type PaneId, type SplitViewState } from "./splitView";

export type SharedTabLoadState = "loading" | "rendering" | "ready" | "error";
export type PanePreviewPhase =
  | "idle"
  | "rendering-mermaid"
  | "loading-html"
  | "ready"
  | "error";

export type PanePreviewStatus = {
  tabId: string;
  revision: number;
  phase: PanePreviewPhase;
  errorMessage: string | null;
};

export type PaneResultIdentity = {
  paneId: PaneId;
  tabId: string;
  revision: number;
};

export type TabIdentity = {
  id: string;
  revision: number;
};

export type TabPresentationInput = TabIdentity & {
  loadState: SharedTabLoadState;
};

export type TabAccessibilityState = {
  labelSuffix: "Loading" | "Rendering" | "Error" | null;
  busy: boolean;
};

export function resolveTabAccessibilityState(
  presentationState: SharedTabLoadState,
): TabAccessibilityState {
  switch (presentationState) {
    case "loading":
      return { labelSuffix: "Loading", busy: true };
    case "rendering":
      return { labelSuffix: "Rendering", busy: true };
    case "error":
      return { labelSuffix: "Error", busy: false };
    case "ready":
      return { labelSuffix: null, busy: false };
  }
}

export function isPaneSelectionCurrent(
  paneId: PaneId,
  tabId: string,
  splitViewState: SplitViewState,
): boolean {
  if (paneId === "secondary" && splitViewState.mode !== "split") {
    return false;
  }
  return getPaneState(splitViewState, paneId).activeTabId === tabId;
}

export function isTabRevisionCurrent(
  tabId: string,
  revision: number,
  tabIdentities: TabIdentity[],
): boolean {
  return tabIdentities.some((tab) => tab.id === tabId && tab.revision === revision);
}

export function isPaneResultCurrent(
  captured: PaneResultIdentity,
  splitViewState: SplitViewState,
  tabIdentities: TabIdentity[],
): boolean {
  return (
    isPaneSelectionCurrent(captured.paneId, captured.tabId, splitViewState) &&
    isTabRevisionCurrent(captured.tabId, captured.revision, tabIdentities)
  );
}

export function isPanePreviewStatusCurrent(
  paneId: PaneId,
  status: PanePreviewStatus | null,
  splitViewState: SplitViewState,
  tabIdentities: TabIdentity[],
): boolean {
  return status !== null && isPaneResultCurrent({ paneId, ...status }, splitViewState, tabIdentities);
}

export function resolvePaneTabPresentationState(
  tab: TabPresentationInput,
  paneId: PaneId,
  splitViewState: SplitViewState,
  panePreviewStatus: PanePreviewStatus | null,
): SharedTabLoadState {
  if (tab.loadState !== "ready") {
    return tab.loadState;
  }
  const pane = getPaneState(splitViewState, paneId);
  if (
    pane.activeTabId !== tab.id ||
    panePreviewStatus?.tabId !== tab.id ||
    panePreviewStatus.revision !== tab.revision
  ) {
    return tab.loadState;
  }
  switch (panePreviewStatus.phase) {
    case "loading-html":
      return "loading";
    case "rendering-mermaid":
      return "rendering";
    case "error":
      return "error";
    case "idle":
    case "ready":
      return "ready";
  }
}
