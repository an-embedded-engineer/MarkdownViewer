# Tauri Viewer

## 目的

Tauri v2 + React + TypeScript + Rust による Markdown Viewer MVP 実装。

## 責務

- Tauri dialog pluginでフォルダを選択する。
- Rust commandでファイルツリー構築とMarkdown読み込みを行う。
- ReactでExplorer、Toolbar、Markdown previewを表示する。
- `markdown-it`、`mermaid`、Rust側PlantUML commandでMarkdown/Mermaid/PlantUMLを描画する。

## 主要要素

- `src/App.tsx`: React UI、状態管理、Markdown rendering、PlantUML描画依頼、Mermaid再描画。
- `src/App.css`: Light / Dark themeと2ペインUI。
- `src-tauri/src/lib.rs`: `scan_directory`、`read_text_file`、`render_plantuml_diagrams` command。
- `src-tauri/tauri.conf.json`: Tauri設定とasset protocol。
- `src-tauri/capabilities/default.json`: plugin permission。

## 依存関係

- Tauri v2
- React
- TypeScript
- Vite
- markdown-it
- mermaid
- Rust / serde
- Java / `plantuml.jar`（PlantUML表示時のみ）

## 設計文書

- 基本設計: `docs/components/tauri_viewer/basic_design.md`
- 詳細設計: `docs/components/tauri_viewer/detail_design.md`
- インターフェース仕様: `docs/components/tauri_viewer/interface_spec.md`
- 既知課題: `docs/components/tauri_viewer/issues.md`
