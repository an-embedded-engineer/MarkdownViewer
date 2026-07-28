# Tauri pane-local tab group / pane間移動 履歴

## 背景

Tauri版Split Viewはprimary / secondaryで異なるdocumentを同時表示できたが、open tab collectionは共有され、両TabStripへ同じtabが並んでいた。左右で別の作業文脈を維持し、必要なtabだけを各paneへ置くため、pane-localな所属・表示順・選択と明示的なpane間移動が必要だった。

## 採用したアプローチ

- global `OpenDocumentTab[]`を本文、revision、render cacheなどdocument dataの正本として維持し、pane groupにはordered tab IDsとactive tabだけを保持した。
- Explorer / relative linkで開いたdocumentはactive paneへ追加し、同じdocumentを両paneから参照できるようにした。
- activate、close、eviction、root reset、split off / on、pane間moveを`splitView.ts`のtyped pure transitionへ集約した。
- pane間moveでは所属変更、移動元fallback、移動先selection、active paneをatomicに更新し、UI側で対象tabへfocusを戻した。
- preview runtimeと非同期resultはpane / tab / revisionでguardし、同じdocument dataを共有しても表示状態を共有しないようにした。
- Phase 4-aの実機feedbackを受け、TabStrip rowを固定高にしてstate labelやhorizontal scrollbarの有無によるpane間の段差と過度な縮小を防いだ。
- Rust command、custom protocol、capability、CSP、trusted HTML security boundaryは既存契約を維持した。

## 結果

- primary / secondaryのTabStripが独立し、tab追加・選択・closeが他paneへ波及しなくなった。
- 同じdocumentを両paneに置きつつ、preview runtimeとstatusをpane-localに扱えるようになった。
- pointer / keyboardからtabを反対paneへ移動し、移動元fallbackと移動先focusを一貫して復旧できるようになった。
- single view中もsecondary groupを保持し、split再有効化時に復元できるようになった。
- frontend 5 files / 77 tests、Rust 22 tests、frontend build、Rust format / checkが成功した。
- design review 13件、implementation review 4件をすべて解決し、最終未解決0件で承認された。
- ユーザー実機確認でpane-local操作、pane間move、固定高と過度な縮小の非再発がPASSした。

## Follow-up

- `TODO-2026-025`: 上下・左右split方向。
- `TODO-2026-026`: TabStripの上端state indicator、compact化、hover / focus scrollbar、tab全体の自動scroll、pane間drag and drop。
- `TODO-2026-011` / `TODO-2026-012`: Avalonia版のpane / multi-tab水平展開。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/`
- Change report: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/change_report.md`
- Verification: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/verification/phase4a_user_verification.md`
- Branch: `new-feature/tauri-pane-local-tab-groups`
- Main commits:
  - `a97c530` Phase 0 requirements
  - `8ecbe5a` Phase 2 design approval
  - `13c87a3` Phase 3 implementation
  - `d0f8dac` Phase 3 implementation approval
  - `cea681a` TabStrip height stabilization
  - `025a81b` height stabilization approval
  - `c807c1a` Phase 4-a user verification and follow-up registration
