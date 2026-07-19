# Tauri HTML形式仕様書表示対応 変更レポート

## 対象

- TODO: `TODO-2026-017 Tauri HTML形式仕様書表示対応`
- Branch: `spec-change/tauri-html-document-viewing`
- Base branch: `main`
- Base commit: `24bcfb5fcd961bb3db4b4693e6cc7717bf9071de`
- Report commit range: `24bcfb5..a9193cf`
- 作成日: 2026-07-19

workflow規定の`git merge-base master HEAD`は、このrepositoryに`master`が存在しないため実行できなかった。既定branchの`main`を用いて`git merge-base main HEAD`を実行し、上記base commitを取得した。

## 変更概要

Tauri版MarkdownViewerで、選択root内のtrustedなUTF-8 `.html`をMarkdownと同じExplorer / Multi-tabから開き、安全境界を設けた独立HTML contextとして表示できるようにした。

- Explorer、open command、tab stateをMarkdown / HTMLの型付きdocument modelへ一般化した。
- HTML本体と許可resourceを選択root限定のcustom URI protocolで配信した。
- HTML previewをCSP付きsandboxed iframeに隔離し、親DOM、Tauri IPC、root外file、外部network、top navigation、popup等への到達を拒否した。
- user gestureを伴う`http:` / `https:` linkだけを検証し、OS標準ブラウザへ委譲した。
- HTMLではMarkdown変換、Mermaid、PlantUML処理を実行せず、既存Markdown経路を維持した。

## 実装

- `markdown-viewer-tauri/src-tauri/src/lib.rs`
  - `.html`列挙、typed document open、current root state、custom protocol、URL / path / symlink / resource allowlist / MIME / security header検証を追加した。
  - HTMLへhost bridgeを注入し、root-scoped resource requestとready / external-open message契約を実装した。
- `markdown-viewer-tauri/src/App.tsx`
  - `DocumentType`、HTML tab state、`HtmlPreview`、revision guard、external link委譲を追加した。
- `markdown-viewer-tauri/src/documentPolicy.ts`
  - iframe sandbox、protocol URL、message source、user activation、scheme、duplicate guardを純粋policyとして分離した。
- `markdown-viewer-tauri/src/App.css`
  - iframe preview、loading / error、focus表示を追加した。
- Tauri設定
  - custom protocol、shell opener、CSP / capability境界を同期した。

## fixture

- `sample_docs/html_fixture/`
  - inline SVG / Canvas、CSS、JavaScript、ES module、JSON、SVG、PNG、fragment、external link、拒否対象を含むfixtureを追加した。
- `sample_docs/image_link.md`
  - 既存Markdown経路でroot内相対PNGを表示する回帰fixtureを追加した。
- `sample_docs/html_shared.svg`
  - root内`../`参照の確認用SVGを追加した。

## ドキュメント

- `README.md` / `markdown-viewer-tauri/README.md`
- `docs/architecture/`
- `docs/components/tauri_viewer/`
- `docs/rules/`
- `docs/tests/README.md`

上記をtyped document model、HTML protocol、sandbox / CSP境界、外部link契約、fixtureおよび検証手順へ同期した。

## レビュー

- Phase 2 design review:
  - 初回指摘を反映後、Claude follow-up reviewで承認された。
- Phase 3 implementation review:
  - 初回承認時のLow 4件を追補し、Claude follow-up reviewで未解決指摘ゼロ・Phase 4-a進行可が確認された。
- 未解決レビュー指摘: なし。

## Phase 4-a ユーザー確認

macOS上のTauri版で次を確認した。

- 既存HTMLおよびinline SVGが表示される。
- `http:` / `https:`外部linkがOS標準ブラウザで開く。
- `javascript:` URLが拒否される。
- HTMLから相対参照したPNGが表示される。
- Markdownから相対参照したPNGが表示される。

詳細は`verification/phase4a_user_verification.md`を参照する。

## 検証結果

- `npm run build`: 成功。既知のVite chunk size warningのみ。
- `npm test -- --run`: 成功。20 tests、0 failures。
- `cargo fmt -- --check`: 成功。
- `cargo check`: 成功。
- `cargo test`: 成功。22 tests、0 failures。
- `git diff --check`: 成功。
- Claude design / implementation follow-up review: 承認、未解決指摘なし。

## 生成物

- `diff.zip`
  - `git diff --binary --full-index 24bcfb5..a9193cf`でpatchを生成し、zip化した。
  - source、test、fixture、設計・レビュー・恒久docsを含む48変更fileを収録した。
  - `unzip -t`で整合確認済み。

## Platform確認方針 / follow-up

設計時はmacOS / Windows / Linuxの全platform matrixをPhase 4 completion条件としていたが、2026-07-19のユーザー判断により、Windows / Linuxおよび未実施のplatform固有security matrixは後日確認へ移した。未確認項目を成功とは推定せず、現時点では自動検証、レビュー、macOS主要シナリオをもってPhase 4-bを完了する。

後日の実機確認でplatform固有の不具合が判明した場合は、症状、環境、再現手順、期待結果を`docs/issues/`へ起票し、issue-resolutionまたはbugfix workflowで対応する。既知のplatform確認観点は`docs/components/tauri_viewer/issues.md`で継続管理する。
