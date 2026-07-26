# アーキテクチャ概要

## コアコンポーネント

### Avalonia Viewer (`Avalonia/MarkdownViewer.Avalonia/`)

Avalonia UI と C# による Markdown Viewer 実装。

- View: `Views/MainWindow.axaml`
- ViewModel: `ViewModels/MainWindowViewModel.cs`, `ViewModels/FileTreeNodeViewModel.cs`
- Service: `Services/FileTreeService.cs`, `Services/MarkdownRenderService.cs`, `Services/PlantUmlRenderService.cs`, `Services/PlantUmlRuntimeResolver.cs`, `Services/HtmlTemplateService.cs`
- Model: `Models/FileTreeNode.cs`, `Models/FileNodeType.cs`, `Models/AppTheme.cs`
- Markdown 表示: 生成HTMLを一時fileへ書き出し、NativeWebViewでfile URIへnavigateして表示する。
- PlantUML 表示: ローカル Java / `plantuml.jar` を使ってSVG化し、HTML fragmentへ差し替える。

### Tauri Viewer (`markdown-viewer-tauri/`)

Tauri v2、React、TypeScript、Rust による Markdown Viewer 実装。

- Frontend: `src/App.tsx`, `src/App.css`, `src/splitView.ts`, `src/paneRuntime.ts`, `src/documentPolicy.ts`
- Rust command: `src-tauri/src/lib.rs`
- Tauri config: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Markdown 表示: `markdown-it` でHTML化し、React側で表示する。
- Split View: `OpenDocumentTab[]`を共有データの正本とし、`SplitViewState`がprimary / secondaryの選択、active pane、session-only ratioを管理する。
- Mermaid 表示: App instance所有queueでpaneごとの描画を直列化し、pane / tab / revision guardとpane固有render IDで結果の混線を防ぐ。
- PlantUML 表示: Rust command がローカル Java / `plantuml.jar` を使ってSVG化し、React側でHTMLへ差し替える。
- HTML 表示: Rust `DocumentStore` が current root と `open_document` / `mvhtml` protocol を管理し、React は `sandbox="allow-scripts"` の iframe へ preview URL を渡す。HTML source は frontend state へ返さない。
- HTML 境界: canonical root 検証、resource allowlist、response CSP/CORS、shell CSP、opaque-origin iframe、typed message policy を重ねる。HTML protocol originへ Tauri capability を付与しない。

## 基本フロー

1. ユーザーがアプリを起動する。
2. フォルダ選択ダイアログでdocumentルートを選ぶ。
3. ファイルツリーを構築し、Explorerに表示する。
4. `.md` / `.markdown` は本文を読み込み、`.html` はroot-relative preview URLを生成する。
5. MarkdownはReact DOM、trusted HTMLはsandboxed iframeでactiveなdocument paneに表示する。Split Viewでは左右paneが同じtab collectionから独立に選択する。
6. Mermaidコードブロックを図として描画する。
7. PlantUMLコードブロックをローカルPlantUML CLIでSVGとして描画する。
8. 相対Markdownリンクはアプリ内遷移し、外部URLは既定ブラウザで開く。
9. HTML の user-clicked `http(s)` link は iframe bridge と frontend policy の検証後に既定ブラウザで開く。

## 主要ファイルリファレンス

- 比較設計: `docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md`
- Avalonia entry point: `Avalonia/MarkdownViewer.Avalonia/Program.cs`
- Avalonia main view: `Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml`
- Avalonia main state: `Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs`
- Tauri frontend: `markdown-viewer-tauri/src/App.tsx`
- Tauri backend commands: `markdown-viewer-tauri/src-tauri/src/lib.rs`
- Tauri config: `markdown-viewer-tauri/src-tauri/tauri.conf.json`

## ソリューション構成

```text
MarkdownViewer/
├── Avalonia/
│   └── MarkdownViewer.Avalonia/
│       ├── Models/
│       ├── Services/
│       ├── ViewModels/
│       └── Views/
├── markdown-viewer-tauri/
│   ├── src/
│   └── src-tauri/
├── docs/
├── instructions/
├── scripts/
└── tools/
```

## ドキュメント構成

```text
docs/
├── architecture/     — アーキテクチャ概要・パターン・注意点
├── components/       — コンポーネント別の設計文書
├── design_analysis/  — 設計分析・レビュー文書
├── rules/            — 開発ルール
├── tests/            — テスト方針・構成
├── todo/             — 追跡項目（spec-change / new-feature / refactoring / documentation）
├── issues/           — 追跡項目（bugfix / issue-resolution）
└── history/          — 実装履歴
```

## 設計文書リファレンス

- Avalonia Viewer: `docs/components/avalonia_viewer/README.md`
- Tauri Viewer: `docs/components/tauri_viewer/README.md`
