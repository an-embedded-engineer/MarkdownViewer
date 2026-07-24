# Phase 4-a ユーザー動作確認

## 確認日

2026-07-25

## 対象

- Tauri版MarkdownViewer
- TODO: `TODO-2026-021`
- 実装review:
  `../review/tauri_document_preview_responsive_width_impl_review.md`
  （Round 2 Approved、未解決指摘0件）

## ユーザー確認結果

初回確認ではMarkdown本文の幅調整は期待どおりだったが、描画済みMermaidがwindow resize後にdiagram source文字列へ戻る事象が見つかった。この結果をNGとしてPhase 3へ戻し、commit `adc1a49`で修正、review commit `87d438a`で再承認された。

修正後のユーザー実機再確認では、依頼した次の4項目がすべて期待どおり動作した。

| 観点 | 結果 |
| --- | --- |
| `sample_docs/preview_width.md`を開いた初期状態でMermaidがSVG表示される | PASS |
| window幅を複数回変更してもMermaidがSVG表示を維持する | PASS |
| Explorer幅を変更してもMermaidがSVG表示を維持する | PASS |
| Light / Dark切替とReload後もMermaidが正常に再描画される | PASS |

ユーザーは上記1〜4がすべて問題ないことを確認し、Phase 4-bへの進行を承認した。初回確認で合格していたMarkdown本文のpane幅追従とあわせ、Phase 4-aを完了とする。

## 自動検証

Phase 4-aフィードバック修正後に実装担当とreviewerが次を実行し、結果が一致した。

| command | 結果 |
| --- | --- |
| `npm run build` | PASS。既知のchunk size warningのみ。 |
| `npm test -- --run` | PASS。2 files / 29 tests、0 failures。 |
| `cargo check` | PASS。 |
| `cargo test` | PASS。22 tests、0 failures。 |
| `cargo fmt -- --check` | PASS。 |
| `git diff --check` | PASS。 |

## 結論

- Markdown本文は固定980pxで止まらず、preview pane幅からgutterを引いた幅へ追従する。
- Mermaidは初期描画、window resize、Explorer resize、Theme切替、ReloadでSVG表示を維持または正常に再描画する。
- Phase 4-aの未解決事項はない。
