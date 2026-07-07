---
title: "TODO-2026-003 Tauri MenuBar / StatusBar introduction"
created_date: "2026-07-06"
category: "spec_change"
todo_id: "TODO-2026-003"
work_package_id: "WP-001"
work_branch: "spec-change/tauri-menubar-statusbar"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "docs/components/tauri_viewer"
status: "in_progress"
design_status: "done"
impl_status: "done"
completion_status: "done"
verification_status: "done"
related_commits:
  - "a209fc2 : Phase 0 define TODO-2026-003 scope"
  - "fca3462 : Phase 1 initialize Tauri menu status workflow"
  - "7979fce : Phase 2 draft Tauri menu status design"
  - "93fb94c : Phase 2 add design review prompt"
  - "c41e54d : Phase 2 design review (conditional approval)"
  - "bec06d5 : Phase 2 address design review feedback"
  - "5bf3226 : Phase 2 approve Tauri menu status design"
  - "61e4cd6 : Phase 3 implement Tauri menu bar and status bar"
  - "35b3a47 : Phase 3 add implementation review prompt"
  - "c6dc991 : Phase 3 implementation review (conditional approval)"
  - "476464b : Phase 3 address implementation review feedback"
  - "6b8d559 : Phase 3 approve Tauri menu status implementation"
  - "170e798 : Phase 4-a address root path and error layout feedback"
  - "cbe0e55 : Phase 4-a constrain app shell scrolling"
  - "5f027b5 : Phase 4-a pin status bar grid row"
source_todo_path: "docs/todo/todo_archive_2026.md#todo-2026-003-tauri-menubar--statusbar-導入"
source_wbs_path: "docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧"
---

# TODO-2026-003 Tauri MenuBar / StatusBar introduction meta

## Scope

- Tauri 版の既存 Toolbar 操作を React アプリ内 MenuBar へ移す。
- root path、active file、loading、error の表示先を RootPathBar / StatusBar / ErrorBanner として定義する。
- 既存の単一 root / 単一 active Markdown 表示モデルは維持する。

## Non-Scope

- OS native menu は導入しない。
- Recent Folders、multi-tab、split view は後続 TODO で扱う。
- Avalonia 版の UI 変更は TODO-2026-008 以降で扱う。

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`a209fc2`) |
| Phase 1 Branch and meta | Done |
| Phase 2 Design review | Done (approved 2026-07-06) |
| Phase 3 Implementation and docs review | Done (approved 2026-07-06) |
| Phase 4 Verification and completion | Done (user verified 2026-07-07; merge pending) |
