# Tauri pane-local tab group / pane間移動 変更レポート

## 対象

- TODO: `TODO-2026-023 Tauri pane-local tab group / pane 間移動`
- Branch: `new-feature/tauri-pane-local-tab-groups`
- Base branch: `main`
- Base commit: `a97c530580f96f0217294ed53073f32543519174`
- Report commit range: `a97c530..c807c1a`
- 作成日: 2026-07-29

workflow規定の`git merge-base master HEAD`は、このrepositoryに`master`が存在しないため実行できなかった。既定branchの`main`を用いて`git merge-base main HEAD`を実行し、上記base commitを取得した。

## 変更概要

Tauri版Markdown Viewerのprimary / secondaryへpane-local tab groupを導入し、各paneで開いたtabだけを表示して明示操作で反対paneへ移動できるようにした。

- global document dataとpane-localな所属・順序・selectionを分離した。
- Explorer / relative linkからactive paneへtabを追加するようroutingした。
- tab activate / close / eviction、split off / on、root resetをpane group対応にした。
- tabの所属、移動元fallback、移動先selection、active paneをatomicに更新するpane間moveを追加した。
- 同一documentを両paneから参照する場合もpreview runtimeと非同期stateを分離した。
- Phase 4-a feedbackに対し、左右TabStripを固定高にして状態表示やscrollbar有無による段差を解消した。

## 実装

- `markdown-viewer-tauri/src/splitView.ts`
  - pane別ordered tab IDs、active tab、追加・activate・close・root reset・split切替・atomic moveのpure transitionを実装した。
- `markdown-viewer-tauri/src/paneRuntime.ts`
  - pane-local groupとglobal document dataからpresentation stateを合成し、pane / tab / revision guardを維持した。
- `markdown-viewer-tauri/src/App.tsx`
  - Explorer / relative link routing、pane別TabStrip、move / focus、Reload、document evictionをpane groupへ接続した。
- `markdown-viewer-tauri/src/App.css`
  - pane-local TabStripとmove controlを追加し、Phase 4-a feedbackで固定高・固定line-heightへ調整した。
- `splitView.test.ts` / `paneRuntime.test.ts`
  - pane別追加・activate・close、同一document参照、move fallback、split復元、root reset、stale result拒否を検証した。

Rust command、custom protocol、Tauri capability、CSP、settings schema、trusted HTML security boundaryは変更していない。

## ドキュメント

- `docs/architecture/overview.md` / `code_patterns.md` / `common_pitfalls.md`
- `docs/components/tauri_viewer/README.md` / `basic_design.md` / `detail_design.md` / `interface_spec.md`
- `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`
- `docs/rules/development_workflow.md`
- root / Tauri README

上記をpane-local tab group、atomic move、runtime境界、accessibility、手動確認項目へ同期した。

## レビュー

- Phase 2 design review:
  - 合計13件を指摘し、tab group invariant、root reset、focus、status clear、同一documentの両pane参照、非同期guardなどを設計へ反映した。
  - 最終review `8ecbe5a`でApproved、未解決0件となった。
- Phase 3 implementation review:
  - 初回3件を指摘し、document eviction、move後focus、status整合を修正した。
  - Phase 4-aの高さfeedbackを追加findingとして扱い、固定高へ修正した。
  - 最終review `025a81b`でApproved、未解決0件となった。

## Phase 4-a ユーザー確認

ユーザーはpane-local tab追加・選択・close・pane間moveを実機確認した。初回は操作反復時の過度な縮小とpane間の高さ差を報告したためNGとしてPhase 3へ差し戻し、TabStripを固定高へ修正した。

2026-07-29の再確認で、高さが一定になり、低くなりすぎる現象も再発しないことを確認したためPASSとした。状態indicator、compact化、scroll UX、drag and dropは別アイテム`TODO-2026-026`へ登録した。

## 検証結果

- `npm test -- --run`: 成功。5 files / 77 tests、0 failures。
- `npm run build`: 成功。既知のVite chunk size warningのみ。
- `cargo fmt -- --check`: 成功。
- `cargo check`: 成功。
- `cargo test`: 成功。22 tests、0 failures。
- design / implementation follow-up review: Approved、未解決0件。
- ユーザー実機確認: PASS。

## 生成物

- `diff.zip`
  - `git diff --binary --full-index a97c530..c807c1a`で単一patchを生成し、zip化した。
  - 23コミット、34変更file、2,601 insertions / 260 deletionsを収録した。
  - `unzip -t`で整合確認済み。

## 既知制約 / Follow-up

- 現行のpane間moveは矢印buttonによる明示操作である。drag and dropとTabStrip表示・scroll改善は`TODO-2026-026`で扱う。
- 上下・左右split方向は`TODO-2026-025`で扱う。
- Avalonia版のpane / multi-tab水平展開は`TODO-2026-011` / `TODO-2026-012`で扱う。
- group内reorder / pin、複数選択・一括操作、3pane以上、split tree、再起動後layout永続化は対象外である。

## Phase 4-c

ユーザーの最終承認後、`new-feature/tauri-pane-local-tab-groups`を`main`へ`--no-ff`でマージした。merge commitは`74526ac`。
