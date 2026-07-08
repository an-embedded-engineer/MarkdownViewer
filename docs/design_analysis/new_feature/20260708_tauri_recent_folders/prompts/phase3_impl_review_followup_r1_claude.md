# Phase 3 implementation review follow-up r1: Tauri Recent Folders

レビュー指摘の対応が完了しました。

対象:

- workflow: new-feature
- review kind: Phase impl review follow-up
- issue id/title: `TODO-2026-004 Tauri Recent Folders 導入`
- review document path: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_impl_review.md`
- previous review commit: `0408028 Phase 3 add Tauri recent folders implementation review`
- fix commit: `632f0a2 Phase 3 address Tauri recent folders implementation review`

確認してほしいこと:

- 1.1: `header.menu-bar` から `role="menubar"`、`File` / `View` trigger から `role="menuitem"` が削除され、top-level trigger が native button + `aria-haspopup="menu"` / `aria-expanded` に戻っているか。
- 1.1: `role="menu"` 配下の layout wrapper (`menu-section-label`, `recent-folder-list`, `recent-folder-row`) が `role="none"` になり、recent open/delete button と empty state の menu role が整合しているか。
- 1.1: `docs/components/tauri_viewer/detail_design.md` と impl 記録が、`role="menubar"` を今回の最小範囲では使わない方針へ更新されているか。
- 3.1: `loadMarkdown` が失敗 message を返し、`loadRoot` が Markdown 読み込み失敗を `recentError` で上書きしないようになっているか。
- 検証: fix 後の `npm run build`、`cargo check`、`git diff --check` は Codex 側で再実行済みで、いずれも成功しています。

未解決指摘があれば `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_impl_review.md` に追記して commit してください。

問題なければ、承認したことが分かる形でレビュー文書を更新し、必要に応じて commit してください。
