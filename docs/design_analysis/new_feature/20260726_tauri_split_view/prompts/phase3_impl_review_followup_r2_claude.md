Phase 3実装レビュー指摘4件への対応が完了しました。

対応コミット: `c8f5272`
対象実装記録: `docs/design_analysis/new_feature/20260726_tauri_split_view/impl/tauri_split_view_feature_impl.md`
レビュー文書: `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_impl_review.md`

上記コミットの差分と更新後ファイル全体を取得し、初回指摘1.1および3.1〜3.3の対応を再確認してください。

確認事項:
- 1.1: loading完了とtheme remountの双方でliveなMarkdown previewが登録され、非Markdown時とunmount時のfallback / cleanupがfocus可能なpane regionを使うこと。
- 3.1: 選択が変わらない再clickでstatusを消さず、Reloadはrevision更新対象tabを選択中のpaneだけをclearし、同一tab両pane表示では両方をclearすること。
- 3.2: separatorを除くavailable幅が1px以下ならbounds / keyboard / pointer policyが安全にno-opとなり、ratio 0 / 1をreducerへ渡さないこと。
- 3.3: pane選択とtab revisionのpure判定が独立し、stale guardは両者を合成しつつHTML bridge contextへ個別配線されていること。
- `npm test -- --run`は5 files / 71 tests、`npm run build`は成功済みであること。

重要:
- この再確認を別Agent、skill、tmux sessionへ再委譲しないでください。
- 実装、テスト、設計書、恒久ドキュメント、実装記録は変更しないでください。
- 各指摘のstatus、受け入れ条件トレース、判定、未解決件数をレビュー文書へ反映してください。
- 新たな齟齬があれば重大度、工程、根拠、推奨対応、statusを明記してください。
- 未解決指摘が0件ならPhase 3実装を承認し、Phase 4へ進行可能であることを明記してください。
- 更新したレビュー文書だけをコミットしてください。
