---
title: "UI/UX improvements: multi-tab, menu bar, status bar, recent directories"
created_date: "2026-07-05"
category: research_analysis
components:
  - Avalonia/MarkdownViewer.Avalonia
  - markdown-viewer-tauri
  - docs/components
status: merged
related_commits:
  - 2ab6685 : Phase 1 meta 初期化
  - 5df034f : Phase 2 初回 report 作成
  - a183e9c : Phase 3 レビュー依頼準備
  - 3d02404 : Phase 3 初回レビュー文書追加
  - 6c6b199 : Phase 4 レビュー指摘対応
  - ab91908 : Phase 4 再レビュー依頼準備
  - 17d3e70 : Phase 4 Round 2 承認追記
source_design_path: docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md
---

# UI/UX improvements research meta

## Scope

- 調査対象: 複数タブ、並べて表示、メニューバー、ステータスバー、最近開いたディレクトリ。
- 対象実装: Avalonia/C# 版と Tauri/React/Rust 版。
- 非対象: この workflow 内での実装変更、UI 文言変更、ビルド生成物更新。

## Expected output

- 現状実装と既存設計文書に基づく実現方式の比較。
- 次 workflow へ渡せる推奨方針、リスク、未解決事項。
