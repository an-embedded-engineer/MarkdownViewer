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

- Frontend: `src/App.tsx`, `src/App.css`
- Rust command: `src-tauri/src/lib.rs`
- Tauri config: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Markdown 表示: `markdown-it` でHTML化し、React側で表示する。
- Mermaid 表示: `mermaid` をReactのプレビュー更新タイミングで実行する。
- PlantUML 表示: Rust command がローカル Java / `plantuml.jar` を使ってSVG化し、React側でHTMLへ差し替える。

## 基本フロー

1. ユーザーがアプリを起動する。
2. フォルダ選択ダイアログでMarkdownルートを選ぶ。
3. ファイルツリーを構築し、Explorerに表示する。
4. `.md` / `.markdown` ファイル選択時にMarkdown本文を読み込む。
5. MarkdownをHTMLへ変換し、右ペインに表示する。
6. Mermaidコードブロックを図として描画する。
7. PlantUMLコードブロックをローカルPlantUML CLIでSVGとして描画する。
8. 相対Markdownリンクはアプリ内遷移し、外部URLは既定ブラウザで開く。

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
