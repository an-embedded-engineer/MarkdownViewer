# MarkdownViewer Agent Project Instructions (Sync Source)

## 1. 目的

このファイルは `AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md` の共通同期元として使う。
各 Agent 向けファイルは `scripts/sync_agent_instructions.*` で本ファイルを実体コピーして生成する。

## 2. 必須参照

- ADR 索引: `docs/adr/README.md`
- プロジェクト概要: `docs/rules/project_overview.md`
- アーキテクチャ概要: `docs/architecture/overview.md`
- コードパターン: `docs/architecture/code_patterns.md`
- よくある落とし穴: `docs/architecture/common_pitfalls.md`
- 開発・実行ルール: `docs/rules/development_workflow.md`
- 言語ルール: `docs/rules/language_rules.md`
- コーディングルール: `docs/rules/coding_rules.md`
- sync ガイド: `instructions/agent_sync_guide.md`

## 3. Project 固有ルール

- 本プロジェクトは Markdown Viewer の比較実装であり、Avalonia/C# 版と Tauri/React/Rust 版を並行管理する。
- C# / Avalonia 変更では `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj` を最低限実行する。
- Tauri 変更では `npm run build` と `cargo check` を `markdown-viewer-tauri/` / `markdown-viewer-tauri/src-tauri/` で実行する。
- project 固有の実行・テスト・publish コマンドは `docs/rules/development_workflow.md` を正とする。
- 仕様・設計判断を変更した場合は `docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md` または `docs/architecture/` / `docs/components/` を更新する。

## 4. 生成物運用

- `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md` は直接編集せず、`instructions/agent_common_master.md` を編集して同期する。
- `scripts/sync_agent_instructions.*` は project-level instruction 出力 3 種の再生成だけを扱う。
- `bin/`、`obj/`、`target/`、`node_modules/`、`dist/`、`publish/` は生成物として扱い、原則コミットしない。

## 5. User-Level Workflow 利用前提

- workflow / review / orchestration skill の正本は user-level skill として管理される。
- workflow 実行時の詳細手順は user-level skill 同梱の `references/procedure/` を優先し、project-level 手順書への実行時依存を増やさない。
- project-level docs は、要求整理、設計、実装、検証、履歴の参照先として使う。
