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
status: "implemented"
design_status: "done"
impl_status: "done"
completion_status: "not_started"
verification_status: "not_started"
related_commits:
  - "0967086 : Phase 0 define TODO-2026-004 scope"
  - "ecab28a : Phase 1 initialize Tauri recent folders workflow"
  - "8b4ab06 : Phase 2 draft Tauri recent folders design"
  - "fa56e65 : Phase 2 add Tauri recent folders design review prompt"
  - "dec7482 : Phase 2 design review (conditional approval)"
  - "25d3082 : Phase 2 address design review feedback"
  - "fc33580 : Phase 2 add design review follow-up prompt"
  - "0e9ceef : Phase 2 approve Tauri recent folders design"
  - "a6da60a : Phase 2 complete Tauri recent folders design"
  - "3a33830 : Phase 3 implement Tauri recent folders"
  - "3911379 : Phase 3 add implementation review prompt"
  - "0408028 : Phase 3 add Tauri recent folders implementation review"
  - "632f0a2 : Phase 3 address implementation review"
  - "f0dedc6 : Phase 3 add implementation review follow-up prompt"
  - "e414677 : Phase 3 approve implementation review"
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
| Phase 1 Branch and meta | Done (`ecab28a`) |
| Phase 2 Design review | Done (approved 2026-07-08) |
| Phase 3 Implementation and docs review | Done (approved 2026-07-08, `e414677`) |
| Phase 4 Verification and completion | Not started |
