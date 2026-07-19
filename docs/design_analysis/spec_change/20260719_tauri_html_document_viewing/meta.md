---
title: "TODO-2026-017 Tauri HTML形式仕様書表示対応"
created_date: "2026-07-19"
category: "spec_change"
todo_id: "TODO-2026-017"
work_branch: "spec-change/tauri-html-document-viewing"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src-tauri/src/lib.rs"
  - "markdown-viewer-tauri/src-tauri/tauri.conf.json"
  - "markdown-viewer-tauri/src-tauri/capabilities/default.json"
  - "markdown-viewer-tauri/src-tauri/Cargo.toml"
  - "docs/architecture"
  - "docs/components/tauri_viewer"
  - "docs/rules/development_workflow.md"
  - "docs/tests/README.md"
status: "in_progress"
design_status: "done"
impl_status: "draft"
completion_status: "not_started"
related_commits:
  - "24bcfb5 : Phase 0 define TODO-2026-017 scope"
  - "20d1d82 : Phase 1 initialize Tauri HTML document viewing workflow"
  - "88aae68 : Phase 2 draft Tauri HTML document viewing design"
  - "41e07a0 : Phase 2 add Tauri HTML design review prompt"
  - "3218aad : Phase 2 review Tauri HTML document viewing design"
  - "9489c43 : Phase 2 address Tauri HTML design review findings"
  - "0b82b6c : Phase 2 add Tauri HTML design review follow-up prompt"
  - "59193e5 : Phase 2 approve Tauri HTML design after review follow-up"
source_todo_path: "docs/todo/todo.md#todo-2026-017-tauri-html形式仕様書表示対応"
source_report_path: "docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md"
---

# TODO-2026-017 Tauri HTML形式仕様書表示対応 meta

## Scope

- Tauri版ViewerのExplorer、Multi-tab、preview stateをMarkdown / HTMLの型付きdocument modelへ一般化する。
- trustedかつUTF-8の`.html`と、選択root内の許可resourceをroot-scoped custom URI protocolで配信する。
- active HTMLをCSP付きsandboxed iframeで表示し、親DOM、Tauri IPC、root外local file、外部network、top-level navigation、popupへの到達を拒否する。
- HTML内でuser clickされた`http:` / `https:`だけを検証し、OS標準ブラウザへ委譲する。

## Non-Scope

- `.htm`、非UTF-8 HTML、信頼できないactive contentの閲覧は対象外とする。
- root外／外部network resource、relative HTML / Markdown linkのtab遷移、HTML raw Mermaid / PlantUML sourceのViewer側描画は対象外とする。
- Tauri全体のasset protocol scope縮小とAvalonia版HTML対応は別TODOで扱う。

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`24bcfb5`) |
| Phase 1 Branch and meta | Done |
| Phase 2 Design review | Done (approved 2026-07-19, `59193e5`) |
| Phase 3 Implementation and docs review | Draft (implementation and local verification in progress) |
| Phase 4 Verification and completion | Not started |
