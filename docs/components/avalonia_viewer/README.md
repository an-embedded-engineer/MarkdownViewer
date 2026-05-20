# Avalonia Viewer

## 目的

Avalonia UI + C# + NativeWebView による Markdown Viewer MVP 実装。

## 責務

- ネイティブデスクトップアプリとしてフォルダを選択する。
- Explorer風のファイルツリーを表示する。
- MarkdownをHTMLへ変換し、WebViewで表示する。
- Mermaid、PlantUML、相対画像、リンク遷移、テーマ切替を扱う。

## 主要要素

- `Views/MainWindow.axaml`: 画面レイアウト。
- `ViewModels/MainWindowViewModel.cs`: UI状態と操作。
- `Services/FileTreeService.cs`: ディレクトリ走査。
- `Services/MarkdownRenderService.cs`: MarkdownからHTML fragmentへの非同期変換。Mermaid / PlantUML fenceをプレビュー用HTMLへ差し替える。
- `Services/PlantUmlRenderService.cs`: `java -jar plantuml.jar -tsvg -pipe` によるPlantUML SVG生成。
- `Services/PlantUmlRuntimeResolver.cs`: `plantuml.config.json` または runtime directory の `plantuml.jar` を解決する。
- `Services/HtmlTemplateService.cs`: WebViewへ渡すHTML文書生成。
- `Models/FileTreeNode.cs`: Explorer表示用データモデル。

## 依存関係

- Avalonia UI
- Avalonia.Controls.WebView
- Markdig
- CommunityToolkit.Mvvm
- Java / `plantuml.jar`（PlantUML表示時のみ）

## 設計文書

- 基本設計: `docs/components/avalonia_viewer/basic_design.md`
- 詳細設計: `docs/components/avalonia_viewer/detail_design.md`
- インターフェース仕様: `docs/components/avalonia_viewer/interface_spec.md`
- 既知課題: `docs/components/avalonia_viewer/issues.md`
