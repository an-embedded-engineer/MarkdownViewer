---
title: "TODO-2026-004 Tauri Recent Folders introduction"
created_date: "2026-07-08"
category: "new_feature"
todo_id: "TODO-2026-004"
work_package_id: "WP-002"
work_branch: "new-feature/tauri-recent-folders"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src-tauri/src/lib.rs"
  - "markdown-viewer-tauri/src-tauri/capabilities"
  - "docs/components/tauri_viewer"
status: "in_progress"
design_status: "not_started"
impl_status: "not_started"
completion_status: "not_started"
verification_status: "not_started"
related_commits:
  - "0967086 : Phase 0 define TODO-2026-004 scope"
source_todo_path: "docs/todo/todo.md#todo-2026-004-tauri-recent-folders-導入"
source_wbs_path: "docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧"
source_report_path: "docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md"
depends_on:
  - "TODO-2026-003 Tauri MenuBar / StatusBar introduction"
---

# TODO-2026-004 Tauri Recent Folders introduction meta

## Scope

- Add recent folders to the Tauri implementation.
- Persist successful root folder opens to app config JSON, not browser localStorage.
- Expose `Recent Folders` from the MenuBar under `File`.
- Support duplicate promotion, maximum item count, deletion, missing path errors, and restart restoration.
- Preserve the current single-root / single-active-Markdown model.

## MenuBar Direction

- OS native menu integration remains a design-time option.
- A React app-level MenuBar is acceptable when it behaves like a menu bar: menu names are shown at the window top and clicking a menu name opens menu items.
- The chosen approach must keep existing busy-state disabled behavior and handler integration understandable.

## Non-Scope

- Multi-tab, split view, and Avalonia Recent Folders.
- Recent Markdown files, pinned folders, drag reorder, and history search.
- Full OS-native menu parity on every platform.

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`0967086`) |
| Phase 1 Branch and meta | In progress |
| Phase 2 Design review | Not started |
| Phase 3 Implementation and docs review | Not started |
| Phase 4 Verification and completion | Not started |
