レビュー指摘の対応が完了しました。

対象 workflow: spec-change
review kind: Phase design review follow-up
issue directory: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar`
review document: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_design_review.md`

対応コミット:

- `bec06d5 docs: address Tauri menu status design review`

確認してほしい点:

- 指摘 1.1: MenuBar の操作モデルが、常時表示ボタン群でありドロップダウンを持たないこととして設計書に明確化されているか。
- 指摘 1.2: StatusBar の `State:` / `Error:` のみ `aria-live="polite"` とし、`Root:` / `File:` は live region に含めない方針が設計書に明確化されているか。
- 改善提案 3.1: 狭幅時の StatusBar 表示優先度が設計書に明確化されているか。
- レビュー文書の各指摘に `対応` が記録され、未対応指摘が残っていないか。

未解決指摘があれば review document に追記してコミットしてください。
問題なければ、Phase 2 設計レビューを承認したことが分かる形で出力してください。
