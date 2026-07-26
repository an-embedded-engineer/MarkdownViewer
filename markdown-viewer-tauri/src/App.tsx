import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import MarkdownIt from "markdown-it";
import mermaid from "mermaid";
import "./App.css";
import {
  evaluateHtmlBridgeMessage,
  hasHtmlReadyHandshakeTimedOut,
  htmlReadyTimeoutMs,
  parseOpenDocumentResponse,
  withPreviewRevision,
  type DocumentType,
  type FileNodeType,
} from "./documentPolicy";
import {
  clampExplorerWidth,
  getExplorerWidthBounds,
  getExplorerWidthForKey,
  initialExplorerWidth,
} from "./explorerPane";
import {
  createImageViewerDomAdapter,
  createImageViewerFitTransform,
  createImageViewerResetTransform,
  getImageViewerActivation,
  getImageViewerFitScale,
  getImageViewerWheelFactor,
  imageViewerButtonZoomInFactor,
  imageViewerButtonZoomOutFactor,
  imageViewerMaximumScale,
  panImageViewerTransform,
  resizeImageViewerTransform,
  resolveImageViewerSource,
  zoomImageViewerTransform,
  type ImageViewerGeometry,
  type ImageViewerRequest,
  type ImageViewerTransform,
} from "./imageViewer";
import {
  isPanePreviewStatusCurrent,
  isPaneResultCurrent,
  resolvePaneTabPresentationState,
  type PanePreviewPhase,
  type PanePreviewStatus,
} from "./paneRuntime";
import {
  createInitialSplitViewState,
  getPaneState,
  getPrimaryPaneWidth,
  getRequestedRatioForPrimaryWidth,
  getSplitPaneWidthBounds,
  getSplitRatioForKey,
  reduceSplitView,
  type PaneId,
  type SplitViewAction,
  type SplitViewState,
} from "./splitView";

type FileTreeNode = {
  name: string;
  path: string;
  relativePath: string;
  nodeType: FileNodeType;
  children: FileTreeNode[];
};

type Theme = "light" | "dark";

type PlantUmlDiagramResult = {
  ok: boolean;
  html: string;
  error: string | null;
};

type PlantUmlRenderResponse = {
  diagrams: PlantUmlDiagramResult[];
  firstError: string | null;
};

type TabLoadState = "loading" | "rendering" | "ready" | "error";

type OpenDocumentTab = {
  id: string;
  path: string;
  displayName: string;
  documentType: DocumentType;
  sourceText: string | null;
  previewUrl: string | null;
  revision: number;
  loadState: TabLoadState;
  errorMessage: string | null;
  plantUmlDiagrams: PlantUmlDiagramResult[];
};

type RecentFolderEntry = {
  path: string;
  name: string;
  lastOpenedAt: string;
};

type WindowSize = {
  width: number;
  height: number;
};

type ViewerSettings = {
  theme: Theme;
  windowSize: WindowSize;
  plantUmlJarPath: string | null;
};

type ViewerSettingsLoadResult = {
  settings: ViewerSettings;
  warnings: string[];
};

type ViewerPreferencesDraft = {
  theme: Theme;
  plantUmlJarPath: string;
};

type ActiveMenu = "file" | "view" | null;

type ExplorerResizeState = {
  pointerId: number;
  startClientX: number;
  startWidth: number;
};

type SplitResizeState = {
  pointerId: number;
  startClientX: number;
  startPrimaryWidth: number;
};

type PaneImageViewerRequest = ImageViewerRequest & { paneId: PaneId };

type PanePreviewElements = Record<PaneId, HTMLElement | null>;

