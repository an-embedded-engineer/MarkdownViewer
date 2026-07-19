# Phase 4-a ユーザー動作確認

## 確認日

2026-07-19

## 確認環境

- macOS上のTauri版MarkdownViewer
- `sample_docs/html_fixture/index.html`
- `sample_docs/image_link.md`

## ユーザー確認結果

ユーザーによる実機確認で、次の結果を確認した。

| 観点 | 結果 |
| --- | --- |
| 既存HTMLおよびinline SVGの表示 | PASS |
| `http:` / `https:`外部リンクのOS標準ブラウザ委譲 | PASS |
| `javascript:` URLの拒否 | PASS |
| HTMLから相対参照するPNG画像の表示 | PASS |
| Markdownから相対参照するPNG画像の表示 | PASS |

外部リンクはViewer内遷移ではなくブラウザで開くこと、`javascript:` URLは実行されないことを確認した。

## 追加fixture

- `sample_docs/html_fixture/assets/markdown-viewer-architecture.png`
  - GPT-Images2で生成したMarkdownViewer構成図。
  - `sample_docs/html_fixture/index.html`から相対参照し、HTML custom protocol経由のPNG配信を確認する。
- `sample_docs/images/avalonia-markdown-viewer-architecture.png`
  - GPT-Images2で生成したAvalonia版MarkdownViewer構成図。
  - `sample_docs/image_link.md`から標準Markdown画像構文で相対参照し、既存Markdown画像表示の回帰を確認する。

両画像はPNG形式、1672×941 pixelであり、参照先が選択root内に収まることを確認した。

## 自動検証

追加fixtureと検証記録の反映後に、次を再実行した。

| コマンド | 結果 |
| --- | --- |
| `npm run build` | PASS。既知のchunk size warningのみ。 |
| `npm test -- --run` | PASS。20 tests、0 failures。 |
| `cargo fmt -- --check` | PASS。 |
| `cargo check` | PASS。 |
| `cargo test` | PASS。22 tests、0 failures。 |
| `git diff --check` | PASS。 |

## Platform matrix残件

今回のユーザー確認はmacOS上の主要シナリオ確認であり、設計書 §17.5 のplatform matrix全項目を完了するものではない。次の実機証跡は未取得のため、成功と推定しない。

- macOSのsandbox `Origin: null` / JSON simple GET、no-cors `Origin` header、iframe IPC非公開、CSP、root外 / symlink拒否。
- Windows / Linuxの全platform matrix項目。

2026-07-19のPhase 4-b進行承認で、ユーザーはこれらを後日確認し、問題が判明した場合に`docs/issues/`へ起票して対応する方針を選択した。この再承認により現時点のPhase 4 completion blockerから外すが、未確認項目を成功とは推定しない。
