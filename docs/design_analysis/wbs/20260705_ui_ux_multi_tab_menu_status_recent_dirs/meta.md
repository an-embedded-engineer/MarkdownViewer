---
title: "UI/UX improvements WBS: multi-tab, menu bar, status bar, recent directories"
created_date: "2026-07-05"
category: wbs
components:
  - markdown-viewer-tauri
  - Avalonia/MarkdownViewer.Avalonia
  - docs/todo
  - docs/components
status: draft
related_commits: []
source_refs:
  - docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md
  - docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/ui_ux_multi_tab_menu_status_recent_dirs_report_review.md
  - docs/todo/todo.md
---

# UI/UX improvements WBS meta

## Scope

- 対象: 複数タブ、2 ペイン split view、メニューバー、ステータスバー、最近開いたディレクトリ。
- 方針: Tauri 版で先行実装と UX 評価を行い、確定した仕様を Avalonia 版へ反映する。
- 非対象: この WBS workflow 内でのアプリ実装、設計詳細、ビルド生成物更新。

## Expected output

- 通常 workflow 1 回で完了可能な work package 一覧。
- 依存順序、推奨 workflow、完了条件、検証観点、docs 更新先。
- `docs/todo/todo.md` への追跡項目追加。
