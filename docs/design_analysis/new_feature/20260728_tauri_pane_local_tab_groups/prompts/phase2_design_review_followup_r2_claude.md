再レビューで新規検出された Low 指摘 3.8 へ対応しました。

対応コミット:

- `3542fbb Phase 2 resolve runtime status clear review finding`

再レビューコミット:

- `7de22bb Phase 2 approve Tauri pane-local tab groups design`

設計文書の §9.1 と §14 の差分を確認し、次を検証してください。

- close / move / open / reload / root reset / split toggle の全 handler について、pane runtime status を直接 clear しない契約が列挙されていること。
- `setPanePreviewStatus(..., null)` による clear が既存 generic effect だけに限定されること。
- `setPanePreviewStatus` の他の呼び出しが `updatePanePreviewPhase` 経由の status 設定だけになる実装完了条件が明示されていること。

指摘 3.8 が解決していれば、次の review 文書を「承認・未解決 0 件」と分かる形へ更新し、レビュー成果だけをコミットしてください。

- `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/review/tauri_pane_local_tab_groups_design_review.md`

追加の未解決指摘があれば、同 review 文書へ追記・更新してコミットしてください。
