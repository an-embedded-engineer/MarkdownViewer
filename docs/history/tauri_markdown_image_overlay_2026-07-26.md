# Tauri Markdown画像オーバーレイ表示 履歴

## 背景

Tauri版ではMarkdown画像とUMLがpreview pane幅へ縮小されるため、巨大な図は全体を確認できても細部を読みにくかった。通常の文書layoutやdiagram containerの横scrollを変えずに、必要な時だけ拡大閲覧できるUIが必要だった。

## 採用したアプローチ

- load済み通常画像、描画成功済みMermaid SVG、描画成功済みPlantUML SVGだけをDOM adapterでdecorateした。
- app shell上のmodal viewerへ対象visualをcloneし、初期fit、最大800% zoom、pointer anchor wheel zoom、drag / Arrow pan、Fit / 100% resetを提供した。
- app shellの`inert`、focus trap、Escape / Close / backdrop、deferred focus復帰でmodal lifecycleを管理した。
- linked imageとSVG anchorの既存操作、Markdown title、通常時layout、trusted HTML iframeとRust backendのsecurity境界を維持した。
- Phase 4-aのフィードバックを受け、pointer closeはactive preview、keyboard closeは起点buttonへfocusを戻すようactivation別に分離した。

## 結果

- 巨大な通常画像、Mermaid、PlantUMLの細部を文書layoutを変えずに閲覧できるようになった。
- ユーザー実機確認でpointer / keyboard open、zoom / pan、Close / Escape、起点別focus復帰がPASSした。
- frontend build / 42 tests、Rust format / check / 22 testsが成功した。
- Claude design / implementation reviewは全指摘クローズ、未解決0件で承認された。

## 参照

- Design analysis: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/`
- Change report: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/change_report.md`
- Branch: `spec-change/tauri-markdown-image-overlay`
- Main commits:
  - `d2e9fd5` Phase 0 requirements
  - `7bcc92b` Phase 2 design approval
  - `ad68ae4` Phase 3 implementation
  - `56f53ed` Phase 3 implementation approval
  - `27ca57c` Phase 4-a activation-specific focus fix
  - `cd50464` Phase 4-a follow-up review approval
  - `64cde48` Phase 4-a user verification
