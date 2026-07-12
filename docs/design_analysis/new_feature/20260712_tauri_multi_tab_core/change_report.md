# Tauri Multi-tab core 導入 変更レポート

## 対象

- TODO: `TODO-2026-005 Tauri Multi-tab core 導入`
- Branch: `new-feature/tauri-multi-tab-core`
- Base branch: `main`
- Base commit: `19e2226ad6afef56cc4738c6ab1a4babad49670a`
- Report commit range: `19e2226..785dff8`
- 作成日: 2026-07-12

## 変更概要

Tauri版Markdown Viewerへ複数Markdownを保持・切替できるtab coreとTabStripを追加した。

- Explorer選択とrelative Markdown linkをopen-or-activateへ統合し、同一pathのtabを重複作成しない。
- active / non-active / last tabのcloseとdeterministicなselectionを提供する。
- active tabだけをReloadし、tab切替とtheme変更ではPlantUMLを再実行しない。
- root変更成功時は旧tabsを破棄し、新rootのdefault Markdownを1tabでopenする。scan失敗時は旧stateを維持する。
- 多数tabのhorizontal overflow、roving tabindex、ArrowLeft / ArrowRight / Home / End、close後focusに対応する。

## 実装

- `markdown-viewer-tauri/src/App.tsx`
  - `OpenDocumentTab`、`tabs`、`activeTabId`、pane-level `pendingNavigation`を追加した。
  - Markdown / PlantUML / Mermaidのasync結果を`tabId + revision`でguardした。
  - root-wide busyとtab load stateを分離し、StatusBar表示の優先順位を明示した。
  - `TabStrip`、open / activate / close / Reload / link navigationを追加した。
- `markdown-viewer-tauri/src/App.css`
  - PreviewWorkspace 2行gridとTabStripのactive/loading/error/focus/overflow styleを追加した。
- `sample_docs/`
  - relative Markdown linkの既存tab再利用、新規tab open、anchor scroll確認sampleを追加した。
- Rust command、Tauri capability、永続化形式は変更していない。

## ドキュメント

- `markdown-viewer-tauri/README.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`

上記をmulti-tabの状態契約、操作、async guard、UI構造、制約へ同期した。

## レビュー

- Phase 2 design review:
  - 初回条件付き承認後、TabStrip accessibility、pane-level anchor、StatusBar priority、PlantUML concurrency、close規則を反映しRound 2で承認。
- Phase 3 implementation review:
  - 初回条件付き承認後、root error lifetime、UI図、close focus共通化、tab state helper、close button focus契約を反映しRound 2で承認。
- 未解決指摘: なし。

## Phase 4-a ユーザー確認

publish済みTauriアプリで次を確認した。

- 複数Markdownのtab open、既存tab activate時の再読込抑止。
- active / non-active / last tab close、Reload後のtab維持。
- root変更時のtab clearとdefault Markdown open。
- PlantUML parse errorのtab表示と、並行render中のpreview/error分離。
- 多数tab overflow、keyboard navigation、close後focus。
- relative Markdown linkの既存tab再利用、新規tab open、anchor scroll。
- 既存機能にdegradationがないこと。

## 検証結果

- `npm run build` in `markdown-viewer-tauri/`: 成功。既知のVite chunk size warningのみ。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。
- Claude design / implementation review: Round 2承認、未解決指摘なし。

## 生成物

- `diff.zip`: 共通`tools/ExtractGitDiff`を使用して`19e2226..785dff8`を抽出。21変更ファイル、19コミットを収録し、`unzip -t`で整合確認済み。

## 既知制約 / follow-up

- split viewと複数paneは`TODO-2026-006`で扱う。
- tab永続化、再起動復元、pin、reorder、drag and drop、編集、未保存state、tab別scroll位置は対象外。
- 多数の巨大文書をopenした場合のmemory上限とPlantUML並行数制限は設けていない。
- 自動UI testは未整備であり、publish appの手動確認を完了条件とした。
