あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: new-feature
review kind: Phase 3 implementation and permanent documentation review

対象:

- `TODO-2026-023 Tauri pane-local tab group / pane 間移動`
- implementation commit: `13c87a3 Phase 3 implement Tauri pane-local tab groups`
- approved design: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/design/tauri_pane_local_tab_groups_feature_design.md`
- approved design review: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/review/tauri_pane_local_tab_groups_design_review.md`
- implementation record: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/impl/tauri_pane_local_tab_groups_feature_impl.md`

`13c87a3` とその親の差分、現行コード、テスト、恒久ドキュメントを取得して Phase 3 レビューを実施してください。レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当とnew-feature Phase 3の観点に従ってください。

特に次を実コードとテストで確認してください。

- `PaneState`のordered membership / active / pending invariantが全actionで閉じていること。
- open / local close / last-reference eviction / same ID両group / atomic move / split off-on保持が承認済み設計と一致すること。
- global `OpenDocumentTab[]`とpane-local group viewのApp integrationに中間不整合やsilent fallbackがないこと。
- close / move / open / reload / root reset / split toggleのruntime status clearがgeneric effectだけへ一本化されていること。
- Mermaid / PlantUML / trusted HTML / image viewerのpane / tab / revision guardとsecurity境界が退行していないこと。
- move / close後focus、keyboard到達性、ARIA name、split tab minimum width、hidden secondary回復導線が設計どおりであること。
- 既存test移行が旧仕様を単に緩めたものではなく、新しいcontract・境界値・失敗系を直接検証していること。
- 設計§15の恒久ドキュメント置換対象に旧global TabStripの相反記述が残っていないこと。
- 実装記録の検証結果が実行可能なコマンドと一致すること。

自動検証済み:

- `npm test -- --run`: 5 files / 77 tests passed
- `npm run build`: success（既知のchunk size warningのみ）
- `cargo fmt -- --check`: success
- `cargo check`: success
- `cargo test`: 22 passed / 0 failed
- `git diff --check`: success

レビュー結果は次へ作成し、レビュー成果だけをコミットしてください。

- `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/review/tauri_pane_local_tab_groups_impl_review.md`

指摘はseverity、blocking / non-blocking、根拠、推奨対応、対応工程を明記し、問題がなければ承認・未解決0件と明記してください。metaのstatus更新は実装担当が行うため変更しないでください。