const markdownExtensions = new Set(["md", "markdown"]);
const externalUrlPattern = /^(https?:)?\/\//i;
const defaultWindowSize: WindowSize = { width: 800, height: 600 };
const windowResizeSaveDelay = 500;

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [tabs, setTabs] = useState<OpenDocumentTab[]>([]);
  const [splitViewState, setSplitViewState] = useState(createInitialSplitViewState);
  const [panePreviewStatuses, setPanePreviewStatuses] = useState<
    Record<PaneId, PanePreviewStatus | null>
  >({ primary: null, secondary: null });
  const [theme, setTheme] = useState<Theme>("light");
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings | null>(null);
  const [currentWindowSize, setCurrentWindowSize] = useState<WindowSize>(defaultWindowSize);
  const [settingsDraft, setSettingsDraft] = useState<ViewerPreferencesDraft | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [appConfigError, setAppConfigError] = useState<string | null>(null);
  const [rootOperationError, setRootOperationError] = useState<string | null>(null);
  const [isRootLoading, setIsRootLoading] = useState(false);
  const [isStartupConfigLoading, setIsStartupConfigLoading] = useState(true);
  const [foregroundConfigOperationCount, setForegroundConfigOperationCount] = useState(0);
  const [recentFolders, setRecentFolders] = useState<RecentFolderEntry[]>([]);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [requestedExplorerWidth, setRequestedExplorerWidth] = useState(initialExplorerWidth);
  const [workspaceWidth, setWorkspaceWidth] = useState<number | null>(null);
  const [isExplorerResizing, setIsExplorerResizing] = useState(false);
  const [splitWorkspaceWidth, setSplitWorkspaceWidth] = useState<number | null>(null);
  const [isSplitResizing, setIsSplitResizing] = useState(false);
  const [imageViewerRequest, setImageViewerRequest] = useState<PaneImageViewerRequest | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const previewWorkspaceRef = useRef<HTMLElement>(null);
  const explorerResizeRef = useRef<ExplorerResizeState | null>(null);
  const splitResizeRef = useRef<SplitResizeState | null>(null);
  const menuBarRef = useRef<HTMLElement>(null);
  const fileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<OpenDocumentTab[]>([]);
  const splitViewRef = useRef<SplitViewState>(splitViewState);
  const panePreviewStatusesRef = useRef(panePreviewStatuses);
  const panePreviewElementsRef = useRef<PanePreviewElements>({
    primary: null,
    secondary: null,
  });
  const mermaidQueueRef = useRef<Promise<void>>(Promise.resolve());
  const nextTabIdRef = useRef(1);
  const imageViewerFocusReturnRef = useRef<HTMLElement | null>(null);

  splitViewRef.current = splitViewState;
  panePreviewStatusesRef.current = panePreviewStatuses;
  const activePane = getPaneState(splitViewState, splitViewState.activePaneId);
  const activeTab = tabs.find((tab) => tab.id === activePane.activeTabId) ?? null;
  const activePaneStatus = panePreviewStatuses[splitViewState.activePaneId];
  const currentActivePaneStatus =
    activePaneStatus &&
    activeTab &&
    activePaneStatus.tabId === activeTab.id &&
    activePaneStatus.revision === activeTab.revision
      ? activePaneStatus
      : null;
  const explorerWidth = clampExplorerWidth(requestedExplorerWidth, workspaceWidth);
  const explorerWidthBounds = getExplorerWidthBounds(workspaceWidth);
  const splitWidthBounds = getSplitPaneWidthBounds(splitWorkspaceWidth);
  const primaryPaneWidth = getPrimaryPaneWidth(
    splitViewState.requestedSplitRatio,
    splitWorkspaceWidth,
  );
  const isAppConfigBusy = isStartupConfigLoading || foregroundConfigOperationCount > 0;
  const isGlobalBusy = isRootLoading || isAppConfigBusy;
  const errorMessage =
    appConfigError ??
    rootOperationError ??
    activeTab?.errorMessage ??
    currentActivePaneStatus?.errorMessage ??
    null;
  const loadingMessage = isRootLoading
    ? "Loading folder..."
    : isAppConfigBusy
      ? "Updating app settings..."
      : activeTab?.loadState === "loading"
        ? activeTab.documentType === "html"
          ? "Loading HTML..."
          : "Loading Markdown..."
        : activeTab?.loadState === "rendering"
          ? "Rendering PlantUML diagrams..."
          : currentActivePaneStatus?.phase === "loading-html"
            ? "Loading HTML preview..."
            : currentActivePaneStatus?.phase === "rendering-mermaid"
              ? "Rendering Mermaid diagrams..."
              : null;

  function handleExplorerPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || explorerResizeRef.current) {
      return;
    }

    event.currentTarget.focus();
    explorerResizeRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth: explorerWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsExplorerResizing(true);
    event.preventDefault();
  }

  function handleExplorerPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const resize = explorerResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    setRequestedExplorerWidth(
      clampExplorerWidth(resize.startWidth + event.clientX - resize.startClientX, workspaceWidth),
    );
  }

  function finishExplorerResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = explorerResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    explorerResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsExplorerResizing(false);
  }

  function handleExplorerLostPointerCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (explorerResizeRef.current?.pointerId !== event.pointerId) {
      return;
    }

    explorerResizeRef.current = null;
    setIsExplorerResizing(false);
  }

  function handleExplorerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const nextWidth = getExplorerWidthForKey(event.key, explorerWidth, workspaceWidth);
    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    setRequestedExplorerWidth(nextWidth);
  }

  function applySplitView(action: SplitViewAction): SplitViewState {
    const next = reduceSplitView(splitViewRef.current, action);
    splitViewRef.current = next;
    setSplitViewState(next);
    return next;
  }

  function setPanePreviewStatus(paneId: PaneId, status: PanePreviewStatus | null) {
    const next = { ...panePreviewStatusesRef.current, [paneId]: status };
    panePreviewStatusesRef.current = next;
    setPanePreviewStatuses(next);
  }

  function updatePanePreviewPhase(
    paneId: PaneId,
    tabId: string,
    revision: number,
    phase: PanePreviewPhase,
    errorMessage: string | null = null,
  ) {
    if (
      !isPaneResultCurrent(
        { paneId, tabId, revision },
        splitViewRef.current,
        tabsRef.current,
      )
    ) {
      return;
    }
    setPanePreviewStatus(paneId, { tabId, revision, phase, errorMessage });
  }

  function enqueueMermaidTask(task: () => Promise<void>): Promise<void> {
    const queued = mermaidQueueRef.current.then(task, task);
    mermaidQueueRef.current = queued.catch(() => undefined);
    return queued;
  }

  function handleSplitPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      splitResizeRef.current ||
      primaryPaneWidth === null ||
      !splitWidthBounds ||
      splitWidthBounds.min === splitWidthBounds.max
    ) {
      return;
    }
    event.currentTarget.focus();
    splitResizeRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startPrimaryWidth: primaryPaneWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsSplitResizing(true);
    event.preventDefault();
  }

  function handleSplitPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const resize = splitResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    const ratio = getRequestedRatioForPrimaryWidth(
      resize.startPrimaryWidth + event.clientX - resize.startClientX,
      splitWorkspaceWidth,
      splitViewRef.current.requestedSplitRatio,
    );
    if (ratio !== splitViewRef.current.requestedSplitRatio) {
      applySplitView({ type: "set-requested-ratio", ratio });
    }
  }

  function finishSplitResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = splitResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    splitResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsSplitResizing(false);
  }

  function handleSplitLostPointerCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (splitResizeRef.current?.pointerId !== event.pointerId) {
      return;
    }
    splitResizeRef.current = null;
    setIsSplitResizing(false);
  }

  function handleSplitKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const ratio = getSplitRatioForKey(
      event.key,
      splitViewRef.current.requestedSplitRatio,
      splitWorkspaceWidth,
    );
    if (ratio === null) {
      return;
    }
    event.preventDefault();
    applySplitView({ type: "set-requested-ratio", ratio });
  }

  function updateTabs(updater: (current: OpenDocumentTab[]) => OpenDocumentTab[]) {
    const next = updater(tabsRef.current);
    tabsRef.current = next;
    setTabs(next);
  }

  function updateTabIfCurrent(
    tabId: string,
    revision: number,
    updater: (tab: OpenDocumentTab) => OpenDocumentTab,
  ) {
    updateTabs((current) =>
      current.map((tab) => (tab.id === tabId && tab.revision === revision ? updater(tab) : tab)),
    );
  }

  async function runForegroundConfigOperation<T>(operation: () => Promise<T>) {
    setForegroundConfigOperationCount((count) => count + 1);
    try {
      return await operation();
    } finally {
      setForegroundConfigOperationCount((count) => Math.max(0, count - 1));
    }
  }

  async function openFolder() {
    if (isGlobalBusy) {
      return;
    }

    setRootOperationError(null);

    const selected = await openDialog({
      directory: true,
      multiple: false,
      recursive: true,
      title: "Open Document Folder",
    });

    if (typeof selected !== "string") {
      return;
    }

    await loadRoot(selected, { recordRecent: true });
  }

  async function loadRoot(path: string, options: { recordRecent?: boolean } = {}) {
    setIsRootLoading(true);
    setRootOperationError(null);
    try {
      const tree = await invoke<FileTreeNode>("scan_directory", {
        rootPath: path,
      });
      setRootPath(path);
      setFileTree(tree);
      setIsRootLoading(false);
      updateTabs(() => []);
      applySplitView({ type: "reset-root" });
      setPanePreviewStatus("primary", null);
      setPanePreviewStatus("secondary", null);

      const initialFile = findReadme(tree) ?? findFirstMarkdown(tree) ?? findFirstHtml(tree);
      if (initialFile) {
        openOrActivateTab("primary", initialFile.path);
      }

      if (options.recordRecent) {
        const recentError = await recordRecentFolder(path);
        if (recentError) {
          setRootOperationError(recentError);
        }
      }
    } catch (error) {
      setRootOperationError(toErrorMessage(error));
    } finally {
      setIsRootLoading(false);
    }
  }

  async function recordRecentFolder(path: string) {
    try {
      const entries = await runForegroundConfigOperation(() =>
        invoke<RecentFolderEntry[]>("record_recent_folder", { path }),
      );
      setRecentFolders(entries);
      return null;
    } catch (error) {
      return toErrorMessage(error);
    }
  }

  async function openRecentFolder(path: string) {
    if (isGlobalBusy) {
      return;
    }

    setActiveMenu(null);
    await loadRoot(path, { recordRecent: true });
  }

  async function removeRecentFolder(path: string) {
    if (isGlobalBusy) {
      return;
    }

    try {
      const entries = await runForegroundConfigOperation(() =>
        invoke<RecentFolderEntry[]>("remove_recent_folder", { path }),
      );
      setRecentFolders(entries);
      setRootOperationError(null);
    } catch (error) {
      setRootOperationError(toErrorMessage(error));
    }
  }

  async function saveTheme(nextTheme: Theme) {
    if (isGlobalBusy || !viewerSettings) {
      return;
    }

    setActiveMenu(null);
    setAppConfigError(null);
    try {
      const result = await runForegroundConfigOperation(() =>
        invoke<ViewerSettingsLoadResult>("save_viewer_preferences", {
          theme: nextTheme,
          plantUmlJarPath: viewerSettings.plantUmlJarPath,
        }),
      );
      setViewerSettings(result.settings);
      setTheme(result.settings.theme);
      setAppConfigError(result.warnings[0] ?? null);
    } catch (error) {
      setAppConfigError(toErrorMessage(error));
    }
  }

  async function openSettings() {
    if (isGlobalBusy || !viewerSettings) {
      return;
    }

    setActiveMenu(null);
    setSettingsError(null);
    try {
      const appWindow = getCurrentWindow();
      const [physicalSize, scaleFactor] = await Promise.all([
        appWindow.innerSize(),
        appWindow.scaleFactor(),
      ]);
      setCurrentWindowSize(toLogicalWindowSize(physicalSize, scaleFactor));
    } catch (error) {
      setAppConfigError(`Failed to read current window size: ${toErrorMessage(error)}`);
    }
    setSettingsDraft({
      theme: viewerSettings.theme,
      plantUmlJarPath: viewerSettings.plantUmlJarPath ?? "",
    });
  }

  function closeSettings() {
    setSettingsDraft(null);
    setSettingsError(null);
    window.setTimeout(() => fileMenuButtonRef.current?.focus(), 0);
  }

  async function saveSettings() {
    if (!settingsDraft || isAppConfigBusy) {
      return;
    }

    setSettingsError(null);
    try {
      const result = await runForegroundConfigOperation(() =>
        invoke<ViewerSettingsLoadResult>("save_viewer_preferences", {
          theme: settingsDraft.theme,
          plantUmlJarPath: settingsDraft.plantUmlJarPath,
        }),
      );
      setViewerSettings(result.settings);
      setTheme(result.settings.theme);
      setAppConfigError(result.warnings[0] ?? null);
      closeSettings();
    } catch (error) {
      setSettingsError(toErrorMessage(error));
    }
  }

  async function browsePlantUmlJar() {
    setSettingsError(null);
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        title: "Choose PlantUML jar",
        filters: [{ name: "Java archives", extensions: ["jar"] }],
      });
      if (typeof selected === "string") {
        setSettingsDraft((draft) =>
          draft ? { ...draft, plantUmlJarPath: selected } : draft,
        );
      }
    } catch (error) {
      setSettingsError(`Failed to open PlantUML jar picker: ${toErrorMessage(error)}`);
    }
  }

  async function reload() {
    if (!rootPath || isGlobalBusy) {
      return;
    }

    setIsRootLoading(true);
    setRootOperationError(null);
    try {
      const tree = await invoke<FileTreeNode>("scan_directory", {
        rootPath,
      });
      setFileTree(tree);
      setIsRootLoading(false);

      if (activeTab) {
        const revision = activeTab.revision + 1;
        updateTabIfCurrent(activeTab.id, activeTab.revision, (tab) => ({
          ...tab,
          revision,
          sourceText: null,
          previewUrl: null,
          loadState: "loading",
          errorMessage: null,
          plantUmlDiagrams: [],
        }));
        setPanePreviewStatus("primary", null);
        setPanePreviewStatus("secondary", null);
        void loadTab(activeTab.id, activeTab.path, revision);
      }
    } catch (error) {
      setRootOperationError(toErrorMessage(error));
    } finally {
      setIsRootLoading(false);
    }
  }

  function openOrActivateTab(paneId: PaneId, filePath: string, anchor?: string) {
    const existing = tabsRef.current.find((tab) => tab.path === filePath);
    if (existing) {
      applySplitView({ type: "select-tab", paneId, tabId: existing.id, anchor });
      setPanePreviewStatus(paneId, null);
      return;
    }

    const tabId = `tab-${nextTabIdRef.current++}`;
    const tab: OpenDocumentTab = {
      id: tabId,
      path: filePath,
      displayName: getFileName(filePath),
      documentType: documentTypeForPath(filePath),
      sourceText: null,
      previewUrl: null,
      revision: 1,
      loadState: "loading",
      errorMessage: null,
      plantUmlDiagrams: [],
    };
    updateTabs((current) => [...current, tab]);
    applySplitView({ type: "select-tab", paneId, tabId, anchor });
    setPanePreviewStatus(paneId, null);
    void loadTab(tabId, filePath, tab.revision);
  }

  async function loadTab(tabId: string, filePath: string, revision: number) {
    try {
      const document = parseOpenDocumentResponse(
        await invoke<unknown>("open_document", { path: filePath }),
      );
      if (document.documentType === "html") {
        updateTabIfCurrent(tabId, revision, (tab) => ({
          ...tab,
          documentType: "html",
          sourceText: null,
          previewUrl: document.previewUrl,
          loadState: "ready",
          errorMessage: null,
          plantUmlDiagrams: [],
        }));
        return;
      }

      const sources = extractPlantUmlSources(document.sourceText);
      const pendingDiagrams = sources.map(() => ({
        ok: false,
        html: `<pre class="plantuml-loading">PlantUML render pending...</pre>`,
        error: null,
      }));
      updateTabIfCurrent(tabId, revision, (tab) => ({
        ...tab,
        documentType: "markdown",
        sourceText: document.sourceText,
        previewUrl: null,
        loadState: sources.length > 0 ? "rendering" : "ready",
        errorMessage: null,
        plantUmlDiagrams: pendingDiagrams,
      }));

      if (sources.length === 0) {
        return;
      }

      try {
        const response = await invoke<PlantUmlRenderResponse>("render_plantuml_diagrams", { sources });
        updateTabIfCurrent(tabId, revision, (tab) => ({
          ...tab,
          loadState: response.firstError ? "error" : "ready",
          errorMessage: response.firstError,
          plantUmlDiagrams: response.diagrams,
        }));
      } catch (error) {
        const message = toErrorMessage(error);
        updateTabIfCurrent(tabId, revision, (tab) => ({
          ...tab,
          loadState: "error",
          errorMessage: message,
          plantUmlDiagrams: sources.map(() => ({
            ok: false,
            html: `<pre class="plantuml-error">PlantUML render failed: ${escapeHtml(message)}</pre>`,
            error: message,
          })),
        }));
      }
    } catch (error) {
      const message = toErrorMessage(error);
      updateTabIfCurrent(tabId, revision, (tab) => ({
        ...tab,
        loadState: "error",
        errorMessage: message,
      }));
    }
  }

  async function openHtmlExternalUrl(
    paneId: PaneId,
    tabId: string,
    revision: number,
    href: string,
  ) {
    try {
      await openUrl(href);
    } catch (error) {
      updatePanePreviewPhase(
        paneId,
        tabId,
        revision,
        "error",
        `Failed to open external URL: ${toErrorMessage(error)}`,
      );
    }
  }

  function activateTab(paneId: PaneId, tabId: string) {
    applySplitView({ type: "select-tab", paneId, tabId });
    setPanePreviewStatus(paneId, null);
  }

  function closeTab(paneId: PaneId, tabId: string): string | null {
    const current = tabsRef.current;
    const closeIndex = current.findIndex((tab) => tab.id === tabId);
    if (closeIndex < 0) {
      return getPaneState(splitViewRef.current, paneId).activeTabId;
    }

    const next = current.filter((tab) => tab.id !== tabId);
    const adjacent = next[closeIndex] ?? next[closeIndex - 1] ?? null;
    updateTabs(() => next);
    const state = applySplitView({
      type: "remove-tab",
      tabId,
      fallbackTabId: adjacent?.id ?? null,
    });
    for (const id of ["primary", "secondary"] as const) {
      if (panePreviewStatusesRef.current[id]?.tabId === tabId) {
        setPanePreviewStatus(id, null);
      }
    }
    return getPaneState(state, paneId).activeTabId;
  }

  function closeImageViewer() {
    if (imageViewerRequest) {
      imageViewerFocusReturnRef.current =
        imageViewerRequest.activation === "keyboard"
          ? imageViewerRequest.focusOrigin
          : panePreviewElementsRef.current[imageViewerRequest.paneId];
    }
    setImageViewerRequest(null);
  }

  async function handlePreviewClick(
    paneId: PaneId,
    tab: OpenDocumentTab,
    previewElement: HTMLElement,
    event: React.MouseEvent<HTMLElement>,
  ) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest("a");
    const href = anchor?.getAttribute("href");

    if (
      tab.documentType === "markdown" &&
      !(anchor && target.closest("svg"))
    ) {
      const request = resolveImageViewerSource(
        target,
        previewElement,
        tab.id,
        tab.revision,
        getImageViewerActivation(event.detail),
      );
      if (request) {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setImageViewerRequest({ ...request, paneId });
        return;
      }
    }

    if (!href) {
      return;
    }

    if (href.startsWith("#")) {
      event.preventDefault();
      scrollToAnchor(href.slice(1), previewElement);
      return;
    }

    if (externalUrlPattern.test(href) || href.startsWith("mailto:")) {
      event.preventDefault();
      await openUrl(href);
      return;
    }

    if (!rootPath) {
      return;
    }

    const [rawPath, rawAnchor] = href.split("#");
    if (!isMarkdownPath(rawPath)) {
      return;
    }

    event.preventDefault();
    const nextPath = resolveSiblingPath(tab.path, safeDecode(rawPath));
    openOrActivateTab(paneId, nextPath, rawAnchor ? safeDecode(rawAnchor) : undefined);
  }

  function toggleSplitView() {
    setActiveMenu(null);
    const action: SplitViewAction =
      splitViewRef.current.mode === "single"
        ? { type: "enable-split", orderedTabIds: tabsRef.current.map((tab) => tab.id) }
        : { type: "disable-split", orderedTabIds: tabsRef.current.map((tab) => tab.id) };
    const next = applySplitView(action);
    setPanePreviewStatus("secondary", null);
    if (next.mode === "single") {
      splitResizeRef.current = null;
      setIsSplitResizing(false);
    }
  }

  function activatePane(paneId: PaneId) {
    if (splitViewRef.current.activePaneId !== paneId) {
      applySplitView({ type: "activate-pane", paneId });
    }
  }

  function registerPreviewElement(paneId: PaneId, element: HTMLElement | null) {
    panePreviewElementsRef.current[paneId] = element;
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (isStartupConfigLoading || !workspaceRef.current) {
      return;
    }

    const workspace = workspaceRef.current;
    const updateWorkspaceWidth = (width: number) => {
      if (Number.isFinite(width) && width > 0) {
        setWorkspaceWidth(width);
      }
    };
    updateWorkspaceWidth(workspace.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateWorkspaceWidth(entry.contentRect.width);
      }
    });
    observer.observe(workspace);

    return () => {
      observer.disconnect();
      explorerResizeRef.current = null;
    };
  }, [isStartupConfigLoading]);

  useEffect(() => {
    const previewWorkspace = previewWorkspaceRef.current;
    if (!previewWorkspace) {
      return;
    }
    const updateWidth = (width: number) => {
      setSplitWorkspaceWidth(Number.isFinite(width) && width > 0 ? width : null);
    };
    updateWidth(previewWorkspace.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateWidth(entry.contentRect.width);
      }
    });
    observer.observe(previewWorkspace);
    return () => {
      observer.disconnect();
      splitResizeRef.current = null;
    };
  }, [isStartupConfigLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadAppConfig() {
      const [settingsResult, recentFoldersResult] = await Promise.allSettled([
        invoke<ViewerSettingsLoadResult>("load_viewer_settings"),
        invoke<RecentFolderEntry[]>("load_recent_folders"),
      ]);
      if (cancelled) {
        return;
      }

      const errors: string[] = [];
      if (settingsResult.status === "fulfilled") {
        const loaded = settingsResult.value;
        document.documentElement.dataset.theme = loaded.settings.theme;
        setViewerSettings(loaded.settings);
        setTheme(loaded.settings.theme);
        setCurrentWindowSize(loaded.settings.windowSize);
        errors.push(...loaded.warnings);
        if (loaded.warnings.length > 0) {
          try {
            await invoke<WindowSize>("save_window_size", loaded.settings.windowSize);
          } catch (error) {
            errors.push(`Failed to repair saved window size: ${toErrorMessage(error)}`);
          }
        }
      } else {
        errors.push(toErrorMessage(settingsResult.reason));
        document.documentElement.dataset.theme = "light";
        setViewerSettings({
          theme: "light",
          windowSize: defaultWindowSize,
          plantUmlJarPath: null,
        });
      }

      if (recentFoldersResult.status === "fulfilled") {
        setRecentFolders(recentFoldersResult.value);
      } else {
        errors.push(toErrorMessage(recentFoldersResult.reason));
      }

      if (!cancelled) {
        setAppConfigError(errors.length > 0 ? errors.join(" ") : null);
        setIsStartupConfigLoading(false);
      }
    }

    void loadAppConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let active = true;
    let unlisten: (() => void) | undefined;
    let timer: number | undefined;
    let inFlight = false;
    let pendingSize: WindowSize | null = null;
    let resizeRevision = 0;

    async function persistPendingSize() {
      if (!active || inFlight || !pendingSize) {
        return;
      }
      const size = pendingSize;
      pendingSize = null;
      inFlight = true;
      try {
        const saved = await invoke<WindowSize>("save_window_size", size);
        if (active) {
          setCurrentWindowSize(saved);
        }
      } catch (error) {
        if (active) {
          setAppConfigError(`Failed to save window size: ${toErrorMessage(error)}`);
        }
      } finally {
        inFlight = false;
        if (active && pendingSize && timer === undefined) {
          void persistPendingSize();
        }
      }
    }

    function scheduleSizeSave(size: WindowSize) {
      pendingSize = size;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = undefined;
        void persistPendingSize();
      }, windowResizeSaveDelay);
    }

    async function handleResize(physicalSize: { width: number; height: number }) {
      const revision = ++resizeRevision;
      try {
        const [isMaximized, isMinimized, isFullscreen, scaleFactor] = await Promise.all([
          appWindow.isMaximized(),
          appWindow.isMinimized(),
          appWindow.isFullscreen(),
          appWindow.scaleFactor(),
        ]);
        if (
          !active ||
          revision !== resizeRevision ||
          isMaximized ||
          isMinimized ||
          isFullscreen
        ) {
          return;
        }
        const logicalSize = toLogicalWindowSize(physicalSize, scaleFactor);
        setCurrentWindowSize(logicalSize);
        scheduleSizeSave(logicalSize);
      } catch (error) {
        if (active) {
          setAppConfigError(`Failed to observe window size: ${toErrorMessage(error)}`);
        }
      }
    }

    void Promise.all([appWindow.innerSize(), appWindow.scaleFactor()])
      .then(([physicalSize, scaleFactor]) => {
        if (active) {
          setCurrentWindowSize(toLogicalWindowSize(physicalSize, scaleFactor));
        }
      })
      .catch((error) => {
        if (active) {
          setAppConfigError(`Failed to read window size: ${toErrorMessage(error)}`);
        }
      });

    void appWindow
      .onResized(({ payload }) => void handleResize(payload))
      .then((dispose) => {
        if (active) {
          unlisten = dispose;
        } else {
          dispose();
        }
      })
      .catch((error) => {
        if (active) {
          setAppConfigError(`Failed to subscribe to window resize: ${toErrorMessage(error)}`);
        }
      });

    return () => {
      active = false;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!activeMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuBarRef.current?.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (!imageViewerRequest) {
      return;
    }
    const pane = getPaneState(splitViewState, imageViewerRequest.paneId);
    const requestTab = tabs.find((tab) => tab.id === imageViewerRequest.tabId);
    if (
      (imageViewerRequest.paneId === "secondary" && splitViewState.mode !== "split") ||
      pane.activeTabId !== imageViewerRequest.tabId ||
      requestTab?.documentType !== "markdown" ||
      requestTab.revision !== imageViewerRequest.revision ||
      !imageViewerRequest.visual.isConnected
    ) {
      closeImageViewer();
    }
  }, [splitViewState, tabs, imageViewerRequest]);

  useEffect(() => {
    if (imageViewerRequest || !imageViewerFocusReturnRef.current) {
      return;
    }
    const focusReturn = imageViewerFocusReturnRef.current;
    imageViewerFocusReturnRef.current = null;
    const timer = window.setTimeout(() => {
      if (focusReturn.isConnected) {
        focusReturn.focus();
      } else {
        panePreviewElementsRef.current.primary?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [imageViewerRequest]);

  useEffect(() => {
    for (const paneId of ["primary", "secondary"] as const) {
      const status = panePreviewStatusesRef.current[paneId];
      if (
        status &&
        !isPanePreviewStatusCurrent(paneId, status, splitViewState, tabs)
      ) {
        setPanePreviewStatus(paneId, null);
      }
    }
  }, [splitViewState, tabs]);

  if (isStartupConfigLoading) {
    return (
      <main className="app-shell startup-shell">
        <div className="startup-loading" role="status">
          Loading settings...
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className={`app-shell ${isExplorerResizing ? "explorer-resizing" : ""} ${isSplitResizing ? "split-resizing" : ""}`}
        aria-hidden={settingsDraft || imageViewerRequest ? true : undefined}
        inert={settingsDraft || imageViewerRequest ? true : undefined}
      >
        <MenuBar
          menuBarRef={menuBarRef}
          fileMenuButtonRef={fileMenuButtonRef}
          rootPath={rootPath}
          theme={theme}
          isSplitView={splitViewState.mode === "split"}
          isBusy={isGlobalBusy}
          activeMenu={activeMenu}
          recentFolders={recentFolders}
          onOpenFolder={openFolder}
          onReload={reload}
          onToggleTheme={() => void saveTheme(theme === "light" ? "dark" : "light")}
          onToggleSplitView={toggleSplitView}
          onOpenSettings={() => void openSettings()}
          onMenuToggle={(menu) => setActiveMenu((value) => (value === menu ? null : menu))}
          onCloseMenu={() => setActiveMenu(null)}
          onOpenRecentFolder={openRecentFolder}
          onRemoveRecentFolder={removeRecentFolder}
        />

        <RootPathBar rootPath={rootPath} />

        <section
          ref={workspaceRef}
          className="workspace"
          style={{ "--explorer-width": `${explorerWidth}px` } as React.CSSProperties}
        >
          <aside className="explorer-pane" id="explorer-pane" aria-label="Explorer">
            <div className="pane-title">Explorer</div>
            <div className="explorer-scroll">
              {fileTree ? (
                <FileTree
                  node={fileTree}
                  selectedFilePath={activeTab?.path ?? null}
                  disabled={isGlobalBusy}
                  onSelect={(node) =>
                    rootPath && openOrActivateTab(splitViewState.activePaneId, node.path)
                  }
                />
              ) : (
                <div className="empty-state">Open a folder to browse documents.</div>
              )}
            </div>
          </aside>

          <div
            className="explorer-separator"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize Explorer pane"
            aria-controls="explorer-pane preview-workspace"
            aria-valuemin={explorerWidthBounds.min}
            aria-valuemax={explorerWidthBounds.max}
            aria-valuenow={explorerWidth}
            tabIndex={0}
            onPointerDown={handleExplorerPointerDown}
            onPointerMove={handleExplorerPointerMove}
            onPointerUp={finishExplorerResize}
            onPointerCancel={finishExplorerResize}
            onLostPointerCapture={handleExplorerLostPointerCapture}
            onKeyDown={handleExplorerKeyDown}
          />

          <section
            ref={previewWorkspaceRef}
            className="preview-workspace"
            id="preview-workspace"
            aria-label="Document Preview"
          >
            <div
              className={`preview-grid ${splitViewState.mode} ${splitWidthBounds ? "measured" : ""}`}
              style={
                primaryPaneWidth === null
                  ? undefined
                  : ({ "--primary-pane-width": `${primaryPaneWidth}px` } as React.CSSProperties)
              }
            >
              <DocumentPane
                paneId="primary"
                tabs={tabs}
                splitViewState={splitViewState}
                previewStatus={panePreviewStatuses.primary}
                theme={theme}
                isActive={splitViewState.activePaneId === "primary"}
                onActivatePane={activatePane}
                onActivateTab={activateTab}
                onCloseTab={closeTab}
                onPreviewStatus={updatePanePreviewPhase}
                onPreviewElement={registerPreviewElement}
                onPreviewClick={handlePreviewClick}
                onConsumeNavigation={(paneId, tabId, anchor) =>
                  applySplitView({ type: "consume-navigation", paneId, tabId, anchor })
                }
                onOpenExternal={(paneId, tabId, revision, href) =>
                  void openHtmlExternalUrl(paneId, tabId, revision, href)
                }
                isCurrent={(paneId, tabId, revision) =>
                  isPaneResultCurrent(
                    { paneId, tabId, revision },
                    splitViewRef.current,
                    tabsRef.current,
                  )
                }
                enqueueMermaid={enqueueMermaidTask}
              />
              {splitViewState.mode === "split" && splitWidthBounds && primaryPaneWidth !== null ? (
                <div
                  className="split-separator"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize document panes"
                  aria-controls="document-pane-primary document-pane-secondary"
                  aria-valuemin={splitWidthBounds.min}
                  aria-valuemax={splitWidthBounds.max}
                  aria-valuenow={Math.round(primaryPaneWidth)}
                  tabIndex={0}
                  onPointerDown={handleSplitPointerDown}
                  onPointerMove={handleSplitPointerMove}
                  onPointerUp={finishSplitResize}
                  onPointerCancel={finishSplitResize}
                  onLostPointerCapture={handleSplitLostPointerCapture}
                  onKeyDown={handleSplitKeyDown}
                />
              ) : null}
              {splitViewState.mode === "split" ? (
                <DocumentPane
                  paneId="secondary"
                  tabs={tabs}
                  splitViewState={splitViewState}
                  previewStatus={panePreviewStatuses.secondary}
                  theme={theme}
                  isActive={splitViewState.activePaneId === "secondary"}
                  onActivatePane={activatePane}
                  onActivateTab={activateTab}
                  onCloseTab={closeTab}
                  onPreviewStatus={updatePanePreviewPhase}
                  onPreviewElement={registerPreviewElement}
                  onPreviewClick={handlePreviewClick}
                  onConsumeNavigation={(paneId, tabId, anchor) =>
                    applySplitView({ type: "consume-navigation", paneId, tabId, anchor })
                  }
                  onOpenExternal={(paneId, tabId, revision, href) =>
                    void openHtmlExternalUrl(paneId, tabId, revision, href)
                  }
                  isCurrent={(paneId, tabId, revision) =>
                    isPaneResultCurrent(
                      { paneId, tabId, revision },
                      splitViewRef.current,
                      tabsRef.current,
                    )
                  }
                  enqueueMermaid={enqueueMermaidTask}
                />
              ) : null}
            </div>
          </section>
        </section>

        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

        <StatusBar
          selectedFileName={activeTab?.displayName ?? ""}
          loadingMessage={loadingMessage}
        />
      </main>

      {settingsDraft ? (
        <SettingsDialog
          draft={settingsDraft}
          currentWindowSize={currentWindowSize}
          error={settingsError}
          isSaving={isAppConfigBusy}
          onDraftChange={setSettingsDraft}
          onBrowsePlantUmlJar={() => void browsePlantUmlJar()}
          onCancel={closeSettings}
          onSave={() => void saveSettings()}
        />
      ) : null}

      {imageViewerRequest ? (
        <ImageViewerDialog request={imageViewerRequest} onClose={closeImageViewer} />
      ) : null}
    </>
  );
}

type ImageViewerDialogProps = {
  request: ImageViewerRequest;
  onClose: () => void;
};

type ImageViewerDragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

function ImageViewerDialog({ request, onClose }: ImageViewerDialogProps) {
  const sourceLabel =
    request.kind === "image"
      ? "Image"
      : request.kind === "mermaid"
        ? "Mermaid diagram"
        : "PlantUML diagram";
  const dialogRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropPointerRef = useRef(false);
  const dragRef = useRef<ImageViewerDragState | null>(null);
  const [geometry, setGeometry] = useState<ImageViewerGeometry | null>(null);
  const [transform, setTransform] = useState<ImageViewerTransform | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [announcedScale, setAnnouncedScale] = useState<number | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !request.visual.isConnected) {
      onClose();
      return;
    }
    const clone = request.visual.cloneNode(true) as HTMLImageElement | SVGSVGElement;
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.style.removeProperty("max-width");
    clone.style.removeProperty("width");
    clone.style.removeProperty("height");
    clone.style.width = `${request.intrinsicWidth}px`;
    clone.style.height = `${request.intrinsicHeight}px`;
    content.replaceChildren(clone);
    return () => content.replaceChildren();
  }, [request]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const updateGeometry = (width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      const nextGeometry: ImageViewerGeometry = {
        intrinsicWidth: request.intrinsicWidth,
        intrinsicHeight: request.intrinsicHeight,
        viewportWidth: width,
        viewportHeight: height,
        padding: window.innerWidth <= 760 ? 12 : 24,
      };
      setGeometry(nextGeometry);
      setTransform((current) =>
        current
          ? resizeImageViewerTransform(current, nextGeometry)
          : createImageViewerFitTransform(nextGeometry),
      );
    };
    const initial = viewport.getBoundingClientRect();
    updateGeometry(initial.width, initial.height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateGeometry(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [request]);

  useEffect(() => {
    viewportRef.current?.focus();
  }, [request]);

  useEffect(() => {
    if (!transform) {
      return;
    }
    const timer = window.setTimeout(() => setAnnouncedScale(transform.scale), 250);
    return () => window.clearTimeout(timer);
  }, [transform?.scale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !geometry) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const factor = getImageViewerWheelFactor(event.deltaY, event.deltaMode, rect.height);
      const anchor = {
        x: event.clientX - (rect.left + rect.width / 2),
        y: event.clientY - (rect.top + rect.height / 2),
      };
      setTransform((current) =>
        current ? zoomImageViewerTransform(current, geometry, factor, anchor) : current,
      );
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [geometry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const controls = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (controls.length === 0) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateZoom = (factor: number) => {
    if (!geometry) {
      return;
    }
    setTransform((current) =>
      current ? zoomImageViewerTransform(current, geometry, factor) : current,
    );
  };

  const updatePan = (x: number, y: number) => {
    if (!geometry) {
      return;
    }
    setTransform((current) =>
      current ? panImageViewerTransform(current, geometry, { x, y }) : current,
    );
  };

  const handleViewportKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!geometry || !transform) {
      return;
    }
    const panStep = event.shiftKey ? 160 : 48;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      updateZoom(imageViewerButtonZoomInFactor);
    } else if (event.key === "-") {
      event.preventDefault();
      updateZoom(imageViewerButtonZoomOutFactor);
    } else if (event.key === "0") {
      event.preventDefault();
      setTransform(createImageViewerResetTransform(geometry));
    } else if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      setTransform(createImageViewerFitTransform(geometry));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      updatePan(-panStep, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      updatePan(panStep, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updatePan(0, -panStep);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      updatePan(0, panStep);
    }
  };

  const percentage = Math.round((transform?.scale ?? 0) * 100);
  const fitScale = geometry ? getImageViewerFitScale(geometry) : 0;

  return (
    <div
      className="image-viewer-backdrop"
      onPointerDown={(event) => {
        backdropPointerRef.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        if (backdropPointerRef.current && event.target === event.currentTarget) {
          onClose();
        }
        backdropPointerRef.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="image-viewer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-viewer-title"
        aria-describedby="image-viewer-instructions"
        tabIndex={-1}
      >
        <header className="image-viewer-header">
          <h2 id="image-viewer-title">
            {sourceLabel}
            {request.accessibleName === sourceLabel ? "" : `: ${request.accessibleName}`}
          </h2>
          <button type="button" aria-label="Close image viewer" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="image-viewer-toolbar" role="toolbar" aria-label="Image viewer controls">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={!transform || transform.scale <= fitScale + 0.000001}
            onClick={() => updateZoom(imageViewerButtonZoomOutFactor)}
          >
            Zoom out
          </button>
          <output aria-label="Current zoom" aria-live="off">
            {percentage}%
          </output>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={!transform || transform.scale >= imageViewerMaximumScale - 0.000001}
            onClick={() => updateZoom(imageViewerButtonZoomInFactor)}
          >
            Zoom in
          </button>
          <button
            type="button"
            aria-label="Fit image"
            disabled={!geometry}
            onClick={() => geometry && setTransform(createImageViewerFitTransform(geometry))}
          >
            Fit
          </button>
          <button
            type="button"
            aria-label="Reset image to 100%"
            disabled={!geometry}
            onClick={() => geometry && setTransform(createImageViewerResetTransform(geometry))}
          >
            100%
          </button>
        </div>
        <div
          ref={viewportRef}
          className={`image-viewer-viewport ${isDragging ? "dragging" : ""}`}
          tabIndex={0}
          aria-label="Zoomable and pannable image"
          onKeyDown={handleViewportKeyDown}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary || !transform) {
              return;
            }
            dragRef.current = {
              pointerId: event.pointerId,
              clientX: event.clientX,
              clientY: event.clientY,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsDragging(true);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) {
              return;
            }
            updatePan(event.clientX - drag.clientX, event.clientY - drag.clientY);
            drag.clientX = event.clientX;
            drag.clientY = event.clientY;
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) {
              return;
            }
            dragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setIsDragging(false);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setIsDragging(false);
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
            setIsDragging(false);
          }}
        >
          <div
            ref={contentRef}
            className="image-viewer-content"
            aria-hidden="true"
            inert
            style={
              transform
                ? {
                    transform: `translate(-50%, -50%) translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
                  }
                : undefined
            }
          />
        </div>
        <p id="image-viewer-instructions" className="image-viewer-instructions">
          Wheel or trackpad to zoom. Drag or use Arrow keys to pan. Press F to fit, 0 for 100%, and Escape to close.
        </p>
        <span className="image-viewer-live" aria-live="polite">
          {announcedScale === null ? "" : `Zoom ${Math.round(announcedScale * 100)} percent`}
        </span>
      </div>
    </div>
  );
}

type MenuBarProps = {
  menuBarRef: React.RefObject<HTMLElement | null>;
  fileMenuButtonRef: React.RefObject<HTMLButtonElement | null>;
  rootPath: string | null;
  theme: Theme;
  isSplitView: boolean;
  isBusy: boolean;
  activeMenu: ActiveMenu;
  recentFolders: RecentFolderEntry[];
  onOpenFolder: () => void;
  onReload: () => void;
  onToggleTheme: () => void;
  onToggleSplitView: () => void;
  onOpenSettings: () => void;
  onMenuToggle: (menu: Exclude<ActiveMenu, null>) => void;
  onCloseMenu: () => void;
  onOpenRecentFolder: (path: string) => void;
  onRemoveRecentFolder: (path: string) => void;
};

function MenuBar({
  menuBarRef,
  fileMenuButtonRef,
  rootPath,
  theme,
  isSplitView,
  isBusy,
  activeMenu,
  recentFolders,
  onOpenFolder,
  onReload,
  onToggleTheme,
  onToggleSplitView,
  onOpenSettings,
  onMenuToggle,
  onCloseMenu,
  onOpenRecentFolder,
  onRemoveRecentFolder,
}: MenuBarProps) {
  return (
    <header ref={menuBarRef} className="menu-bar" aria-label="Application menu">
      <div className="menu-group">
        <button
          ref={fileMenuButtonRef}
          type="button"
          className="menu-trigger"
          aria-haspopup="menu"
          aria-expanded={activeMenu === "file"}
          onClick={() => onMenuToggle("file")}
        >
          File
        </button>
        {activeMenu === "file" ? (
          <div className="menu-dropdown file-menu-dropdown" role="menu" aria-label="File">
            <button
              type="button"
              role="menuitem"
              disabled={isBusy}
              onClick={() => {
                onCloseMenu();
                onOpenFolder();
              }}
            >
              Open Folder...
            </button>
            <div className="menu-section-label" role="none">
              Recent Folders
            </div>
            {recentFolders.length > 0 ? (
              <div className="recent-folder-list" role="none">
                {recentFolders.map((entry) => (
                  <div className="recent-folder-row" role="none" key={entry.path}>
                    <button
                      type="button"
                      className="recent-folder-open"
                      role="menuitem"
                      title={entry.path}
                      disabled={isBusy}
                      onClick={() => onOpenRecentFolder(entry.path)}
                    >
                      <span className="recent-folder-name">{entry.name || entry.path}</span>
                      <span className="recent-folder-path">{entry.path}</span>
                    </button>
                    <button
                      type="button"
                      className="recent-folder-remove"
                      role="menuitem"
                      aria-label={`Remove ${entry.path} from recent folders`}
                      title="Remove from Recent Folders"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveRecentFolder(entry.path);
                      }}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menu-empty-state" role="menuitem" aria-disabled="true">
                No recent folders
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={!rootPath || isBusy}
              onClick={() => {
                onCloseMenu();
                onReload();
              }}
            >
              Reload
            </button>
            <div className="menu-separator" role="separator" />
            <button
              type="button"
              role="menuitem"
              disabled={isBusy}
              onClick={() => {
                onCloseMenu();
                onOpenSettings();
              }}
            >
              Settings...
            </button>
          </div>
        ) : null}
      </div>
      <div className="menu-group">
        <button
          type="button"
          className="menu-trigger"
          aria-haspopup="menu"
          aria-expanded={activeMenu === "view"}
          onClick={() => onMenuToggle("view")}
        >
          View
        </button>
        {activeMenu === "view" ? (
          <div className="menu-dropdown" role="menu" aria-label="View">
            <button type="button" role="menuitem" disabled={isBusy} onClick={onToggleTheme}>
              Theme: {theme === "light" ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isSplitView}
              disabled={isBusy}
              onClick={onToggleSplitView}
            >
              Split View
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

type SettingsDialogProps = {
  draft: ViewerPreferencesDraft;
  currentWindowSize: WindowSize;
  error: string | null;
  isSaving: boolean;
  onDraftChange: (draft: ViewerPreferencesDraft) => void;
  onBrowsePlantUmlJar: () => void;
  onCancel: () => void;
  onSave: () => void;
};

function SettingsDialog({
  draft,
  currentWindowSize,
  error,
  isSaving,
  onDraftChange,
  onBrowsePlantUmlJar,
  onCancel,
  onSave,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const themeSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isSaving) {
      dialogRef.current?.focus();
    } else {
      themeSelectRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (controls.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving]);

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-busy={isSaving}
        tabIndex={-1}
      >
        <div className="settings-header">
          <h2 id="settings-title">Viewer Settings</h2>
          <button
            type="button"
            className="settings-close"
            aria-label="Close settings"
            disabled={isSaving}
            onClick={onCancel}
          >
            x
          </button>
        </div>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label className="settings-field">
            <span>Theme</span>
            <select
              ref={themeSelectRef}
              value={draft.theme}
              disabled={isSaving}
              onChange={(event) =>
                onDraftChange({ ...draft, theme: event.target.value as Theme })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <div className="settings-field">
            <span>Window size</span>
            <output className="settings-window-size">
              {currentWindowSize.width} x {currentWindowSize.height}
            </output>
            <small>Resize the window to save this value automatically.</small>
          </div>

          <label className="settings-field" htmlFor="plantuml-jar-path">
            <span>PlantUML jar</span>
          </label>
          <div className="settings-path-row">
            <input
              id="plantuml-jar-path"
              type="text"
              value={draft.plantUmlJarPath}
              placeholder="Automatic runtime discovery"
              disabled={isSaving}
              onChange={(event) =>
                onDraftChange({ ...draft, plantUmlJarPath: event.target.value })
              }
            />
            <button type="button" disabled={isSaving} onClick={onBrowsePlantUmlJar}>
              Browse...
            </button>
            <button
              type="button"
              disabled={isSaving || draft.plantUmlJarPath.length === 0}
              onClick={() => onDraftChange({ ...draft, plantUmlJarPath: "" })}
            >
              Clear
            </button>
          </div>
          <small>
            Clear the path to use plantuml.config.json or plantuml.jar from the runtime directory.
          </small>

          {error ? (
            <div className="settings-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="settings-actions">
            <button type="button" disabled={isSaving} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="settings-save" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type RootPathBarProps = {
  rootPath: string | null;
};

function RootPathBar({ rootPath }: RootPathBarProps) {
  const rootText = rootPath ?? "No folder selected";

  return (
    <section className="root-path-bar" aria-label="Current root folder" title={rootText}>
      <span className="chrome-label">Root:</span>
      <span className="root-path-value">{rootText}</span>
    </section>
  );
}

type ErrorBannerProps = {
  message: string;
};

function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <section className="error-strip" role="alert" title={message}>
      <span className="chrome-label">Error:</span>
      <span className="error-strip-value">{message}</span>
    </section>
  );
}

type StatusBarProps = {
  selectedFileName: string;
  loadingMessage: string | null;
};

function StatusBar({ selectedFileName, loadingMessage }: StatusBarProps) {
  const fileText = selectedFileName || "No file selected";
  const stateText = loadingMessage ?? "Ready";

  return (
    <footer className="status-bar" aria-label="Application status">
      <StatusBarItem label="State" value={stateText} priority="state" live />
      <StatusBarItem label="File" value={fileText} priority="file" />
    </footer>
  );
}

type StatusBarItemProps = {
  label: string;
  value: string;
  priority: "state" | "file";
  live?: boolean;
};

function StatusBarItem({ label, value, priority, live = false }: StatusBarItemProps) {
  return (
    <div className={`status-item status-${priority}`} title={`${label}: ${value}`}>
      <span className="status-label">{label}:</span>
      <span className="status-value" aria-live={live ? "polite" : undefined}>
        {value}
      </span>
    </div>
  );
}

type DocumentPaneProps = {
  paneId: PaneId;
  tabs: OpenDocumentTab[];
  splitViewState: SplitViewState;
  previewStatus: PanePreviewStatus | null;
  theme: Theme;
  isActive: boolean;
  onActivatePane: (paneId: PaneId) => void;
  onActivateTab: (paneId: PaneId, tabId: string) => void;
  onCloseTab: (paneId: PaneId, tabId: string) => string | null;
  onPreviewStatus: (
    paneId: PaneId,
    tabId: string,
    revision: number,
    phase: PanePreviewPhase,
    errorMessage?: string | null,
  ) => void;
  onPreviewElement: (paneId: PaneId, element: HTMLElement | null) => void;
  onPreviewClick: (
    paneId: PaneId,
    tab: OpenDocumentTab,
    previewElement: HTMLElement,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  onConsumeNavigation: (paneId: PaneId, tabId: string, anchor: string) => void;
  onOpenExternal: (paneId: PaneId, tabId: string, revision: number, href: string) => void;
  isCurrent: (paneId: PaneId, tabId: string, revision: number) => boolean;
  enqueueMermaid: (task: () => Promise<void>) => Promise<void>;
};

function DocumentPane({
  paneId,
  tabs,
  splitViewState,
  previewStatus,
  theme,
  isActive,
  onActivatePane,
  onActivateTab,
  onCloseTab,
  onPreviewStatus,
  onPreviewElement,
  onPreviewClick,
  onConsumeNavigation,
  onOpenExternal,
  isCurrent,
  enqueueMermaid,
}: DocumentPaneProps) {
  const pane = getPaneState(splitViewState, paneId);
  const selectedTab = tabs.find((tab) => tab.id === pane.activeTabId) ?? null;
  const previewRef = useRef<HTMLElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPreviewElement(paneId, previewRef.current ?? previewPaneRef.current);
    return () => onPreviewElement(paneId, null);
  }, [paneId, selectedTab?.id, selectedTab?.revision]);

  useEffect(() => {
    const tab = selectedTab;
    const container = previewRef.current;
    if (!tab || tab.documentType !== "markdown" || !container) {
      return;
    }
    const adapter = createImageViewerDomAdapter(container, {
      tabId: tab.id,
      revision: tab.revision,
      documentPath: tab.path,
    });
    adapter.decorate();
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(".mermaid"));
    let cancelled = false;
    if (nodes.length === 0) {
      onPreviewStatus(paneId, tab.id, tab.revision, "ready");
      return () => adapter.cleanup();
    }

    const diagrams = nodes.map((node, index) => ({
      node,
      source: node.textContent ?? "",
      renderId: `mermaid-${paneId}-${tab.id}-${tab.revision}-${index}`,
    }));
    onPreviewStatus(paneId, tab.id, tab.revision, "rendering-mermaid");
    void enqueueMermaid(async () => {
      if (
        cancelled ||
        !isCurrent(paneId, tab.id, tab.revision) ||
        nodes.some((node) => !node.isConnected)
      ) {
        return;
      }
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: theme === "dark" ? "dark" : "default",
        });
        for (const diagram of diagrams) {
          if (cancelled || !diagram.node.isConnected) {
            return;
          }
          const result = await mermaid.render(
            diagram.renderId,
            diagram.source,
            diagram.node,
          );
          diagram.node.innerHTML = result.svg;
          diagram.node.setAttribute("data-processed", "true");
          result.bindFunctions?.(diagram.node);
        }
        if (
          !cancelled &&
          isCurrent(paneId, tab.id, tab.revision) &&
          nodes.every((node) => node.isConnected)
        ) {
          adapter.decorate();
          onPreviewStatus(paneId, tab.id, tab.revision, "ready");
        }
      } catch (error) {
        if (!cancelled && isCurrent(paneId, tab.id, tab.revision)) {
          onPreviewStatus(
            paneId,
            tab.id,
            tab.revision,
            "error",
            `Mermaid render failed: ${toErrorMessage(error)}`,
          );
        }
      }
    });

    return () => {
      cancelled = true;
      adapter.cleanup();
    };
  }, [
    paneId,
    selectedTab?.id,
    selectedTab?.revision,
    selectedTab?.plantUmlDiagrams,
    theme,
  ]);

  useEffect(() => {
    const navigation = pane.pendingNavigation;
    const tab = selectedTab;
    if (
      !navigation ||
      !tab ||
      tab.documentType !== "markdown" ||
      tab.loadState === "loading" ||
      navigation.tabId !== tab.id ||
      !previewRef.current
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (isCurrent(paneId, tab.id, tab.revision)) {
        scrollToAnchor(navigation.anchor, previewRef.current);
        onConsumeNavigation(paneId, tab.id, navigation.anchor);
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    pane.pendingNavigation,
    selectedTab?.id,
    selectedTab?.revision,
    selectedTab?.loadState,
    paneId,
  ]);

  return (
    <section
      className="document-pane"
      id={`document-pane-${paneId}`}
      role="region"
      aria-label={`${paneId === "primary" ? "Primary" : "Secondary"} document pane`}
      data-active={isActive ? "true" : "false"}
      tabIndex={-1}
      onPointerDown={() => onActivatePane(paneId)}
      onFocusCapture={() => onActivatePane(paneId)}
    >
      <TabStrip
        paneId={paneId}
        tabs={tabs}
        activeTabId={pane.activeTabId}
        splitViewState={splitViewState}
        previewStatus={previewStatus}
        onActivate={onActivateTab}
        onClose={onCloseTab}
      />
      <div
        ref={previewPaneRef}
        className="preview-pane"
        id={`document-preview-${paneId}`}
        role="tabpanel"
        aria-labelledby={selectedTab ? `tab-${paneId}-${selectedTab.id}` : undefined}
      >
        {selectedTab?.documentType === "markdown" && selectedTab.sourceText !== null ? (
          <MarkdownPreview
            key={`${paneId}-${selectedTab.id}-${theme}-${selectedTab.revision}`}
            markdown={selectedTab.sourceText}
            plantUmlDiagrams={selectedTab.plantUmlDiagrams}
            selectedFilePath={selectedTab.path}
            previewRef={previewRef}
            onClick={(event) =>
              previewRef.current && onPreviewClick(paneId, selectedTab, previewRef.current, event)
            }
          />
        ) : selectedTab?.documentType === "html" && selectedTab.previewUrl !== null ? (
          <HtmlPreview
            key={`${paneId}-${selectedTab.id}-${selectedTab.revision}`}
            paneId={paneId}
            tabId={selectedTab.id}
            revision={selectedTab.revision}
            previewUrl={selectedTab.previewUrl}
            isCurrent={isCurrent}
            onActivity={onActivatePane}
            onLoading={(currentPaneId, tabId, revision) =>
              onPreviewStatus(currentPaneId, tabId, revision, "loading-html")
            }
            onReady={(currentPaneId, tabId, revision) =>
              onPreviewStatus(currentPaneId, tabId, revision, "ready")
            }
            onError={(currentPaneId, tabId, revision, message) =>
              onPreviewStatus(currentPaneId, tabId, revision, "error", message)
            }
            onOpenExternal={onOpenExternal}
          />
        ) : selectedTab ? (
          <div className="preview-empty" role={isActive ? "status" : undefined}>
            {selectedTab.loadState === "error"
              ? "Document preview failed."
              : "Loading document..."}
          </div>
        ) : (
          <div className="preview-empty">No document selected.</div>
        )}
      </div>
    </section>
  );
}

type TabStripProps = {
  paneId: PaneId;
  tabs: OpenDocumentTab[];
  activeTabId: string | null;
  splitViewState: SplitViewState;
  previewStatus: PanePreviewStatus | null;
  onActivate: (paneId: PaneId, tabId: string) => void;
  onClose: (paneId: PaneId, tabId: string) => string | null;
};

function TabStrip({
  paneId,
  tabs,
  activeTabId,
  splitViewState,
  previewStatus,
  onActivate,
  onClose,
}: TabStripProps) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      tabRefs.current.get(activeTabId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTabId, tabs.length]);

  function focusTab(tabId: string) {
    window.requestAnimationFrame(() => {
      const button = tabRefs.current.get(tabId);
      button?.focus();
      button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function activateAndFocus(tabId: string) {
    onActivate(paneId, tabId);
    focusTab(tabId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (tabs.length === 0) {
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      activateAndFocus(tabs[nextIndex].id);
    }
  }

  function close(tabId: string) {
    const nextFocusId = onClose(paneId, tabId);
    if (nextFocusId) {
      focusTab(nextFocusId);
    } else {
      window.requestAnimationFrame(() => document.getElementById(`document-pane-${paneId}`)?.focus());
    }
  }

  return (
    <div
      className="tab-strip"
      role="tablist"
      aria-label={`${paneId === "primary" ? "Primary" : "Secondary"} pane open documents`}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const presentationState = resolvePaneTabPresentationState(
          tab,
          paneId,
          splitViewState,
          previewStatus,
        );
        const stateLabel =
          presentationState === "loading"
            ? "Loading"
            : presentationState === "rendering"
              ? "Rendering"
              : presentationState === "error"
                ? "Error"
                : null;
        return (
          <div
            className={`tab-item ${isActive ? "active" : ""} tab-${presentationState}`}
            key={tab.id}
          >
            <button
              ref={(element) => {
                if (element) {
                  tabRefs.current.set(tab.id, element);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              id={`tab-${paneId}-${tab.id}`}
              type="button"
              className="tab-activate"
              role="tab"
              aria-selected={isActive}
              aria-controls={`document-preview-${paneId}`}
              tabIndex={isActive || (activeTabId === null && index === 0) ? 0 : -1}
              title={tab.path}
              onClick={() => onActivate(paneId, tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="tab-name">{tab.displayName}</span>
              {stateLabel ? <span className="tab-state">{stateLabel}</span> : null}
            </button>
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${tab.displayName}`}
              title={`Close ${tab.displayName}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => close(tab.id)}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}

type FileTreeProps = {
  node: FileTreeNode;
  selectedFilePath: string | null;
  disabled: boolean;
  onSelect: (node: FileTreeNode) => void;
};

function FileTree({ node, selectedFilePath, disabled, onSelect }: FileTreeProps) {
  return (
    <div className="file-tree">
      <TreeNode node={node} selectedFilePath={selectedFilePath} disabled={disabled} onSelect={onSelect} level={0} />
    </div>
  );
}

function TreeDisclosure({ expanded }: { expanded: boolean }) {
  return (
    <span className="tree-disclosure" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d={expanded ? "M3.5 5.5 8 10l4.5-4.5" : "M5.5 3.5 10 8l-4.5 4.5"} />
      </svg>
    </span>
  );
}

function TreeNodeIcon({ nodeType, expanded }: { nodeType: FileNodeType; expanded?: boolean }) {
  return (
    <span className={`tree-type-icon tree-type-${nodeType}`} aria-hidden="true">
      {nodeType === "directory" ? (
        <svg viewBox="0 0 18 16" focusable="false">
          <path d={expanded ? "M1.5 5.5h15l-1.8 8H2.6z" : "M1.5 3h5l1.6 2h8.4v8.5h-15z"} />
        </svg>
      ) : nodeType === "markdown" ? (
        <svg viewBox="0 0 18 16" focusable="false">
          <path d="M3 1.5h8l4 4v9H3z M11 1.5v4h4 M5.5 11V8l1.7 2 1.7-2v3 M11 8.5v2.5m0 0-1-1m1 1 1-1" />
        </svg>
      ) : nodeType === "html" ? (
        <svg viewBox="0 0 18 16" focusable="false">
          <path d="M3 1.5h8l4 4v9H3z M11 1.5v4h4 M7.5 8 5.7 9.7l1.8 1.8 M10.5 8l1.8 1.7-1.8 1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 18 16" focusable="false">
          <path d="M2 2h14v12H2z M4 12l3.2-3.5 2.3 2.2 1.8-1.8L14 12 M12.5 5.5h.01" />
        </svg>
      )}
    </span>
  );
}

type TreeNodeProps = FileTreeProps & {
  level: number;
};

function TreeNode({ node, selectedFilePath, disabled, onSelect, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 1);
  const isDirectory = node.nodeType === "directory";
  const isSelected = selectedFilePath === node.path;

  if (isDirectory) {
    return (
      <div>
        <button
          type="button"
          className="tree-row directory-row"
          style={{ paddingLeft: 12 + level * 14 }}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          title={node.path}
        >
          <TreeDisclosure expanded={expanded} />
          <TreeNodeIcon nodeType={node.nodeType} expanded={expanded} />
          <span className="tree-label">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedFilePath={selectedFilePath}
              disabled={disabled}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`tree-row file-row ${isSelected ? "selected" : ""}`}
      style={{ paddingLeft: 12 + level * 14 }}
      disabled={disabled || (node.nodeType !== "markdown" && node.nodeType !== "html")}
      onClick={() => onSelect(node)}
      title={node.path}
    >
      <span className="tree-disclosure-spacer" aria-hidden="true" />
      <TreeNodeIcon nodeType={node.nodeType} />
      <span className="tree-label">{node.name}</span>
    </button>
  );
}

type MarkdownPreviewProps = {
  markdown: string;
  plantUmlDiagrams: PlantUmlDiagramResult[];
  selectedFilePath: string;
  previewRef: React.RefObject<HTMLElement | null>;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
};

function MarkdownPreview({
  markdown,
  plantUmlDiagrams,
  selectedFilePath,
  previewRef,
  onClick,
}: MarkdownPreviewProps) {
  const html = useMemo(
    () => renderMarkdown(markdown, selectedFilePath, plantUmlDiagrams),
    [markdown, plantUmlDiagrams, selectedFilePath],
  );
  // Mermaid replaces its source nodes with SVG outside React. Keep this prop
  // stable so unrelated App renders (such as window resize persistence) do not
  // restore the pre-render Mermaid source HTML.
  const innerHtml = useMemo(() => ({ __html: html }), [html]);

  return (
    <article
      ref={previewRef}
      className="markdown-body"
      tabIndex={-1}
      onClick={onClick}
      dangerouslySetInnerHTML={innerHtml}
    />
  );
}

type HtmlPreviewProps = {
  paneId: PaneId;
  tabId: string;
  revision: number;
  previewUrl: string;
  isCurrent: (paneId: PaneId, tabId: string, revision: number) => boolean;
  onActivity: (paneId: PaneId) => void;
  onLoading: (paneId: PaneId, tabId: string, revision: number) => void;
  onReady: (paneId: PaneId, tabId: string, revision: number) => void;
  onError: (paneId: PaneId, tabId: string, revision: number, message: string) => void;
  onOpenExternal: (paneId: PaneId, tabId: string, revision: number, href: string) => void;
};

function HtmlPreview({
  paneId,
  tabId,
  revision,
  previewUrl,
  isCurrent,
  onActivity,
  onLoading,
  onReady,
  onError,
  onOpenExternal,
}: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let readyAccepted = false;
    let lastExternalOpen: { href: string; timestamp: number } | null = null;
    onLoading(paneId, tabId, revision);
    const timeout = window.setTimeout(() => {
      if (
        isCurrent(paneId, tabId, revision) &&
        hasHtmlReadyHandshakeTimedOut(readyAccepted, htmlReadyTimeoutMs)
      ) {
        onError(
          paneId,
          tabId,
          revision,
          "HTML preview did not complete its security handshake within 5 seconds.",
        );
      }
    }, htmlReadyTimeoutMs);

    function handleMessage(event: MessageEvent<unknown>) {
      const href =
        typeof event.data === "object" &&
        event.data !== null &&
        "href" in event.data &&
        typeof event.data.href === "string"
          ? event.data.href
          : null;
      const now = Date.now();
      const duplicateExternalOpen =
        href !== null &&
        lastExternalOpen?.href === href &&
        now - lastExternalOpen.timestamp < 750;
      const decision = evaluateHtmlBridgeMessage(event.data, {
        sourceMatches: event.source === iframeRef.current?.contentWindow,
        origin: event.origin,
        tabMatches: isCurrent(paneId, tabId, revision),
        revisionMatches: isCurrent(paneId, tabId, revision),
        readyAccepted,
        hasTransientUserActivation: navigator.userActivation?.isActive === true,
        duplicateExternalOpen,
      });
      if (!decision.accepted) {
        console.debug(`Ignored HTML bridge message: ${decision.reason}`);
        return;
      }
      if (decision.action.type === "ready") {
        readyAccepted = true;
        window.clearTimeout(timeout);
        onReady(paneId, tabId, revision);
        return;
      }
      onActivity(paneId);
      lastExternalOpen = { href: decision.action.href, timestamp: now };
      onOpenExternal(paneId, tabId, revision, decision.action.href);
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [paneId, tabId, revision, previewUrl]);

  return (
    <iframe
      ref={iframeRef}
      className="html-preview-frame"
      src={withPreviewRevision(previewUrl, revision)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title="HTML document preview"
      onFocus={() => onActivity(paneId)}
    />
  );
}

function renderMarkdown(
  markdown: string,
  selectedFilePath: string,
  plantUmlDiagrams: PlantUmlDiagramResult[],
) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  });

  const defaultFence = md.renderer.rules.fence?.bind(md.renderer);
  let plantUmlIndex = 0;
  md.renderer.rules.fence = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    const language = token.info.trim().split(/\s+/)[0]?.toLowerCase();

    if (language === "mermaid") {
      return `<div class="mermaid">${escapeHtml(token.content)}</div>`;
    }

    if (language === "plantuml" || language === "puml") {
      const result = plantUmlDiagrams[plantUmlIndex++];
      return result?.html ?? `<pre class="plantuml-loading">PlantUML render pending...</pre>`;
    }

    return defaultFence?.(tokens, idx, options, env, renderer) ?? "";
  };

  const defaultImage = md.renderer.rules.image?.bind(md.renderer);
  md.renderer.rules.image = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    const srcIndex = token.attrIndex("src");

    if (srcIndex >= 0 && token.attrs) {
      const src = token.attrs[srcIndex][1];
      if (src && isRelativeResource(src)) {
        const assetPath = resolveSiblingPath(selectedFilePath, safeDecode(src));
        token.attrs[srcIndex][1] = convertFileSrc(assetPath);
      }

      token.attrSet("loading", "lazy");
    }

    return defaultImage?.(tokens, idx, options, env, renderer) ?? renderer.renderToken(tokens, idx, options);
  };

  md.renderer.rules.heading_open = (tokens, idx, options, _env, renderer) => {
    const nextToken = tokens[idx + 1];
    if (nextToken?.type === "inline") {
      tokens[idx].attrSet("id", slugify(nextToken.content));
    }

    return renderer.renderToken(tokens, idx, options);
  };

  return md.render(markdown);
}

function findReadme(node: FileTreeNode): FileTreeNode | null {
  if (node.nodeType === "markdown" && node.name.toLowerCase() === "readme.md") {
    return node;
  }

  for (const child of node.children) {
    const match = findReadme(child);
    if (match) {
      return match;
    }
  }

  return null;
}

function findFirstMarkdown(node: FileTreeNode): FileTreeNode | null {
  if (node.nodeType === "markdown") {
    return node;
  }

  for (const child of node.children) {
    const match = findFirstMarkdown(child);
    if (match) {
      return match;
    }
  }

  return null;
}

function findFirstHtml(node: FileTreeNode): FileTreeNode | null {
  if (node.nodeType === "html") {
    return node;
  }

  for (const child of node.children) {
    const match = findFirstHtml(child);
    if (match) {
      return match;
    }
  }

  return null;
}

function extractPlantUmlSources(markdown: string) {
  const sources: string[] = [];
  const pattern = /^```[ \t]*(plantuml|puml)[^\r\n]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gim;
  for (const match of markdown.matchAll(pattern)) {
    sources.push(match[2].trim());
  }
  return sources;
}

function isMarkdownPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension ? markdownExtensions.has(extension) : false;
}

function documentTypeForPath(path: string): DocumentType {
  return path.split(".").pop()?.toLowerCase() === "html" ? "html" : "markdown";
}

function isRelativeResource(path: string) {
  return (
    !path.startsWith("#") &&
    !path.startsWith("data:") &&
    !path.startsWith("file:") &&
    !externalUrlPattern.test(path) &&
    !isAbsolutePath(path)
  );
}

function isAbsolutePath(path: string) {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function resolveSiblingPath(filePath: string, relativePath: string) {
  if (isAbsolutePath(relativePath)) {
    return normalizePath(relativePath);
  }

  const separator = filePath.includes("\\") ? "\\" : "/";
  const separatorIndex = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const directory = separatorIndex === 0 ? separator : filePath.slice(0, separatorIndex);
  return normalizePath(`${directory}${separator}${relativePath}`);
}

function normalizePath(path: string) {
  const usesBackslash = /^[A-Za-z]:[\\/]/.test(path) || path.includes("\\");
  const separator = usesBackslash ? "\\" : "/";
  const parts = path.split(/[\\/]+/);
  const output: string[] = [];
  let prefix = "";

  if (path.startsWith("/")) {
    prefix = "/";
  } else if (/^[A-Za-z]:$/.test(parts[0])) {
    prefix = `${parts.shift()}\\`;
  }

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      output.pop();
      continue;
    }
    output.push(part);
  }

  return `${prefix}${output.join(separator)}`;
}

function getFileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function scrollToAnchor(anchor: string, container: HTMLElement | null) {
  if (!anchor || !container) {
    return;
  }

  const target = container.querySelector(`#${CSS.escape(anchor)}`);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toLogicalWindowSize(
  physicalSize: { width: number; height: number },
  scaleFactor: number,
): WindowSize {
  const safeScaleFactor = scaleFactor > 0 ? scaleFactor : 1;
  return {
    width: Math.round(physicalSize.width / safeScaleFactor),
    height: Math.round(physicalSize.height / safeScaleFactor),
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default App;
