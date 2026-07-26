# Tauri Split view 導入 履歴

## 背景

Tauri版はmulti-tabを備えていたが、表示できるpreviewは1つだけであり、仕様書、設計書、Markdown / HTML、UMLを比較するたびにtabを切り替える必要があった。UI / UX拡張WBSの`WP-004`として、同一root内の2文書を並べて参照できるpane modelが必要だった。

## 採用したアプローチ

- `OpenDocumentTab[]`をdocument dataの正本として維持し、表示選択とpending navigationだけを`SplitViewState`へ分離した。
- single modeもprimary `DocumentPane`を通すことで、single / splitの実装経路を一本化した。
- Explorer、Reload、relative link、StatusBar / ErrorBannerをactive paneまたはevent発生元paneへroutingした。
- Mermaid / HTML / image viewerの非同期処理とDOM refをpane / tab / revisionでguardし、結果の混線を防いだ。
- MermaidはApp所有Promise queueで直列化し、pane / tab / revision / diagram indexを含むrender IDを使用した。
- split ratioと狭幅clampをpure policyへ分離し、計測後だけARIA値を持つseparatorを描画した。
- HTML iframeのsandbox / CSP / root boundary / external link policyを変更せず、pane選択とtab revisionを独立して検証した。

## 結果

- `View > Split View`からsingle / 左右2paneを切り替えられるようになった。
- primary / secondaryで異なるtabを選択し、別文書を同時にpreviewできるようになった。
- Markdown、Mermaid、PlantUML、trusted HTML、image viewerのpane-local runtimeとfocus / accessibility契約が確立した。
- frontend build / 71 tests、Rust format / check / 22 testsが成功した。
- Claude design / implementation reviewは全13件を解決し、いずれも未解決0件で承認された。
- ユーザー実機確認でsplit切替と左右別文書previewがPASSした。

## Follow-up

- `TODO-2026-023`: paneごとに独立したTabStrip。
- `TODO-2026-024`: primary / secondary間のtab移動。
- `TODO-2026-025`: 上下・左右2pane split方向。
- 3pane以上と入れ子split treeは、上記follow-up後に別WBSで分解する。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260726_tauri_split_view/`
- Change report: `docs/design_analysis/new_feature/20260726_tauri_split_view/change_report.md`
- Branch: `new-feature/tauri-split-view`
- Main commits:
  - `c023374` Phase 0 requirements
  - `f98dfed` Phase 2 design review complete
  - `810f0c3` Phase 3 implementation
  - `c8f5272` Phase 3 review response
  - `7eb32ea` Phase 3 implementation approval
  - `0dfc91b` Phase 3 complete
  - `f8f6136` Phase 4-a user verification and follow-up TODOs
  - `a3acab4` Phase 4-b completion artifacts
