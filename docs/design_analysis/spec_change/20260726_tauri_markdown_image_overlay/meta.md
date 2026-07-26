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
status: "in_progress"
design_status: "in_review"
impl_status: "pending"
completion_status: "pending"
verification_status: "pending"
related_commits:
  - "d2e9fd5 : Phase 0 define TODO-2026-022 image overlay scope"
  - "e0b7fe3 : Phase 2 design Tauri Markdown image overlay"
  - "0c92ca6 : Phase 2 review Tauri Markdown image overlay design"
  - "19bf862 : Phase 2 address initial design review findings"
  - "1092187 : Phase 2 re-review round 1 fixes"
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
| Phase 2 Design review | In review (Round 2 finding: Medium 1) |
| Phase 3 Implementation and docs review | Pending |
| Phase 4 Verification and completion | Pending |
