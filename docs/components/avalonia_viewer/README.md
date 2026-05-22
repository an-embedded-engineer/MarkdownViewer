# Avalonia Viewer

## 目的

Avalonia UI + C# + NativeWebView による Markdown Viewer MVP 実装。

## 責務

- ネイティブデスクトップアプリとしてフォルダを選択する。
- Explorer風のファイルツリーを表示する。
- MarkdownをHTMLへ変換し、WebViewで表示する。
- Mermaid、PlantUML、相対画像、リンク遷移、テーマ切替を扱う。

## 技術スタック

| 区分 | 採用技術 / バージョン | 用途 |
|---|---|---|
| Framework | .NET 10 (`net10.0`) | ランタイム / SDK |
| Language | C# (Nullable enabled, ImplicitUsings) | アプリ実装 |
| UI | Avalonia UI 12.0.3 | クロスプラットフォーム XAML UI |
| Theme | Avalonia.Themes.Fluent 12.0.3 | Fluent テーマ |
| Font | Avalonia.Fonts.Inter 12.0.3 | フォント |
| WebView | Avalonia.Controls.WebView 12.0.1 | OS ネイティブ WebView ホスト |
| MVVM | CommunityToolkit.Mvvm 8.4.1 | `[ObservableProperty]` などのソースジェネレータ |
| Markdown | Markdig 1.2.0 + Advanced extensions | Markdown → HTML 変換 |
| Mermaid | Avalonia リソース埋め込み `Assets/mermaid.min.js` | クライアント描画 |
| PlantUML | `java -jar plantuml.jar -tsvg -pipe` | SVG 生成 (Java プロセス) |

## ディレクトリ構成

```
Avalonia/
└── MarkdownViewer.Avalonia/
    ├── App.axaml / App.axaml.cs           — Application、ライフタイム、MainWindow生成
    ├── Program.cs                          — エントリーポイント、AppBuilder設定
    ├── ViewLocator.cs                      — ViewModel→View 解決
    ├── MarkdownViewer.Avalonia.csproj      — SDK・パッケージ参照
    ├── Assets/                             — アイコン、Mermaid script など
    ├── Models/
    │   ├── AppTheme.cs                     — Light / Dark の enum
    │   ├── FileNodeType.cs                 — Directory / Markdown / Image / Other
    │   └── FileTreeNode.cs                 — Explorer ノードデータモデル
    ├── ViewModels/
    │   ├── ViewModelBase.cs                — ObservableObject ベース
    │   ├── MainWindowViewModel.cs          — メイン状態と操作
    │   └── FileTreeNodeViewModel.cs        — Tree 表示用 VM
    ├── Views/
    │   └── MainWindow.axaml(+ .cs)         — Toolbar / Explorer / WebView レイアウト
    └── Services/
        ├── FileTreeService.cs              — ディレクトリ走査、除外、並び替え
        ├── MarkdownRenderService.cs        — Markdown→HTML、Mermaid/PlantUML fence 抽出
        ├── PlantUmlRenderService.cs        — Java 経由で PlantUML→SVG
        ├── PlantUmlRuntimeResolver.cs      — plantuml.jar / config 探索
        └── HtmlTemplateService.cs          — WebView 用 HTML 文書生成
```

## 主要要素

| 要素 | 役割 | ソース |
|---|---|---|
| `Program` | エントリーポイント、`BuildAvaloniaApp` を起動 | [Avalonia/MarkdownViewer.Avalonia/Program.cs](Avalonia/MarkdownViewer.Avalonia/Program.cs) |
| `App` | `MainWindow` + `MainWindowViewModel` の生成 | [Avalonia/MarkdownViewer.Avalonia/App.axaml.cs](Avalonia/MarkdownViewer.Avalonia/App.axaml.cs) |
| `MainWindow` | Toolbar / Explorer / WebView レイアウト、`NativeWebView` ホスト | [Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml](Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml) |
| `MainWindowViewModel` | root path、ファイルツリー、選択 Markdown、テーマ、busy 状態 | [Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs](Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs) |
| `FileTreeNodeViewModel` | Explorer 表示用、選択判定、アイコン | [Avalonia/MarkdownViewer.Avalonia/ViewModels/FileTreeNodeViewModel.cs](Avalonia/MarkdownViewer.Avalonia/ViewModels/FileTreeNodeViewModel.cs) |
| `FileTreeService` | 除外ディレクトリを考慮した再帰走査と並び替え | [Avalonia/MarkdownViewer.Avalonia/Services/FileTreeService.cs](Avalonia/MarkdownViewer.Avalonia/Services/FileTreeService.cs) |
| `MarkdownRenderService` | Markdig 経由の Markdown→HTML、`mermaid` / `plantuml` / `puml` fence をプレースホルダで抽出して差し替え | [Avalonia/MarkdownViewer.Avalonia/Services/MarkdownRenderService.cs](Avalonia/MarkdownViewer.Avalonia/Services/MarkdownRenderService.cs) |
| `PlantUmlRenderService` | `java -jar plantuml.jar -tsvg -pipe` を起動、stdout SVG をサニタイズ、10 秒タイムアウト | [Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRenderService.cs](Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRenderService.cs) |
| `PlantUmlRuntimeResolver` | working dir / `AppContext.BaseDirectory` から `plantuml.config.json` → `plantuml.jar` の順に探索 | [Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRuntimeResolver.cs](Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRuntimeResolver.cs) |
| `HtmlTemplateService` | `<base>` / CSS / Mermaid script / リンクハンドラ JS を含む完全な HTML 文書を生成 | [Avalonia/MarkdownViewer.Avalonia/Services/HtmlTemplateService.cs](Avalonia/MarkdownViewer.Avalonia/Services/HtmlTemplateService.cs) |
| `FileTreeNode` | `Name` / `Path` / `RelativePath` / `Type` / `Children` | [Avalonia/MarkdownViewer.Avalonia/Models/FileTreeNode.cs](Avalonia/MarkdownViewer.Avalonia/Models/FileTreeNode.cs) |

## 依存関係

- Avalonia UI / Avalonia.Desktop / Avalonia.Themes.Fluent / Avalonia.Fonts.Inter
- Avalonia.Controls.WebView
- Markdig
- CommunityToolkit.Mvvm
- Java / `plantuml.jar`（PlantUML 表示時のみ、外部プロセス）

## 設計文書

- 基本設計: [docs/components/avalonia_viewer/basic_design.md](docs/components/avalonia_viewer/basic_design.md)
- 詳細設計: [docs/components/avalonia_viewer/detail_design.md](docs/components/avalonia_viewer/detail_design.md)
- インターフェース仕様: [docs/components/avalonia_viewer/interface_spec.md](docs/components/avalonia_viewer/interface_spec.md)
- 既知課題: [docs/components/avalonia_viewer/issues.md](docs/components/avalonia_viewer/issues.md)
