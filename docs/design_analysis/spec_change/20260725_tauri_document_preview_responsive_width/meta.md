---
title: "TODO-2026-021 Tauri document preview 横幅の可変化"
created_date: "2026-07-25"
category: "spec_change"
todo_id: "TODO-2026-021"
work_branch: "spec-change/tauri-document-preview-responsive-width"
components:
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/*.test.ts"
  - "docs/components/tauri_viewer"
  - "docs/rules/development_workflow.md"
status: "implemented"
design_status: "done"
impl_status: "done"
completion_status: "pending"
verification_status: "pending"
related_commits:
  - "3aaa5a2 : Phase 0 define TODO-2026-021 preview width scope"
  - "8ace19e : Phase 1 initialize Tauri preview width workflow"
  - "3942be4 : Phase 2 design responsive Tauri preview width"
  - "92eab1e : Phase 2 review Tauri preview width design"
  - "1d14cd2 : Phase 2 address Tauri preview width design review"
  - "8078b28 : Phase 2 approve Tauri preview width design after follow-up"
  - "9694e2b : Phase 3 implement responsive Tauri preview width"
  - "98073a7 : Phase 3 review Tauri preview width implementation"
  - "64b7b12 : Phase 3 address Tauri preview width implementation review"
  - "d9e8ba2 : Phase 3 approve Tauri preview width implementation after follow-up"
  - "adc1a49 : Phase 3 fix Mermaid rendering across resize after Phase 4-a feedback"
  - "87d438a : Phase 3 approve Mermaid resize fix after follow-up"
---

# TODO-2026-021 Tauri document preview 横幅の可変化 meta

## Scope

- Tauri版Markdown preview本文の固定980px上限を廃止し、preview pane幅からresponsiveな左右marginを引いた幅へ変更する。
- Markdown / trusted HTMLのViewer側viewportに固定pxの最大幅がないことを確認する。
- 横長のtable、Mermaid、PlantUML、imageが拡張後の本文幅を利用できるようにする。
- Tauri Viewer component docsとUI手動確認項目を新しい幅契約へ同期する。

## Non-Scope

- Explorer幅変更の最小値、dynamic最大値、操作契約は変更しない。
- trusted HTML文書自身のCSSで指定された`width` / `max-width`は上書きしない。
- Avalonia版のpreview幅は変更しない。
- 横幅設定のユーザー設定化または永続化は行わない。

## Compatibility

- document open、tab、Explorer resize、Markdown / HTML切替の操作契約を維持する。
- 狭いwindowでは既存のresponsiveな左右marginを維持する。
- HTML iframeはpreview pane全幅を使う既存契約を維持し、sandbox / custom protocol境界を変更しない。
- Markdown内要素の既存overflow / scaling契約を維持する。

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`3aaa5a2`) |
| Phase 1 Branch and meta | Done |
| Phase 2 Design review | Done (Approved, unresolved findings: 0) |
| Phase 3 Implementation and docs review | Done (Round 2 approved, unresolved findings: 0) |
| Phase 4 Verification and completion | In progress (4-a re-verification pending) |
