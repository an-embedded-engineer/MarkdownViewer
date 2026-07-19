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

type PendingNavigation = {
  tabId: string;
  anchor: string;
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

const markdownExtensions = new Set(["md", "markdown"]);
const externalUrlPattern = /^(https?:)?\/\//i;
const defaultWindowSize: WindowSize = { width: 800, height: 600 };
const windowResizeSaveDelay = 500;

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [tabs, setTabs] = useState<OpenDocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
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
  const previewRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLElement>(null);
  const fileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<OpenDocumentTab[]>([]);
  const nextTabIdRef = useRef(1);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const isAppConfigBusy = isStartupConfigLoading || foregroundConfigOperationCount > 0;
  const isGlobalBusy = isRootLoading || isAppConfigBusy;
  const errorMessage = appConfigError ?? rootOperationError ?? activeTab?.errorMessage ?? null;
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
          : null;

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
      setActiveTabId(null);
      setPendingNavigation(null);

      const initialFile = findReadme(tree) ?? findFirstMarkdown(tree) ?? findFirstHtml(tree);
      if (initialFile) {
        openOrActivateTab(initialFile.path);
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
        void loadTab(activeTab.id, activeTab.path, revision);
      }
    } catch (error) {
      setRootOperationError(toErrorMessage(error));
    } finally {
      setIsRootLoading(false);
    }
  }

  function openOrActivateTab(filePath: string, anchor?: string) {
    const existing = tabsRef.current.find((tab) => tab.path === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      setPendingNavigation(anchor ? { tabId: existing.id, anchor } : null);
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
    setActiveTabId(tabId);
    setPendingNavigation(anchor ? { tabId, anchor } : null);
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
          loadState: "loading",
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

  function markHtmlReady(tabId: string, revision: number) {
    updateTabIfCurrent(tabId, revision, (tab) => ({
      ...tab,
      loadState: "ready",
      errorMessage: null,
    }));
  }

  function markHtmlError(tabId: string, revision: number, message: string) {
    updateTabIfCurrent(tabId, revision, (tab) => ({
      ...tab,
      loadState: "error",
      errorMessage: message,
    }));
  }

  async function openHtmlExternalUrl(tabId: string, revision: number, href: string) {
    try {
      await openUrl(href);
    } catch (error) {
      markHtmlError(tabId, revision, `Failed to open external URL: ${toErrorMessage(error)}`);
    }
  }

  function activateTab(tabId: string) {
    setActiveTabId(tabId);
  }

  function closeTab(tabId: string): string | null {
    const current = tabsRef.current;
    const closeIndex = current.findIndex((tab) => tab.id === tabId);
    if (closeIndex < 0) {
      return activeTabId;
    }

    const next = current.filter((tab) => tab.id !== tabId);
    updateTabs(() => next);
    setPendingNavigation((navigation) => (navigation?.tabId === tabId ? null : navigation));

    if (activeTabId === tabId) {
      const adjacent = next[closeIndex] ?? next[closeIndex - 1] ?? null;
      setActiveTabId(adjacent?.id ?? null);
      return adjacent?.id ?? null;
    }

    return activeTabId;
  }

  async function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");
    const href = anchor?.getAttribute("href");

    if (!href) {
      return;
    }

    if (href.startsWith("#")) {
      event.preventDefault();
      scrollToAnchor(href.slice(1), previewRef.current);
      return;
    }

    if (externalUrlPattern.test(href) || href.startsWith("mailto:")) {
      event.preventDefault();
      await openUrl(href);
      return;
    }

    if (!rootPath || !activeTab) {
      return;
    }

    const [rawPath, rawAnchor] = href.split("#");
    if (!isMarkdownPath(rawPath)) {
      return;
    }

    event.preventDefault();
    const nextPath = resolveSiblingPath(activeTab.path, safeDecode(rawPath));
    openOrActivateTab(nextPath, rawAnchor ? safeDecode(rawAnchor) : undefined);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });

    const container = previewRef.current;
    if (!container || !activeTab || activeTab.documentType !== "markdown") {
      return;
    }

    const nodes = container.querySelectorAll<HTMLElement>(".mermaid");
    if (nodes.length === 0) {
      return;
    }

    let cancelled = false;
    const tabId = activeTab.id;
    const revision = activeTab.revision;
    mermaid.run({ nodes }).catch((error) => {
      if (!cancelled) {
        updateTabIfCurrent(tabId, revision, (tab) => ({
          ...tab,
          loadState: "error",
          errorMessage: `Mermaid render failed: ${toErrorMessage(error)}`,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab?.id, activeTab?.revision, activeTab?.plantUmlDiagrams, theme]);

  useEffect(() => {
    if (
      !pendingNavigation ||
      !activeTab ||
      activeTab.documentType !== "markdown" ||
      activeTab.loadState === "loading" ||
      pendingNavigation.tabId !== activeTab.id ||
      !previewRef.current
    ) {
      return;
    }

    const tabId = activeTab.id;
    const revision = activeTab.revision;
    const timer = window.setTimeout(() => {
      scrollToAnchor(pendingNavigation.anchor, previewRef.current);
      setPendingNavigation((current) =>
        current?.tabId === tabId && tabsRef.current.some((tab) => tab.id === tabId && tab.revision === revision)
          ? null
          : current,
      );
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pendingNavigation, activeTab?.id, activeTab?.revision, activeTab?.loadState]);

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
        className="app-shell"
        aria-hidden={settingsDraft ? true : undefined}
        inert={settingsDraft ? true : undefined}
      >
        <MenuBar
          menuBarRef={menuBarRef}
          fileMenuButtonRef={fileMenuButtonRef}
          rootPath={rootPath}
          theme={theme}
          isBusy={isGlobalBusy}
          activeMenu={activeMenu}
          recentFolders={recentFolders}
          onOpenFolder={openFolder}
          onReload={reload}
          onToggleTheme={() => void saveTheme(theme === "light" ? "dark" : "light")}
          onOpenSettings={() => void openSettings()}
          onMenuToggle={(menu) => setActiveMenu((value) => (value === menu ? null : menu))}
          onCloseMenu={() => setActiveMenu(null)}
          onOpenRecentFolder={openRecentFolder}
          onRemoveRecentFolder={removeRecentFolder}
        />

        <RootPathBar rootPath={rootPath} />

      <section className="workspace">
        <aside className="explorer-pane" aria-label="Explorer">
          <div className="pane-title">Explorer</div>
          {fileTree ? (
            <FileTree
              node={fileTree}
              selectedFilePath={activeTab?.path ?? null}
              disabled={isGlobalBusy}
              onSelect={(node) => rootPath && openOrActivateTab(node.path)}
            />
          ) : (
            <div className="empty-state">Open a folder to browse documents.</div>
          )}
        </aside>

        <section className="preview-workspace" aria-label="Document Preview">
          <TabStrip
            tabs={tabs}
            activeTabId={activeTabId}
            onActivate={activateTab}
            onClose={closeTab}
          />
          <div
            className="preview-pane"
            id="document-preview"
            role="tabpanel"
            aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
          >
            {activeTab?.documentType === "markdown" && activeTab.sourceText !== null ? (
              <MarkdownPreview
                key={`${activeTab.id}-${theme}-${activeTab.revision}`}
                markdown={activeTab.sourceText}
                plantUmlDiagrams={activeTab.plantUmlDiagrams}
                selectedFilePath={activeTab.path}
                previewRef={previewRef}
                onClick={handlePreviewClick}
              />
            ) : activeTab?.documentType === "html" && activeTab.previewUrl !== null ? (
              <HtmlPreview
                key={`${activeTab.id}-${activeTab.revision}`}
                tabId={activeTab.id}
                revision={activeTab.revision}
                activeTabId={activeTab.id}
                activeRevision={activeTab.revision}
                previewUrl={activeTab.previewUrl}
                onReady={markHtmlReady}
                onError={markHtmlError}
                onOpenExternal={(tabId, revision, href) =>
                  void openHtmlExternalUrl(tabId, revision, href)
                }
              />
            ) : activeTab ? (
              <div className="preview-empty" role="status">
                {activeTab.loadState === "error" ? "Document preview failed." : "Loading document..."}
              </div>
            ) : (
              <div className="preview-empty">No document selected.</div>
            )}
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
    </>
  );
}

type MenuBarProps = {
  menuBarRef: React.RefObject<HTMLElement | null>;
  fileMenuButtonRef: React.RefObject<HTMLButtonElement | null>;
  rootPath: string | null;
  theme: Theme;
  isBusy: boolean;
  activeMenu: ActiveMenu;
  recentFolders: RecentFolderEntry[];
  onOpenFolder: () => void;
  onReload: () => void;
  onToggleTheme: () => void;
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
  isBusy,
  activeMenu,
  recentFolders,
  onOpenFolder,
  onReload,
  onToggleTheme,
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

type TabStripProps = {
  tabs: OpenDocumentTab[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => string | null;
};

function TabStrip({ tabs, activeTabId, onActivate, onClose }: TabStripProps) {
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
    onActivate(tabId);
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
    const nextFocusId = onClose(tabId);
    if (nextFocusId) {
      focusTab(nextFocusId);
    }
  }

  return (
    <div className="tab-strip" role="tablist" aria-label="Open documents">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const stateLabel =
          tab.loadState === "loading"
            ? "Loading"
            : tab.loadState === "rendering"
              ? "Rendering"
              : tab.loadState === "error"
                ? "Error"
                : null;
        return (
          <div className={`tab-item ${isActive ? "active" : ""} tab-${tab.loadState}`} key={tab.id}>
            <button
              ref={(element) => {
                if (element) {
                  tabRefs.current.set(tab.id, element);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              id={`tab-${tab.id}`}
              type="button"
              className="tab-activate"
              role="tab"
              aria-selected={isActive}
              aria-controls="document-preview"
              tabIndex={isActive ? 0 : -1}
              title={tab.path}
              onClick={() => onActivate(tab.id)}
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
          onClick={() => setExpanded((value) => !value)}
          title={node.path}
        >
          <span className="tree-icon">{expanded ? "v" : ">"}</span>
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
      <span className="tree-icon">
        {node.nodeType === "markdown" ? "MD" : node.nodeType === "html" ? "HTML" : "IMG"}
      </span>
      <span className="tree-label">{node.name}</span>
    </button>
  );
}

type MarkdownPreviewProps = {
  markdown: string;
  plantUmlDiagrams: PlantUmlDiagramResult[];
  selectedFilePath: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
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

  return (
    <article
      ref={previewRef}
      className="markdown-body"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type HtmlPreviewProps = {
  tabId: string;
  revision: number;
  activeTabId: string;
  activeRevision: number;
  previewUrl: string;
  onReady: (tabId: string, revision: number) => void;
  onError: (tabId: string, revision: number, message: string) => void;
  onOpenExternal: (tabId: string, revision: number, href: string) => void;
};

function HtmlPreview({
  tabId,
  revision,
  activeTabId,
  activeRevision,
  previewUrl,
  onReady,
  onError,
  onOpenExternal,
}: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let readyAccepted = false;
    let lastExternalOpen: { href: string; timestamp: number } | null = null;
    const timeout = window.setTimeout(() => {
      if (hasHtmlReadyHandshakeTimedOut(readyAccepted, htmlReadyTimeoutMs)) {
        onError(
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
        tabMatches: activeTabId === tabId,
        revisionMatches: activeRevision === revision,
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
        onReady(tabId, revision);
        return;
      }
      lastExternalOpen = { href: decision.action.href, timestamp: now };
      onOpenExternal(tabId, revision, decision.action.href);
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [tabId, revision, activeTabId, activeRevision]);

  return (
    <iframe
      ref={iframeRef}
      className="html-preview-frame"
      src={withPreviewRevision(previewUrl, revision)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title="HTML document preview"
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
