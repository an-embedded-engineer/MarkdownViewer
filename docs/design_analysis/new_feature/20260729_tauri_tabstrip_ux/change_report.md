# Tauri TabStrip 状態表現・scroll・drag move UX改善 変更レポート

## 対象

- TODO: `TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善`
- Branch: `new-feature/tauri-tabstrip-ux`
- Base branch: `main`
- Base commit: `c8edd303b47e14d81288a8adace581c82ec53372`
- Report commit range: `c8edd30..ee6d95a`
- 作成日: 2026-07-30

workflow規定は`git merge-base master HEAD`を例示するが、このrepositoryに`master`は存在しない。既定branchの`main`を用いて`git merge-base main HEAD`を実行し、上記base commitを取得した。

## 変更概要

Tauri版Markdown ViewerのTabStripをcompactな固定高へ更新し、状態indicator、必要時だけ視認可能なhorizontal scrollbar、文脈付きtab reveal、左右pane間のpointer drag and dropを追加した。

- TabStripを40px固定高とし、ready / active / loading / rendering / errorを上端indicatorとaccessible stateで表現した。
- horizontal scrollbarの6px trackを常時確保し、pointerがTabStrip内にある時またはkeyboard focusがある時だけthumbを表示した。
- overflowしたtabのactivate時にitem全体と進行方向の隣接tab 50%を表示し、連続clickで移動できるようにした。
- pointer dragを既存のtyped atomic `move-tab` transitionへ接続し、cancel / invalid dropではstateを変更しないようにした。
- 原因調査から派生した`View > Debug Information`を恒久機能として追加し、OFF時は採取を停止、ON時だけprovider単位の複数行診断を表示した。

## 実装

- `markdown-viewer-tauri/src/App.tsx`
  - TabStripのpointer / keyboard modality、focus、scroll、drag lifecycle、drop target、debug providerを統合した。
  - native scrollbar境界をouter shell矩形で判定し、window `pointermove`のlayout readをpaneごとにanimation frame最大1回へ集約した。
  - shell外へのleaveではpending frameと座標を破棄してから表示stateをclearし、iframe移動後の古い座標再適用を防止した。
- `markdown-viewer-tauri/src/App.css`
  - 40px固定高、上端indicator、6px scrollbar、drop feedback、drag preview、Light / Dark、reduced motionを実装した。
  - WebKit native scrollbarの初回paintを安定させるため、表示policyまたはtab数変更後の次frameにoverflow時だけ明示flushを行う契約とした。
- `markdown-viewer-tauri/src/tabStrip.ts`
  - scrollbar表示、shell矩形内判定、隣接tab 50%を含むreveal delta、drag開始、debug表示整形をpure policyとして追加した。
- `markdown-viewer-tauri/src/paneRuntime.ts`
  - ready / loading / rendering / errorの表示stateとARIA情報をpane-local runtimeから合成した。
- tests
  - state / ARIA、scrollbar policy、geometry、reveal、drag threshold / destination、debug formatterをfrontend unit testで検証した。

Rust command、custom protocol、Tauri capability、CSP、trusted HTML security boundaryは変更していない。

## ドキュメント

- `docs/architecture/code_patterns.md` / `common_pitfalls.md`
- `docs/components/tauri_viewer/README.md` / `basic_design.md` / `detail_design.md` / `interface_spec.md`
- `docs/rules/development_workflow.md`
- `docs/tests/README.md`

上記をcompact TabStrip、state indicator、scrollbar modality / WebKit workaround、context reveal、drag move、Debug Information、accessibility、手動確認項目へ同期した。

## レビュー

- Phase 2 design review:
  - 初回17件を指摘し、geometry、state priority、focus、drag lifecycle、atomic move、accessibility、test matrixを設計へ反映した。
  - follow-up review `0c0dd98`でApprovedとなり、実装時確認事項を除いて未解決0件となった。
- Phase 3 implementation review:
  - 初回4件と実機feedback後の複数roundを通じ、focus modality、pointer境界、WebKit paint、debug provider、layout read頻度、iframe境界raceを修正した。
  - 最終review `ee6d95a`で新規指摘0件、未解決0件、Approvedとなった。

## Phase 4-a ユーザー確認

ユーザーはcompact固定高、ready / rendering / error indicator、左右pane間drag move、右端tabのitem revealを実機で確認した。horizontal scrollbarの領域外非表示は複数回のfeedbackと診断ON/OFF比較を経て、WebKitの初回paintを明示flushする修正へ到達した。

最終確認では起動直後のDebug OFF / ON / ON→OFFの全状態でthumb表示・非表示が期待どおり動作し、選択tab全体と進行方向の隣接tab 50%を表示するcontext revealも受け入れられたためPASSとした。

## 検証結果

- `npm test -- --run`: 成功。6 files / 113 tests、0 failures。
- `npm run build`: 成功。既知のVite chunk size warningのみ。
- `cargo fmt -- --check`: 成功。
- `cargo check`: 成功。
- `cargo test`: 成功。22 tests、0 failures。
- `git diff --check`: 成功。
- design / implementation follow-up review: Approved、未解決0件。
- ユーザー実機確認: PASS。

## 生成物

- `diff.zip`
  - `git diff --binary --full-index c8edd30..ee6d95a`で単一patchを生成し、zip化した。
  - 39コミット、34変更file、3,730 insertions / 76 deletionsを収録した。
  - `unzip -t`で整合確認済み。

## 既知制約 / Follow-up

- WebKit native scrollbarの初回style / paint invalidationへ明示flushを適用している。将来のWebView更新後に、workaroundを外したbuildで起動直後・Debug OFFの表示が安定することを確認できた場合が削除条件となる。
- mouse起点のprogrammatic focusではthumbを表示しない。pointer滞在またはkeyboard入力後のfocusを表示条件とする意図したmodalityである。
- trusted HTML iframeが親documentの`pointermove`を吸収するため、pointer state解除はshell `pointerleave`またはwindow `blur`に依存する。
- pointer静止中にTabStrip geometryだけが変化した場合、領域内外判定は次のpointer moveで自己修復する。
- geometry pure policyはinvalid rectを拒否するが、実DOMの`getBoundingClientRect()`では到達しない前提である。
- UAのfocus ring heuristicと自前keyboard modalityは、一部のprogrammatic focusで理論上異なる可能性がある。
- 同一pane内reorder、pin、複数選択、一括move / close、実数progress、3pane以上は非対象である。
- 上下split方向は`TODO-2026-025`、Avalonia版pane / multi-tab UXは`TODO-2026-011` / `TODO-2026-012`で扱う。

## Phase 4-c

Phase 4-b完了時点では、`new-feature/tauri-tabstrip-ux`の`main`へのmergeはユーザー承認待ちである。
