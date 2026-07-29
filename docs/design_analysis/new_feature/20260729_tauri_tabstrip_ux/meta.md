---
title: "TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善"
created_date: "2026-07-29"
category: "new_feature"
todo_id: "TODO-2026-026"
work_branch: "new-feature/tauri-tabstrip-ux"
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
design_status: "draft"
impl_status: "not_started"
completion_status: "not_started"
verification_status: "not_started"
related_commits:
  - "c8edd30 : Phase 0 define TODO-2026-026 TabStrip UX scope"
source_todo_path: "docs/todo/todo.md#todo-2026-026-tauri-tabstrip-状態表現scroll・drag-move-ux改善"
source_feedback: "TODO-2026-023 Phase 4-a"
depends_on:
  - "TODO-2026-023 Tauri pane-local tab groups and tab movement between panes"
---

# TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善 meta

## Scope

- active / error / renderingをcompactな1行tabの上端indicatorとaccessible stateで表現する。
- TabStripを状態やoverflowによらないcompactな固定高へ更新し、必要時だけscrollbarを視認可能にする。
- activateまたはfocusしたtabについて、title、move、close controlを含むtab item全体を表示範囲へscrollする。
- split表示中のpointer drag and dropを既存のatomicな`move-tab` transitionへ接続する。
- keyboardと支援技術向けに既存の矢印move buttonを維持する。

## Non-Scope

- 同一pane内reorder、pin、複数選択、一括move / close。
- 実数のrender progress表示。
- dragを唯一の移動導線にすること、または矢印move buttonを廃止すること。
- Rust command、custom protocol、capability、CSP、trusted HTML security boundaryの変更。

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done and approved (`c8edd30`) |
| Phase 1 Branch and meta | Done (this Phase 1 initialization commit) |
| Phase 2 Design review | Draft prepared; review not started |
| Phase 3 Implementation and docs review | Not started |
| Phase 4-a User verification | Not started |
| Phase 4-b Completion | Not started |
| Phase 4-c Merge | Not started |
