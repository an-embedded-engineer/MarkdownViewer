---
title: "TODO-2026-022 Tauri Markdown画像オーバーレイ表示"
created_date: "2026-07-26"
category: "spec_change"
todo_id: "TODO-2026-022"
work_branch: "spec-change/tauri-markdown-image-overlay"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src/imageViewer.ts"
  - "markdown-viewer-tauri/src/imageViewer.test.ts"
  - "sample_docs"
  - "docs/components/tauri_viewer"
  - "docs/rules/development_workflow.md"
status: "implemented"
design_status: "done"
impl_status: "done"
completion_status: "done"
verification_status: "done"
related_commits:
  - "d2e9fd5 : Phase 0 define TODO-2026-022 image overlay scope"
  - "a3af96c : Phase 1 initialize Tauri image overlay workflow"
  - "e0b7fe3 : Phase 2 design Tauri Markdown image overlay"
  - "0c92ca6 : Phase 2 review Tauri Markdown image overlay design"
  - "19bf862 : Phase 2 address initial design review findings"
  - "1092187 : Phase 2 re-review round 1 fixes"
  - "96ff759 : Phase 2 address round 2 design review finding"
  - "7bcc92b : Phase 2 approve design with unresolved findings 0"
  - "909f8d7 : Phase 2 complete Tauri image overlay design phase"
  - "ad68ae4 : Phase 3 implement Tauri Markdown image viewer"
  - "ac4ba41 : Phase 3 initial implementation review"
  - "80741cf : Phase 3 address implementation review findings"
  - "56f53ed : Phase 3 approve implementation with unresolved findings 0"
  - "13761f8 : Phase 3 complete Tauri image viewer implementation phase"
  - "27ca57c : Phase 4-a fix focus return by activation type"
  - "4bfc16d : Phase 4-a review activation focus fix"
  - "c9e519b : Phase 4-a address follow-up focus outline finding"
  - "cd50464 : Phase 4-a close follow-up review findings"
  - "64cde48 : Phase 4-a record user verification PASS"
source_todo_path: "docs/todo/todo_archive_2026.md#todo-2026-022-tauri-markdown画像オーバーレイ表示"
---

# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 meta

## Scope

- Tauri版Markdown preview内の通常画像、描画済みMermaid SVG、描画済みPlantUML SVGをmodal overlayで表示する。
- 初期fit、zoom in / out、pan、fit / reset、closeと、pointer・wheel / trackpad・keyboard操作を提供する。
- modal表示中の背景操作抑止、focus管理、Light / Dark theme、window resizeとtab / Reload境界を扱う。
- frontend interaction policyの自動test、巨大UMLを含む手動fixture、Tauri Viewer component docsと確認手順を同期する。

## Non-Scope

- sandboxed iframe内のtrusted HTML画像は対象にしない。
- Avalonia版は同時実装しない。
- 画像編集、download、別window表示、zoom / pan状態の永続化は行わない。
- Rust backend、filesystem、asset protocol、HTML iframe / bridge契約は変更しない。

## Compatibility

- overlayを開いていない通常時のMarkdown本文幅、画像縮小、Mermaid / PlantUML描画と要素内scrollを維持する。
- 既存のMarkdown link / anchor、tab、Explorer、Reload、Theme操作を維持する。ただしlinked imageの画像領域clickはviewer openを優先し、link自身または隣接するviewer buttonのkeyboard操作でnavigation / viewer openを選択できる契約へ変更する。
- MermaidがReact外で生成したSVGを不要な再描画でsourceへ戻さない既存契約を維持する。
- trusted HTML previewのsandbox、custom protocol、typed bridge境界を維持する。

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`d2e9fd5`) |
| Phase 1 Branch and meta | Done |
| Phase 2 Design review | Done (Approved, unresolved findings: 0, `7bcc92b`) |
| Phase 3 Implementation and docs review | Done (Approved, unresolved findings: 0, `56f53ed`) |
| Phase 4 Verification and completion | Phase 4-b completion artifacts done; awaiting Phase 4-c merge approval |
