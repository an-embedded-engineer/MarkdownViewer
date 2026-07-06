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
design_status: "in_review"
impl_status: "not_started"
completion_status: "not_started"
related_commits:
  - "a209fc2 : Phase 0 define TODO-2026-003 scope"
source_todo_path: "docs/todo/todo.md#todo-2026-003-tauri-menubar--statusbar-導入"
source_wbs_path: "docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧"
---

# TODO-2026-003 Tauri MenuBar / StatusBar introduction meta

## Scope

- Tauri 版の既存 Toolbar 操作を React アプリ内 MenuBar へ移す。
- root path、active file、loading、error の表示先を StatusBar として定義する。
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
| Phase 2 Design review | In review |
| Phase 3 Implementation and docs review | Not started |
| Phase 4 Verification and completion | Not started |
