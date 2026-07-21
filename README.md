# MarkdownViewer

MarkdownViewer は、Markdown ドキュメントを編集環境から独立して閲覧するためのデスクトップアプリ比較プロジェクトです。同じ用途を異なる技術スタックで実装し、Markdown/Mermaid/PlantUML 表示、ファイルアクセス、UI、配布方法を比較しています。Tauri 版は、選択 root 内の trusted UTF-8 HTML 仕様書も sandboxed preview で表示できます。

## 実装

| 実装 | 技術スタック | 開発実行できる OS | 詳細 |
| --- | --- | --- | --- |
| Avalonia 版 | Avalonia UI / C# / NativeWebView | Windows、macOS | [Avalonia 版 README](Avalonia/MarkdownViewer.Avalonia/README.md) |
| Tauri 版 | Tauri v2 / React / TypeScript / Rust | Windows、macOS、Linux | [Tauri 版 README](markdown-viewer-tauri/README.md) |

Avalonia 版は埋め込み表示に `NativeWebView` を使用するため、現構成では Linux 実行をサポートしません。Linux では Tauri 版を使用してください。

## はじめに

GitHub から clone した直後の環境構築は、使用する OS のガイドに従ってください。

- [Windows](docs/setup/windows.md)
- [macOS](docs/setup/macos.md)
- [Linux](docs/setup/linux.md)
- [環境構築ガイド索引](docs/setup/README.md)

セットアップ後の最小確認コマンドは次のとおりです。リポジトリルートから開始し、`cd` がある場合は移動後の directory で後続コマンドを実行します。

```text
# Avalonia
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri（先に markdown-viewer-tauri で npm ci を実行）
cd markdown-viewer-tauri
npm run build
npm test -- --run
npm run tauri dev
```

## ドキュメント

- [プロジェクト概要](docs/rules/project_overview.md)
- [アーキテクチャ概要](docs/architecture/overview.md)
- [開発・実行ルール](docs/rules/development_workflow.md)
- [GitHub Release 配布手順](docs/release/README.md)
- [MVP 比較設計](docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md)

`bin/`、`obj/`、`target/`、`node_modules/`、`dist/`、`publish/` と `plantuml.jar` はローカル生成物または runtime asset であり、コミットしません。
