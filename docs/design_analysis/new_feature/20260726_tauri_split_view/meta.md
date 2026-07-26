---
title: "TODO-2026-006 Tauri Split view introduction"
created_date: "2026-07-26"
category: "new_feature"
todo_id: "TODO-2026-006"
work_package_id: "WP-004"
work_branch: "new-feature/tauri-split-view"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src/documentPolicy.ts"
  - "docs/components/tauri_viewer"
status: "in_progress"
design_status: "done"
impl_status: "not_started"
completion_status: "not_started"
verification_status: "not_started"
related_commits:
  - "c023374 : Phase 0 define TODO-2026-006 split view scope"
  - "09d57dc : Phase 1 initialize Tauri split view workflow"
  - "10948dc : Phase 2 draft Tauri split view design"
  - "5aebaa9 : Phase 2 design review (changes requested)"
  - "dd0dead : Phase 2 address Tauri split view design review"
  - "68f1fa5 : Phase 2 design review approved after re-review"
source_todo_path: "docs/todo/todo.md#todo-2026-006-tauri-split-view-導入"
source_wbs_path: "docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧"
source_report_path: "docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md"
depends_on:
  - "TODO-2026-005 Tauri Multi-tab core introduction"
  - "TODO-2026-017 Tauri HTML document viewing support"
follow_up:
  - "TODO-2026-007 Tauri UX evaluation and Avalonia specification"
  - "TODO-2026-011 Avalonia Split view introduction"
---

# TODO-2026-006 Tauri Split view introduction meta

## Scope

- Add single / split layout state with primary and secondary pane selections while keeping `OpenDocumentTab[]` as the document-data source of truth.
- Render one preview pane in single mode and two side-by-side panes in split mode, with an explicit active pane and independent tab selection.
- Route Explorer selection, tab activation and close, Reload, relative Markdown navigation, status, and errors through pane-aware state.
- Isolate Markdown, Mermaid, PlantUML, trusted HTML, anchor navigation, scrolling, loading, errors, and image-viewer interaction by pane, tab, and revision.
- Preserve responsive layout, Explorer resizing, Light / Dark theme, Settings, MenuBar, StatusBar, Recent Folders, and existing HTML security boundaries.

## Non-Scope

- Three or more panes, horizontal splitting, arbitrary split trees, or pane-layout persistence.
- Drag and drop between panes, tab reorder, pinning, duplicate tabs, editing, or unsaved state.
- Documents outside the current root, per-pane themes, or Avalonia implementation.
- Rust command, custom protocol, capability, or CSP changes unless Phase 2 proves a change unavoidable.

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`c023374`) |
| Phase 1 Branch and meta | Done (`09d57dc`) |
| Phase 2 Design review | Done (approved by re-review, 9 findings resolved, 0 unresolved; `68f1fa5`) |
| Phase 3 Implementation and docs review | Not started |
| Phase 4 Verification and completion | Not started |
