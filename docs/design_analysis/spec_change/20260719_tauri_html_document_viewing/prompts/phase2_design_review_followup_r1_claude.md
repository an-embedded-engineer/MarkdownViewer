# TODO-2026-017 Phase 2 設計再レビュー依頼（Claude / Round 1）

レビュー指摘への対応が完了しました。
下記コミットから差分を取得し、設計書とレビュー文書を再確認してください。

## 対応コミット

`9489c43 Phase 2 address Tauri HTML design review findings`

## 対象文書

- 設計書: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/design/tauri_html_document_viewing_design.md`
- レビュー文書: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_design_review.md`
- メタ情報: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/meta.md`

## 指摘対応の概要

1. `convertFileSrc` を HTML preview URL に使用せず、Rust が current-root-relative path の各 segment を個別 encode した完全な `previewUrl` を返す契約へ変更しました。
2. 成功 HTML に `ready` handshake を注入し、frontend は source・origin・tab revision を検証した message のみを ready 判定の正本としました。
3. `Origin` header 不在を許可し、存在時のみ厳密に `null` を要求し、全成功 response に `Access-Control-Allow-Origin: null` を付与する契約へ明確化しました。
4. root 内 JSON fetch を preflight 不要の simple GET に限定し、`OPTIONS` は 405 と明記しました。
5. sort 順は既存 `node_sort_rank` を唯一の正本とし、`PartialOrd` / `Ord` derive を採用しない設計へ変更しました。
6. platform ごとに shell origin が異なること、message が非機密で受信側が全面検証することを `parent.postMessage(..., "*")` の根拠として追記しました。

## 再レビュー時の依頼事項

- 初回指摘が設計全体、受け入れ条件、test 計画、platform matrix、risk 記載へ一貫して反映されているか確認してください。
- 対応によって新しい齟齬、セキュリティ上の欠落、実装不能な契約が生じていないか確認してください。
- 未解決指摘があればレビュー文書へ追記・更新し、変更を commit してください。
- 問題がなければ、レビュー文書の各 status と判定・結論を更新し、Phase 3 へ進行可能であることを明示して commit してください。
- 別 Agent へ委譲しないでください。
- レビュー文書以外のファイルは変更しないでください。
