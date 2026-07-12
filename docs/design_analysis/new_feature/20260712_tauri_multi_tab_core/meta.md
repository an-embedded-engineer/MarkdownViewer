---
title: "TODO-2026-005 Tauri Multi-tab core introduction"
created_date: "2026-07-12"
category: "new_feature"
todo_id: "TODO-2026-005"
work_package_id: "WP-003"
work_branch: "new-feature/tauri-multi-tab-core"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "docs/components/tauri_viewer"
status: "implemented"
design_status: "done"
impl_status: "done"
completion_status: "not_started"
verification_status: "done"
related_commits:
  - "19e2226 : Phase 0 define TODO-2026-005 scope"
  - "6f70fdb : Phase 1 initialize Tauri multi-tab workflow"
  - "24c0d4a : Phase 2 draft Tauri multi-tab design"
  - "dcf409f : Phase 2 design review (conditional approval)"
  - "cd2fad4 : Phase 2 address Tauri multi-tab design review"
  - "27e7cf1 : Phase 2 approve Tauri multi-tab design (Round 2)"
  - "e26c54d : Phase 3 implement Tauri multi-tab core"
  - "9a92ec3 : Phase 3 implementation review (conditional approval)"
  - "c4a6a09 : Phase 3 address Tauri multi-tab implementation review"
  - "71a2861 : Phase 3 approve Tauri multi-tab implementation (Round 2)"
source_todo_path: "docs/todo/todo.md#todo-2026-005-tauri-multi-tab-core-導入"
source_wbs_path: "docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧"
source_report_path: "docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md"
depends_on:
  - "TODO-2026-003 Tauri MenuBar / StatusBar introduction"
  - "TODO-2026-004 Tauri Recent Folders introduction"
---

# TODO-2026-005 Tauri Multi-tab core introduction meta

## Scope

- Replace the single selected Markdown state with a typed tab collection and active tab identifier.
- Add a TabStrip that supports activation, close, and access to overflowed tabs.
- Integrate Explorer selection, active-tab Reload, theme changes, and relative Markdown links with tab state.
- Keep tab content and asynchronous Markdown / PlantUML rendering results isolated per tab.
- Limit all tabs to the current root and discard old-root tabs after a successful root change.

## Non-Scope

- Split view, multiple panes, and moving tabs between panes.
- Tab persistence, restart restoration, pinning, reorder, drag and drop, editing, and unsaved state.
- Avalonia multi-tab support and opening Markdown outside the current root.

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`19e2226`) |
| Phase 1 Branch and meta | In progress |
| Phase 2 Design review | Done (approved 2026-07-12, `27e7cf1`) |
| Phase 3 Implementation and docs review | Done (approved 2026-07-12, `71a2861`) |
| Phase 4 Verification and completion | Phase 4-a user verification done (2026-07-12) |
