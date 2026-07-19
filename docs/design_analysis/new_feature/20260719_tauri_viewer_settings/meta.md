---
title: "TODO-2026-014 Tauri Viewer settings persistence and settings UI"
created_date: "2026-07-19"
category: "new_feature"
todo_id: "TODO-2026-014"
work_branch: "new-feature/tauri-viewer-settings"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src-tauri/src/lib.rs"
  - "markdown-viewer-tauri/src-tauri/capabilities"
  - "docs/components/tauri_viewer"
  - "docs/rules/development_workflow.md"
status: "active"
design_status: "done"
impl_status: "in_progress"
completion_status: "not_started"
verification_status: "not_started"
related_commits:
  - "4b50af2 : Phase 0 define TODO-2026-014 and TODO-2026-015 scope"
  - "7e22284 : Phase 1 initialize Tauri viewer settings workflow"
  - "4db51a5 : Phase 2 draft Tauri viewer settings design"
  - "eb13890 : Phase 2 design review (conditional approval)"
  - "628373d : Phase 2 address Tauri viewer settings design review"
  - "0d7342e : Phase 2 approve Tauri viewer settings design"
source_todo_path: "docs/todo/todo.md#todo-2026-014-tauri-viewer-設定永続化と設定-ui-導入"
depends_on:
  - "TODO-2026-005 Tauri Multi-tab core introduction"
follow_up:
  - "TODO-2026-006 Tauri Split view introduction (independent work package after TODO-2026-005)"
  - "TODO-2026-007 Tauri UX evaluation and Avalonia specification"
  - "TODO-2026-015 Avalonia Viewer settings persistence and settings UI rollout"
---

# TODO-2026-014 Tauri Viewer settings persistence and settings UI meta

## Scope

- Persist window width / height, Theme, and the `plantuml.jar` path in the existing Tauri app config JSON.
- Restore persisted settings at application startup while preserving existing Recent Folders data.
- Add a MenuBar entry and settings UI for reviewing current values and changing Theme / `plantuml.jar` path.
- Persist the current window size after resize and expose it for confirmation in the settings UI.
- Report invalid or missing `plantuml.jar` configuration without preventing Markdown or Mermaid viewing.

## Non-Scope

- Avalonia implementation; it is tracked separately by `TODO-2026-015` after the Tauri UX evaluation.
- Window position, maximized / minimized state, open folder, open tabs, or split-pane state persistence.
- Java installation or automatic `plantuml.jar` download.

## Integration Points

- React MenuBar, settings UI, Theme state, startup loading, and Tauri window resize events.
- Rust `AppConfig` / `AppConfigStore`, app config JSON serialization, and PlantUML runtime resolution.
- Tauri window and dialog APIs plus any required capabilities.

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`4b50af2`) |
| Phase 1 Branch and meta | Done (Phase 1 initialization commit) |
| Phase 2 Design review | Done (approved 2026-07-19) |
| Phase 3 Implementation and docs review | Implementation review findings being addressed |
| Phase 4 Verification and completion | Not started |
