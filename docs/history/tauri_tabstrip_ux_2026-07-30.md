# Tauri TabStrip 状態表現・scroll・drag move UX改善 履歴

## 背景

pane-local tab group導入後のTabStripは固定高になったが、状態表示がvisible textを使い、overflow時のscrollbar、見切れたcontrolへの到達、pane間のpointer移動に改善余地があった。またWebKit native scrollbarは、表示条件が正しくても起動直後のpaintが診断処理の有無で変わる問題を示した。

## 採用したアプローチ

- TabStripを40px固定高にし、ready / active / loading / rendering / errorを上端indicatorとaccessible name / `aria-busy`で表現した。
- 6pxのscrollbar trackを常時確保し、明示的なpointer-inside stateとkeyboard-focus stateのORだけでthumb表示を制御した。
- pointer領域判定はouter shell矩形から双方向に再導出し、window `pointermove`のlayout readをpaneごとにanimation frame最大1回へ集約した。
- shell外leaveではpending frameと座標を破棄してからstateをclearし、iframe境界で古い領域内座標が再適用されないようにした。
- WebKitの初回paint問題には、表示policyまたはtab数変更後の次frameにoverflow時だけlayoutとthumb computed styleを読む明示flushを採用した。
- tab activate時はitem全体を優先しつつ、進行方向の隣接tab 50%を表示して連続clickを可能にした。
- pointer dragは既存のtyped atomic `move-tab`へ接続し、pointer capture、threshold、drop再判定、cancel cleanupをUI adapter側で管理した。
- `View > Debug Information`を汎用provider形式で追加し、OFF時は採取を停止、ON時だけErrorBannerとStatusBarの間へ複数行情報を表示した。

## 結果

- 左右pane、empty、overflow、状態遷移を通じてTabStripがcompactな固定高を維持するようになった。
- 正常完了は青線、読み込み中は移動する青線、errorは赤線として上端に表示され、支援技術向けstateも維持された。
- horizontal scrollbarは起動直後を含め、pointerまたはkeyboard利用時だけ表示され、領域外で非表示になるようになった。
- 見切れたtabを選択するとitem全体と次の隣接tabの一部が表示され、連続して端まで移動できるようになった。
- drag and dropと既存の矢印move buttonが同じpane間move transitionを利用するようになった。
- frontend 6 files / 113 tests、Rust 22 tests、frontend build、Rust format / checkが成功した。
- design review 17件と全implementation review roundの指摘を解消し、最終新規0件・未解決0件で承認された。
- ユーザー実機確認で固定高、indicator、drag move、scrollbar、context reveal、Debug ON / OFFがPASSした。

## 既知制約

- WebKit native scrollbarの初回paintへengine依存の明示flushを適用しており、将来WebView更新時に削除可否を再評価する。
- trusted HTML iframe内では親documentが`pointermove`を受けないため、領域外clearはshell `pointerleave` / window `blur`に依存する。
- pointer静止中のgeometry変化は次のmoveで自己修復する。
- UA focus ringと自前keyboard modalityはprogrammatic focusで理論上ずれる可能性がある。

## Follow-up

- `TODO-2026-025`: Tauri上下・左右split方向。
- `TODO-2026-011` / `TODO-2026-012`: Avalonia版のpane / multi-tab UX水平展開。
- 同一pane内reorder、pin、複数選択、一括操作、実数progress、3pane以上は別scopeとする。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/`
- Change report: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/change_report.md`
- Verification: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/verification/phase4a_user_verification.md`
- Branch: `new-feature/tauri-tabstrip-ux`
- Main commits:
  - `c8edd30` Phase 0 requirements
  - `0c0dd98` Phase 2 design approval
  - `031c06a` Phase 3 implementation
  - `ca48356` initial Phase 3 implementation approval
  - `d9ebeaa` focus modality follow-up approval
  - `55bd8b9` pointer boundary follow-up approval
  - `19ca878` WebKit scrollbar style flush
  - `d0d45bf` adjacent tab context reveal
  - `41d2da8` Round 4 review findings resolution
  - `ee6d95a` final implementation review approval
  - `39c5661` Phase 4-b completion artifacts
  - `1875ebf` Phase 4-c merge into `main`
