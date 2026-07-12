import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import MarkdownIt from "markdown-it";
import mermaid from "mermaid";
import "./App.css";

type FileNodeType = "directory" | "markdown" | "image";

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
  markdown: string;
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

type ActiveMenu = "file" | "view" | null;

const markdownExtensions = new Set(["md", "markdown"]);
const externalUrlPattern = /^(https?:)?\/\//i;

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [tabs, setTabs] = useState<OpenDocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [rootOperationError, setRootOperationError] = useState<string | null>(null);
  const [isRootLoading, setIsRootLoading] = useState(false);
  const [isRecentFoldersBusy, setIsRecentFoldersBusy] = useState(false);
  const [recentFolders, setRecentFolders] = useState<RecentFolderEntry[]>([]);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<OpenDocumentTab[]>([]);
  const nextTabIdRef = useRef(1);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const isGlobalBusy = isRootLoading || isRecentFoldersBusy;
  const errorMessage = rootOperationError ?? activeTab?.errorMessage ?? null;
  const loadingMessage = isRootLoading
    ? "Loading folder..."
    : isRecentFoldersBusy
      ? "Updating recent folders..."
      : activeTab?.loadState === "loading"
        ? "Loading Markdown..."
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

  async function openFolder() {
    if (isGlobalBusy) {
      return;
    }

    setRootOperationError(null);

    const selected = await openDialog({
      directory: true,
      multiple: false,
      recursive: true,
      title: "Open Markdown Folder",
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
      tabsRef.current = [];
      setTabs([]);
      setActiveTabId(null);
      setPendingNavigation(null);

      const initialFile = findReadme(tree) ?? findFirstMarkdown(tree);
      if (initialFile) {
        openOrActivateTab(path, initialFile.path);
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
    setIsRecentFoldersBusy(true);
    try {
      const entries = await invoke<RecentFolderEntry[]>("record_recent_folder", { path });
      setRecentFolders(entries);
      return null;
    } catch (error) {
      return toErrorMessage(error);
    } finally {
      setIsRecentFoldersBusy(false);
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

    setIsRecentFoldersBusy(true);
    try {
      const entries = await invoke<RecentFolderEntry[]>("remove_recent_folder", { path });
      setRecentFolders(entries);
      setRootOperationError(null);
    } catch (error) {
      setRootOperationError(toErrorMessage(error));
    } finally {
      setIsRecentFoldersBusy(false);
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
          loadState: "loading",
          errorMessage: null,
        }));
        void loadTab(activeTab.id, rootPath, activeTab.path, revision);
      }
    } catch (error) {
      setRootOperationError(toErrorMessage(error));
    } finally {
      setIsRootLoading(false);
    }
  }

  function openOrActivateTab(currentRootPath: string, filePath: string, anchor?: string) {
    setRootOperationError(null);
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
      markdown: "",
      revision: 1,
      loadState: "loading",
      errorMessage: null,
      plantUmlDiagrams: [],
    };
    tabsRef.current = [...tabsRef.current, tab];
    setTabs(tabsRef.current);
    setActiveTabId(tabId);
    setPendingNavigation(anchor ? { tabId, anchor } : null);
    void loadTab(tabId, currentRootPath, filePath, tab.revision);
  }

  async function loadTab(tabId: string, currentRootPath: string, filePath: string, revision: number) {
    try {
      const markdown = await invoke<string>("read_text_file", {
        rootPath: currentRootPath,
        path: filePath,
      });
      const sources = extractPlantUmlSources(markdown);
      const pendingDiagrams = sources.map(() => ({
        ok: false,
        html: `<pre class="plantuml-loading">PlantUML render pending...</pre>`,
        error: null,
      }));
      updateTabIfCurrent(tabId, revision, (tab) => ({
        ...tab,
        markdown,
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

  function activateTab(tabId: string) {
    setActiveTabId(tabId);
    setRootOperationError(null);
  }

  function closeTab(tabId: string) {
    const current = tabsRef.current;
    const closeIndex = current.findIndex((tab) => tab.id === tabId);
    if (closeIndex < 0) {
      return;
    }

    const next = current.filter((tab) => tab.id !== tabId);
    tabsRef.current = next;
    setTabs(next);
    setPendingNavigation((navigation) => (navigation?.tabId === tabId ? null : navigation));

    if (activeTabId === tabId) {
      const adjacent = next[closeIndex] ?? next[closeIndex - 1] ?? null;
      setActiveTabId(adjacent?.id ?? null);
    }
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
    openOrActivateTab(rootPath, nextPath, rawAnchor ? safeDecode(rawAnchor) : undefined);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    setIsRecentFoldersBusy(true);

    invoke<RecentFolderEntry[]>("load_recent_folders")
      .then((entries) => {
        if (!cancelled) {
          setRecentFolders(entries);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRootOperationError(toErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRecentFoldersBusy(false);
        }
      });

    return () => {
      cancelled = true;
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
    if (!container || !activeTab) {
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

  return (
    <main className="app-shell">
      <MenuBar
        menuBarRef={menuBarRef}
        rootPath={rootPath}
        theme={theme}
        isBusy={isGlobalBusy}
        activeMenu={activeMenu}
        recentFolders={recentFolders}
        onOpenFolder={openFolder}
        onReload={reload}
        onToggleTheme={() => {
          setActiveMenu(null);
          setTheme((value) => (value === "light" ? "dark" : "light"));
        }}
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
              onSelect={(node) => rootPath && openOrActivateTab(rootPath, node.path)}
            />
          ) : (
            <div className="empty-state">Open a folder to browse Markdown files.</div>
          )}
        </aside>

        <section className="preview-workspace" aria-label="Markdown Preview">
          <TabStrip
            tabs={tabs}
            activeTabId={activeTabId}
            onActivate={activateTab}
            onClose={closeTab}
          />
          <div
            className="preview-pane"
            id="markdown-preview"
            role="tabpanel"
            aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
          >
            {activeTab ? (
              <MarkdownPreview
                key={`${activeTab.id}-${theme}-${activeTab.revision}`}
                markdown={activeTab.markdown}
                plantUmlDiagrams={activeTab.plantUmlDiagrams}
                selectedFilePath={activeTab.path}
                previewRef={previewRef}
                onClick={handlePreviewClick}
              />
            ) : (
              <div className="preview-empty">No Markdown file selected.</div>
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
  );
}

type MenuBarProps = {
  menuBarRef: React.RefObject<HTMLElement | null>;
  rootPath: string | null;
  theme: Theme;
  isBusy: boolean;
  activeMenu: ActiveMenu;
  recentFolders: RecentFolderEntry[];
  onOpenFolder: () => void;
  onReload: () => void;
  onToggleTheme: () => void;
  onMenuToggle: (menu: Exclude<ActiveMenu, null>) => void;
  onCloseMenu: () => void;
  onOpenRecentFolder: (path: string) => void;
  onRemoveRecentFolder: (path: string) => void;
};

function MenuBar({
  menuBarRef,
  rootPath,
  theme,
  isBusy,
  activeMenu,
  recentFolders,
  onOpenFolder,
  onReload,
  onToggleTheme,
  onMenuToggle,
  onCloseMenu,
  onOpenRecentFolder,
  onRemoveRecentFolder,
}: MenuBarProps) {
  return (
    <header ref={menuBarRef} className="menu-bar" aria-label="Application menu">
      <div className="menu-group">
        <button
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
  onClose: (tabId: string) => void;
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

  function close(tabId: string, index: number) {
    const wasActive = tabId === activeTabId;
    const nextFocusId = wasActive
      ? (tabs[index + 1]?.id ?? tabs[index - 1]?.id ?? null)
      : (activeTabId ?? null);
    onClose(tabId);
    if (nextFocusId) {
      focusTab(nextFocusId);
    }
  }

  return (
    <div className="tab-strip" role="tablist" aria-label="Open Markdown files">
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
              aria-controls="markdown-preview"
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
              onClick={() => close(tab.id, index)}
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
      disabled={disabled || node.nodeType !== "markdown"}
      onClick={() => onSelect(node)}
      title={node.path}
    >
      <span className="tree-icon">{node.nodeType === "markdown" ? "MD" : "IMG"}</span>
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

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default App;
