---
title: "TODO-2026-019 Tauri Explorer ツリーペイン UX 改善"
created_date: "2026-07-22"
category: "spec_change"
todo_id: "TODO-2026-019"
work_branch: "spec-change/tauri-explorer-pane-ux"
components:
  - "markdown-viewer-tauri/src/App.tsx"
  - "markdown-viewer-tauri/src/App.css"
  - "markdown-viewer-tauri/src/explorerPane.ts"
  - "markdown-viewer-tauri/src/explorerPane.test.ts"
  - "docs/components/tauri_viewer"
  - "docs/rules/development_workflow.md"
status: "in_progress"
design_status: "done"
impl_status: "draft"
completion_status: "pending"
verification_status: "pending"
related_commits:
  - "d2091b3 : Phase 0 define TODO-2026-019 scope"
  - "f8607df : Phase 1 initialize Tauri Explorer pane UX workflow"
  - "c1038c9 : Phase 2 design Tauri Explorer pane UX"
  - "69f920c : Phase 2 add Tauri Explorer pane UX design review prompt"
  - "706ebcd : Phase 2 review Tauri Explorer pane UX design (changes requested)"
  - "0edff56 : Phase 2 address Tauri Explorer pane UX design review"
  - "68a2010 : Phase 2 add Tauri Explorer pane UX design follow-up prompt"
  - "f1da27b : Phase 2 approve Tauri Explorer pane UX design after follow-up"
---

# TODO-2026-019 Tauri Explorer ツリーペイン UX 改善 meta

## Scope

- Tauri版ExplorerとPreviewの境界を操作し、定義済みの最小値・最大値内でExplorer幅を変更できるようにする。
- 深い階層または長い名前を省略せず、Explorer内の水平scrollで末尾まで確認できるようにする。
- directory、Markdown、HTMLを識別できるアイコンを追加し、既存のimage表示、選択、開閉、disabled状態と共存させる。
- pointerとkeyboardの両方でresizerを操作できるUI契約を定義する。

## Non-Scope

- Explorer幅の再起動後永続化は行わない。
- tree nodeのdrag and drop、rename、context menu、file system監視は追加しない。
- Rustのtree走査とdocument data contractは変更しない。
- Avalonia版は同時実装せず、`TODO-2026-020`で水平展開する。

## Compatibility

- root選択、tree開閉、Markdown / HTML選択、tab操作、Preview表示を維持する。
- app shell全体にはscrollbarを出さず、Explorer / Preview内部へscroll責務を限定する。
- Tauri先行UXをAvaloniaへ機械的に移植せず、後続TODOでGridSplitter / TreeViewに合わせて仕様化する。

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 0 Requirements | Done (`d2091b3`) |
| Phase 1 Branch and meta | Done |
| Phase 2 Design review | Done (Approved, unresolved findings: 0) |
| Phase 3 Implementation and docs review | Draft (implementation and automated verification complete; review pending) |
| Phase 4 Verification and completion | Pending |
