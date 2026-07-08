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

type PlantUmlRenderState = {
  key: string;
  diagrams: PlantUmlDiagramResult[];
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
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState("");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false);
  const [isRecentFoldersBusy, setIsRecentFoldersBusy] = useState(false);
  const [recentFolders, setRecentFolders] = useState<RecentFolderEntry[]>([]);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [plantUmlRenderState, setPlantUmlRenderState] = useState<PlantUmlRenderState>({
    key: "",
    diagrams: [],
  });
  const previewRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLElement>(null);
  const emptyPlantUmlDiagrams = useMemo<PlantUmlDiagramResult[]>(() => [], []);

  const selectedFileName = selectedFilePath ? getFileName(selectedFilePath) : "";
  const plantUmlRenderKey = selectedFilePath ? `${selectedFilePath}:${previewRevision}` : "";
  const plantUmlDiagrams =
    plantUmlRenderState.key === plantUmlRenderKey ? plantUmlRenderState.diagrams : emptyPlantUmlDiagrams;
  const isPlantUmlRendering = plantUmlDiagrams.some(
    (diagram) => !diagram.ok && diagram.error === null,
  );
  const isBusy = isMarkdownLoading || isPlantUmlRendering || isRecentFoldersBusy;
  const loadingMessage = isMarkdownLoading
    ? isPlantUmlRendering
      ? "Loading Markdown and rendering PlantUML diagrams..."
      : "Loading Markdown..."
    : isPlantUmlRendering
      ? "Rendering PlantUML diagrams..."
      : isRecentFoldersBusy
        ? "Updating recent folders..."
      : null;

  async function openFolder() {
    if (isBusy) {
      return;
    }

    setErrorMessage(null);

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
    try {
      const tree = await invoke<FileTreeNode>("scan_directory", {
        rootPath: path,
      });
      setRootPath(path);
      setFileTree(tree);

      const initialFile = findReadme(tree) ?? findFirstMarkdown(tree);
      const recentError = options.recordRecent ? await recordRecentFolder(path) : null;
      let markdownError: string | null = null;
      if (initialFile) {
        markdownError = await loadMarkdown(path, initialFile.path);
      } else {
        setSelectedFilePath(null);
        setSelectedMarkdown("");
        setPreviewRevision((revision) => revision + 1);
        setErrorMessage(null);
      }

      if (recentError && !markdownError) {
        setErrorMessage(recentError);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
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
    if (isBusy) {
      return;
    }

    setActiveMenu(null);
    await loadRoot(path, { recordRecent: true });
  }

  async function removeRecentFolder(path: string) {
    if (isBusy) {
      return;
    }

    setIsRecentFoldersBusy(true);
    try {
      const entries = await invoke<RecentFolderEntry[]>("remove_recent_folder", { path });
      setRecentFolders(entries);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsRecentFoldersBusy(false);
    }
  }

  async function reload() {
    if (!rootPath || isBusy) {
      return;
    }

    try {
      const tree = await invoke<FileTreeNode>("scan_directory", {
        rootPath,
      });
      setFileTree(tree);

      if (selectedFilePath) {
        await loadMarkdown(rootPath, selectedFilePath);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function loadMarkdown(currentRootPath: string, filePath: string, anchor?: string) {
    if (isBusy) {
      return null;
    }

    setIsMarkdownLoading(true);
    try {
      const markdown = await invoke<string>("read_text_file", {
        rootPath: currentRootPath,
        path: filePath,
      });
      setSelectedFilePath(filePath);
      setSelectedMarkdown(markdown);
      setPreviewRevision((revision) => revision + 1);
      setPendingAnchor(anchor ?? null);
      setErrorMessage(null);
      return null;
    } catch (error) {
      const message = toErrorMessage(error);
      setErrorMessage(message);
      return message;
    } finally {
      setIsMarkdownLoading(false);
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

    if (!rootPath || !selectedFilePath) {
      return;
    }

    const [rawPath, rawAnchor] = href.split("#");
    if (!isMarkdownPath(rawPath)) {
      return;
    }

    event.preventDefault();
    const nextPath = resolveSiblingPath(selectedFilePath, safeDecode(rawPath));
    await loadMarkdown(rootPath, nextPath, rawAnchor ? safeDecode(rawAnchor) : undefined);
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
          setErrorMessage(toErrorMessage(error));
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
    if (!selectedFilePath) {
      setPlantUmlRenderState({ key: "", diagrams: [] });
      return;
    }

    const sources = extractPlantUmlSources(selectedMarkdown);
    const renderKey = `${selectedFilePath}:${previewRevision}`;
    if (sources.length === 0) {
      setPlantUmlRenderState({ key: renderKey, diagrams: [] });
      return;
    }

    let cancelled = false;
    setPlantUmlRenderState({
      key: renderKey,
      diagrams: sources.map(() => ({
        ok: false,
        html: `<pre class="plantuml-loading">PlantUML render pending...</pre>`,
        error: null,
      })),
    });

    invoke<PlantUmlRenderResponse>("render_plantuml_diagrams", { sources })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setPlantUmlRenderState({
          key: renderKey,
          diagrams: response.diagrams,
        });
        if (response.firstError) {
          setErrorMessage(response.firstError);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = toErrorMessage(error);
        setErrorMessage(message);
        setPlantUmlRenderState({
          key: renderKey,
          diagrams: sources.map(() => ({
            ok: false,
            html: `<pre class="plantuml-error">PlantUML render failed: ${escapeHtml(message)}</pre>`,
            error: message,
          })),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFilePath, selectedMarkdown, previewRevision]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });

    const container = previewRef.current;
    if (!container) {
      return;
    }

    const nodes = container.querySelectorAll<HTMLElement>(".mermaid");
    if (nodes.length === 0) {
      return;
    }

    let cancelled = false;
    mermaid.run({ nodes }).catch((error) => {
      if (!cancelled) {
        setErrorMessage(`Mermaid render failed: ${toErrorMessage(error)}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [previewRevision, theme, plantUmlDiagrams]);

  useEffect(() => {
    if (!pendingAnchor || !previewRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      scrollToAnchor(pendingAnchor, previewRef.current);
      setPendingAnchor(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pendingAnchor, previewRevision]);

  return (
    <main className="app-shell">
      <MenuBar
        menuBarRef={menuBarRef}
        rootPath={rootPath}
        theme={theme}
        isBusy={isBusy}
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
              selectedFilePath={selectedFilePath}
              disabled={isBusy}
              onSelect={(node) => rootPath && loadMarkdown(rootPath, node.path)}
            />
          ) : (
            <div className="empty-state">Open a folder to browse Markdown files.</div>
          )}
        </aside>

        <section className="preview-pane" aria-label="Markdown Preview">
          {selectedFilePath ? (
            <MarkdownPreview
              key={`${selectedFilePath}-${theme}-${previewRevision}`}
              markdown={selectedMarkdown}
              plantUmlDiagrams={plantUmlDiagrams}
              selectedFilePath={selectedFilePath}
              previewRef={previewRef}
              onClick={handlePreviewClick}
            />
          ) : (
            <div className="preview-empty">No Markdown file selected.</div>
          )}
        </section>
      </section>

      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <StatusBar
        selectedFileName={selectedFileName}
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
