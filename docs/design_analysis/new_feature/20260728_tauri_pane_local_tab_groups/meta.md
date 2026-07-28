---
title: "TODO-2026-023 Tauri pane-local tab groups and tab movement between panes"
created_date: "2026-07-28"
category: "new_feature"
todo_id: "TODO-2026-023"
work_branch: "new-feature/tauri-pane-local-tab-groups"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src/splitView.ts"
  - "markdown-viewer-tauri/src/paneRuntime.ts"
  - "markdown-viewer-tauri/src/splitView.test.ts"
  - "markdown-viewer-tauri/src/paneRuntime.test.ts"
  - "docs/components/tauri_viewer"
  - "docs/architecture"
  - "docs/rules/development_workflow.md"
status: "in_progress"
design_status: "done"
impl_status: "draft"
completion_status: "not_started"
verification_status: "not_started"
related_commits:
  - "a97c530 : Phase 0 define TODO-2026-023 pane-local tab groups"
  - "e7fc3f7 : Phase 1 initialize Tauri pane-local tab groups workflow"
  - "996275a : Phase 2 prepare Tauri pane-local tab groups design"
  - "ffda6e3 : Phase 2 initial design review requests 12 changes"
  - "e21fe5d : Phase 2 address initial design review findings"
  - "7de22bb : Phase 2 approve design with one follow-up Low finding"
  - "3542fbb : Phase 2 resolve final runtime status clear finding"
  - "8ecbe5a : Phase 2 approve design with all 13 findings resolved"
source_todo_path: "docs/todo/todo.md#todo-2026-023-tauri-pane-local-tab-group--pane-間移動"
source_design_path: "docs/design_analysis/new_feature/20260726_tauri_split_view/"
depends_on:
  - "TODO-2026-006 Tauri Split view introduction"
integrated_todo:
  - "TODO-2026-024 Tauri tab movement between panes"
follow_up:
  - "TODO-2026-025 Tauri vertical and horizontal split orientation"
---

# TODO-2026-023 Tauri pane-local tab groups and tab movement between panes meta

## Scope

- Keep global `OpenDocumentTab[]` as the document-data source of truth while giving primary and secondary panes ordered tab ID collections and independent active tabs.
- Add documents opened from Explorer or relative links to the active pane's tab group.
- Allow the same document data to be referenced from both pane groups without sharing pane-local preview runtime.
- Move a tab between panes through an explicit accessible operation with deterministic source fallback and destination selection.
- Preserve secondary group state while single view is active and restore it when split view is enabled again.

## Non-Scope

- Drag and drop, tab reordering, pinning, multi-selection, or bulk movement.
- Three or more panes, arbitrary split trees, or layout persistence across application restarts.
- Avalonia implementation or vertical split orientation.
- Rust command, custom protocol, capability, CSP, or trusted HTML security-boundary changes.

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done and approved (`a97c530`) |
| Phase 1 Branch and meta | Done (this Phase 1 initialization commit) |
| Phase 2 Design review | Done and approved (`8ecbe5a`; 13 findings resolved, 0 unresolved) |
| Phase 3 Implementation and docs review | Draft implementation and permanent docs prepared; automated verification passed; review pending |
| Phase 4-a User verification | Not started |
| Phase 4-b Completion | Not started |
| Phase 4-c Merge | Not started |
