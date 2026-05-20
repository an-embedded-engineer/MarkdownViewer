# プロジェクト概要

## 目的

MarkdownViewer は、VSCode やコーディングエージェントが生成した Markdown ドキュメントを、編集環境から独立して素早く閲覧するための軽量ビューア比較実装である。

同じ MVP 要件を以下 2 系統で実装し、実装容易性、Markdown/Mermaid 表示、ファイルアクセス、配布の見通しを比較する。

- Avalonia UI + C# + NativeWebView
- Tauri v2 + React + TypeScript + Rust

## 主要コンポーネント

- `Avalonia/MarkdownViewer.Avalonia/`: C# / Avalonia 版のデスクトップアプリ。
- `markdown-viewer-tauri/`: Tauri v2 + React + TypeScript 版のデスクトップアプリ。
- `docs/`: 設計、開発ルール、workflow 用の project-level 文書。
- `instructions/`: Agent 向け共通指示の同期元。
- `scripts/`: Agent 指示同期などの補助スクリプト。
- `tools/ExtractGitDiff/`: workflow の差分レポート生成用補助ツール。
- `publish/`: ローカル publish 出力。生成物でありコミット対象外。

## アーキテクチャ

- 概要: `docs/architecture/overview.md`
- コードパターン: `docs/architecture/code_patterns.md`
- よくある落とし穴: `docs/architecture/common_pitfalls.md`

## 基本設計リンク

- Avalonia Viewer: `docs/components/avalonia_viewer/README.md`
- Tauri Viewer: `docs/components/tauri_viewer/README.md`
- テスト: `docs/tests/README.md`
- MVP 比較設計: `docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md`
