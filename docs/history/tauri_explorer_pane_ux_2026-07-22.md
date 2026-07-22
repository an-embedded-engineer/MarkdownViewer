# Tauri Explorer ツリーペイン UX 改善 履歴

## 背景

Tauri版Explorerは280px固定で、深い階層や長いfile名がellipsis表示になり、利用者が表示幅や末尾を確認できなかった。また、node種別の表示は文字記号中心で識別性に改善余地があった。

## 採用したアプローチ

- Explorer / Preview間へ6pxのseparatorを設け、pointer captureとkeyboard操作でExplorer幅を変更できるようにした。
- 初期280px、最小180px、hard最大640px、Preview予約320pxのpure width policyをfrontend moduleへ分離した。
- `ResizeObserver`でworkspace幅を計測し、狭幅時もARIAのmin / max / now契約が矛盾しないようdynamic最大値へfloorを適用した。
- Explorer headerとtree scroll viewportを分離し、tree contentへ`max-content`と`min-width: 100%`を併用して必要時だけ水平scrollを表示した。
- folder、Markdown、HTML、imageをdecorativeなinline SVG iconで区別し、node名をaccessible nameとして維持した。
- Explorer幅はsession stateに限定し、Rust API、tree data contract、app config永続化は変更しなかった。

## 結果

- 利用者がExplorer幅をpointerまたはkeyboardで定義範囲内に変更できるようになった。
- 深いpathや長いfile名をExplorer内の水平scrollで末尾まで確認できるようになった。
- folder、Markdown、HTML、imageのnode種別をiconで識別できるようになった。
- ユーザー実機確認で幅変更、長いpathの水平scroll、4種類のicon表示がPASSした。
- frontend build / 29 tests、Rust check / 22 tests / format checkが成功し、Claude design / implementation reviewはいずれも未解決0件で承認された。

## 参照

- Design analysis: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/`
- Change report: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/change_report.md`
- Branch: `spec-change/tauri-explorer-pane-ux`
- Main commits:
  - `d2091b3` Phase 0 requirements
  - `c1038c9` Phase 2 design
  - `f1da27b` Phase 2 design approval
  - `6310f88` Phase 3 implementation
  - `aaedc2c` Phase 3 implementation approval
  - `c9a0153` Phase 4-a user verification
  - `e14348b` Phase 4-b completion artifacts
