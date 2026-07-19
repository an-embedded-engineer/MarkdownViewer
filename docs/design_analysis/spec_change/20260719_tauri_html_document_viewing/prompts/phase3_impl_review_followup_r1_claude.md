# TODO-2026-017 Phase 3 実装再レビュー依頼（Claude / Round 1）

レビュー指摘の対応が完了しました。
下記コミットから差分を取得して再確認してください。

`4bf5da6 Phase 3 address Tauri HTML implementation review`

対象レビュー文書:

`docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_impl_review.md`

対応:

1. `HtmlPreview`のactive tab id / revisionを明示propsとして渡し、listener capture値との実比較をmessage policyへ渡しました。
2. protocol callbackのper-request `thread::spawn`を`tauri::async_runtime::spawn_blocking`へ変更しました。
3. JSON body非変換、HTML bridge非注入、resource CSP非付与、`Cache-Control` / `Referrer-Policy` / CORP headerをRust testで直接assertしました。
4. malicious fixtureへexternal fetch / WebSocket、asset / unknown protocol、top / self navigation、download、forged `openExternal` / burst probeを追加しました。
5. `npm run build`、`npm test -- --run`、`cargo fmt -- --check`、`cargo check`、`cargo test`を再実行し、すべてPASSしました。

未解決指摘があればレビュー文書へ追記・更新してコミットしてください。
問題がなければ、レビュー文書の各status、判定、結論を更新し、未解決指摘ゼロおよびPhase 4-a進行可を明示してコミットしてください。

重要:

- 別Agentへ委譲しないでください。
- レビュー文書以外のファイルは変更しないでください。
