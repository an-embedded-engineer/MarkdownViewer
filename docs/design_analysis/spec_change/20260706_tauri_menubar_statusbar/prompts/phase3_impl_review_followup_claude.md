# Phase 3 implementation review follow-up request: Tauri MenuBar / StatusBar

`docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_impl_review.md` の条件付き承認指摘への対応をレビューしてください。

## 対象

- Workflow: spec-change
- TODO: `TODO-2026-003 Tauri MenuBar / StatusBar 導入`
- Initial implementation review commit: `c6dc991 docs: review Tauri menu status implementation (conditional approval)`
- Follow-up target files:
  - `markdown-viewer-tauri/src/App.tsx`
  - `markdown-viewer-tauri/src/App.css`
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/impl/tauri_menubar_statusbar_impl.md`
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_impl_review.md`

## 確認してほしいこと

1. Medium 1.1 の対応確認
   - `@media (max-width: 760px)` で `.status-root { display: none; }` が残っていないこと。
   - 狭幅時も StatusBar が `Error` / `State` / `File` / `Root` の 4 列を維持すること。
   - `Root` は ellipsis と `title` で全文確認できる構造を維持していること。
   - 受け入れ条件「root path、active file、loading、error が StatusBar に表示される」が狭幅時も満たされること。

2. Low 3.1 の任意改善確認
   - `menu-group` に `role="group"` が付与されていること。
   - `role="menubar"` / `role="menuitem"` は引き続き導入されていないこと。

3. 検証結果
   - `npm run build` (`markdown-viewer-tauri/`) が成功していること。
   - `cargo check` (`markdown-viewer-tauri/src-tauri/`) が成功していること。

## 期待する出力

- 既存 review document に follow-up 確認結果を追記し、未解決指摘がなければ判定を `承認 (Approved)` に更新してください。
- 必要なら `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/meta.md` の `impl_status` と Phase Status も Phase 3 完了状態へ更新してください。
- レビュー結果を commit してください。
