# TODO-2026-021 Tauri document preview 横幅の可変化 実装・恒久ドキュメントレビュー

**レビュー日**: 2026-07-25
**再確認日**: 2026-07-25
**対象ドキュメント**: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/impl/tauri_document_preview_responsive_width_impl.md`
**承認済み設計**: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/design/tauri_document_preview_responsive_width_design.md`
**設計レビュー**: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/review/tauri_document_preview_responsive_width_design_review.md`（承認済み、未解決指摘 0 件）
**対象 TODO**: `docs/todo/todo.md` TODO-2026-021
**レビュー対象コミット**: `9694e2b` (feat: make Tauri preview width responsive)
**Round 1 fix コミット**: `64b7b12` (docs: address Tauri preview width implementation review)
**判定**: **承認 (Approved)**。Phase 4（検証・完了）進行可。ブロッキング指摘 (High / Medium) 0 件。初回検出の改善提案 (Low 1 件) は Round 1 fix (`64b7b12`) と `spec-change-workflow` Phase 3 の documented lifecycle 確認により解消済みと再確認した。**未解決指摘 0 件**。

---

## 概要

TODO-2026-021 の Phase 3 実装・恒久ドキュメントレビュー。コミット `9694e2b` の全差分（`git show 9694e2b`）、変更後の `markdown-viewer-tauri/src/App.css` 実体、追加 fixture `sample_docs/preview_width.md`、恒久ドキュメント 5 種、実装記録を根拠に、承認済み設計・設計レビュー 3.1・TODO-2026-021 完了条件との一致を検証した。

コミットが触れた実装ファイルは `markdown-viewer-tauri/src/App.css` の 1 行のみで、残りはすべて docs / meta / fixture である。

```diff
 .markdown-body {
-  width: min(980px, calc(100% - 48px));
+  width: calc(100% - 48px);
   min-height: 100%;
   margin: 0 auto;
   padding: 32px 0 56px;
```

変更後の実体（`App.css:728-735`）は `width: calc(100% - 48px)` のみを持ち、旧 `min(980px, ...)` 固定経路は残っていない。`@media (max-width: 760px)` 下の `.markdown-body { width: calc(100% - 28px) }`（`App.css:882-885`）は差分に含まれず、狭幅 gutter 契約が維持されている。設計 §6.1 の採用案と完全に一致し、JavaScript 計測・`ResizeObserver`・window listener・互換レイヤー・fallback・重複抽象化はいずれも追加されていない。

自動検証はレビュー側でも再実行し、実装記録の主張と一致することを確認した（`npm test -- --run` → 2 files / 29 tests passed、`cargo test` → 22 passed、`cargo fmt -- --check` → 差分なし）。

初回レビューでは、`meta.md` の `impl_status` がプロジェクト内他 metadata の慣例値 `done` に対し `draft` になっている点を軽微な表記整合（Low, 非ブロッキング）として検出した。follow-up で `spec-change-workflow` Phase 3 の documented lifecycle を確認した結果、この `draft` はレビュー依頼時点として手順どおりの正常状態であり、Round 1 fix (`64b7b12`) で `in_review` へ正しく遷移していることを再確認した（第 3 節）。実装・fixture・恒久ドキュメントの内容には初回から齟齬がなかった。

---

## 1. 齟齬・不整合

ブロッキングとなる齟齬・不整合は検出しなかった。

- **旧 980px 経路の除去**: 変更後 `App.css:729` は `width: calc(100% - 48px)` 単一宣言で、`min(980px, ...)` は完全に除去されている（設計 §6.1、完了条件「980px 超で本文拡張」と一致）。
- **760px viewport breakpoint の維持**: `@media (max-width: 760px)` の `width: calc(100% - 28px)`（`App.css:882-885`）は無変更で、狭幅 14px gutter が保持されている（設計 §5、完了条件「狭幅で responsive margin 維持」と一致）。
- **子要素契約の非変更**: table `display:block; width:100%; overflow-x:auto`、pre / mermaid / plantuml `overflow-x:auto`、img / plantuml svg `max-width:100%`（`App.css:804-861`）は差分に含まれず維持されている（設計 §6.2 と一致）。
- **HTML iframe / Explorer / tab / security の非変更**: `.html-preview-frame { width:100% }`、`App.tsx`、`explorerPane.ts`、`documentPolicy.ts`、`src-tauri/`、protocol / sandbox / CSP はコミット差分に一切含まれない（`git show 9694e2b --name-only` の非 doc ファイルは `App.css` のみ）。設計 §4.2 非対象範囲・完了条件「操作回帰なし」「iframe security 境界維持」と一致。

---

## 2. ドキュメント不足

なし。設計 §14 が予定した恒久ドキュメント 5 種がすべて更新され、内容が実装と一致する。

- `README.md`: Markdown 本文の pane 追従・HTML iframe 全幅・`App.css` 責務（pane 相対の本文幅）を追記。実装と一致。
- `basic_design.md`: 「CSS layout」責務行を追加し、固定 px 最大幅を持たない本文幅と HTML 文書 layout 非上書きを明記。実装と一致。
- `detail_design.md`: box model（`calc(100% - 48px)` + `margin:0 auto`）、gutter 値（24px / 14px）、**本文 width は preview pane content box 基準 / gutter breakpoint は window viewport 基準 / Explorer resize・split view で pane だけが狭くなっても gutter 非切替**、子要素 overflow / scaling、iframe 全幅を追記。設計レビュー 3.1 の分離契約を正確に反映。
- `interface_spec.md`: 「Document Preview 表示」節を新設し、pane 追従・gutter 24px/14px・pane だけ狭くなっても非切替・子要素 overflow/scaling・iframe 全幅・縦 scroll 所有を明記。実装と一致。
- `development_workflow.md`: `sample_docs/preview_width.md` を用いた 1028px 超拡張・広幅図表・viewport 760px 以下 14px・**viewport 760px 超維持の Explorer resize で gutter 24px 維持**・HTML iframe 追従の手動確認項目を追加。設計レビュー 3.1 の観察観点を反映。

ADR 非追加の設計判断（設計 §14 末尾）とも矛盾しない。恒久ドキュメントは 4 文書すべてで「本文幅 = pane 基準 / gutter breakpoint = viewport 基準」という設計レビュー 3.1 の区別を一貫して記述しており、誤読の余地は解消されている。

---

## 3. 改善提案

### 3.1 `meta.md` の `impl_status` がプロジェクト慣例値 `done` に対し `draft` になっている

**ドキュメント記載**: `meta.md` front matter `impl_status: "draft"`（`9694e2b` で `pending` → `draft` へ更新）。

**差異**: プロジェクト内の他 metadata 12 件はいずれも `impl_status` を `done`（引用 9 件 + 非引用 2 件）で記録しており、`draft` はこの案件のみである。Phase 3 の実装本体（`App.css`、fixture、恒久ドキュメント）は完了し、自動検証も全件通過しているため、慣例に沿えば実装完了状態を示す値が期待される。`draft` は「実装済み・review 承認待ち」を意図した中間状態とも解釈できるが、他案件に前例がなく、`Phase Status` 表（Phase 3 = Pending）とあわせて状態表現が二系統になっている。

**推奨対応**: Phase 3 review 承認後の完了処理、または本コミット系列の後続 docs 更新で、`impl_status` をプロジェクト慣例に合わせて `done` へ更新する（`Phase Status` 表側の Phase 3 完了記録と整合させる）。実装成果物・fixture・恒久ドキュメントの内容には影響しない front matter のみの整合であり、Phase 4 進行をブロックしない。

**severity**: Low（front matter の表記整合のみ。実装・fixture・恒久ドキュメントの正しさと Phase 4 検証には影響しない）

**工程**: Phase 3 完了処理 または Phase 4 完了処理時の meta 更新

**initial status**: open

**対応**: `spec-change-workflow` Phase 3は、レビュー依頼前に`impl_status`を`draft`、レビュー文書作成後の指摘対応中に`in_review`、未解決指摘0件の確認後に`done`へ更新するライフサイクルを明示している。レビュー対象コミット`9694e2b`の`draft`は手順どおりのレビュー依頼前状態であり、他案件の完了済みmetaが`done`であることとも矛盾しない。本レビュー文書作成後の現在状態として`meta.md`を`in_review`へ更新し、reviewer follow-upで未解決0件を確認した後、Phase 3完了コミットで`done`へ更新する。

**確認 (`64b7b12`)**: follow-up として次の 3 点を検証した。

1. **レビュー依頼時点の `draft` が手順どおりであること** — `spec-change-workflow` の `references/procedure/workflow_phase_library/common/phase_3_impl_and_docs_review.md` は、手順 6 で `impl_status` を `draft` へ、手順 9 でレビュー文書作成後に `in_review` へ、手順 10 で未対応指摘 0 件到達時に `done` へ更新すると明示している。レビュー対象コミット `9694e2b` の `impl_status: "draft"` はこの手順 6 のレビュー依頼前状態に一致する。初回指摘 3.1 はプロジェクト内の**完了済み** metadata（すべて `done`）のみと比較した結果 `draft` を anomaly として挙げたが、Phase 3 進行中の中間状態には比較対象が存在しなかったためで、documented lifecycle 上は正常であることを確認した。
2. **`64b7b12` で `in_review` へ更新され、3.1 の対応説明が review 文書へ追記されていること** — `git show 64b7b12` で `meta.md` の `impl_status: "draft"` → `"in_review"` 更新（手順 9 に一致）と、`related_commits` への `9694e2b` / `98073a7` 追記を確認した。同コミットで本 review 文書 §3.1 に上記「対応」説明が追記されている。
3. **完了処理での `done` / `implemented` 更新方針が妥当であること** — 同 procedure 手順 10-11 と Phase 3 exit 条件（`impl_status=done`、`status=implemented`）に照らし、未解決指摘 0 件を確認した後に Phase 3 完了コミットで `impl_status` を `done`、`status` を `implemented` へ更新する方針は documented lifecycle と完全に一致する。

3 点とも手順どおりで、新たな齟齬は検出しなかった。現時点の `meta.md` は `impl_status: "in_review"` であり、本 follow-up で未解決指摘 0 件を確定したため、次の Phase 3 完了コミットで `done` / `implemented` へ遷移する条件が満たされた。

**status**: 解決済み（2026-07-25 follow-up 再確認、commit `64b7b12`。lifecycle 上の正常遷移を確認）

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-021 完了条件 | 実装での対応 | 結果 |
| --- | --- | --- |
| 980px を超える pane で本文が固定 980px に制限されず、pane 幅 − 左右 margin まで拡張される | `App.css:729` を `calc(100% - 48px)` へ置換、`min(980px, ...)` 除去 | ✓ 一致。1028px 超で本文が 980px を超えて拡張する |
| 狭幅時も本文が pane からはみ出さず、既存 responsive margin が維持される | `@media (max-width: 760px)` の `calc(100% - 28px)`（`App.css:882-885`）を無変更で維持 | ✓ 一致。14px gutter 契約を保持 |
| 横長 table / Mermaid / PlantUML / image が拡張後の本文幅を利用でき、必要時に既存の横 scroll / 縮小が機能する | 子要素 CSS（`App.css:804-861`）無変更、親幅のみ拡張。`sample_docs/preview_width.md` で全種を確認可能 | ✓ 一致。fixture が table / Mermaid / PlantUML / image / long code を網羅 |
| trusted HTML iframe が pane 全幅へ追従し、HTML 文書 layout と security 境界が維持される | `.html-preview-frame`、iframe DOM、protocol / sandbox / CSP をコミットで変更せず | ✓ 一致 |
| Explorer resize、tab 切替、Markdown / HTML 切替、preview scroll に退行がない | `App.tsx` / `explorerPane.ts` / `documentPolicy.ts` / Rust 無変更、CSS layout のみに閉じる | ✓ 一致。回帰は Phase 4-a 手動確認で最終確認 |
| `npm run build`、`npm test -- --run`、`cargo check`、`cargo test` が成功する | 実装記録 §7 で全件成功。レビュー側で `npm test`(29 passed) / `cargo test`(22 passed) / `cargo fmt --check`(差分なし) を再実行し一致を確認 | ✓ 一致（レビュー側再検証済み） |
| 横長 fixture で通常幅・980px 超・狭幅・Explorer resize・Light / Dark を手動確認する | `sample_docs/preview_width.md` 追加、`development_workflow.md` へ手動確認項目追加、実装記録 §8 に Phase 4-a シナリオ | ✓ 一致（Phase 4-a で実施予定） |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| 承認済み設計 §6.1 との一致 | ✓ `width: calc(100% - 48px)` へ置換、`min(980px, ...)` 除去が設計採用案と完全一致 |
| 設計レビュー 3.1 の pane 基準 / viewport 基準の反映 | ✓ detail_design / interface_spec / development_workflow / basic_design の 4 文書で「本文幅 = pane content box 基準、gutter breakpoint = window viewport 基準、pane だけ狭くなっても gutter 非切替」を一貫記述 |
| fixture の有効性 (`sample_docs/preview_width.md`) | ✓ 11 列の wide table、`flowchart LR` の Mermaid、`left to right` の PlantUML、1.36MB architecture PNG（実在: `sample_docs/images/avalonia-markdown-viewer-architecture.png`）、単一長行の code block を含み、拡張幅利用・要素内 overflow / 縮小の双方を確認できる |
| JavaScript 計測・互換レイヤー・fallback・重複抽象化の非追加 | ✓ 非 doc 変更は `App.css` 1 行のみ。`App.tsx` / `explorerPane.ts` / `documentPolicy.ts` / Rust に state / observer / listener / 互換分岐の追加なし |
| 自動テスト非追加の妥当性と検証の組み合わせ | ✓ CSS-only の visible layout 変更で現行 Vitest は DOM / computed layout を持たず、CSS source 文字列テストはユーザー可視幅を検証しないため非追加が妥当。frontend build + 29 tests、Rust check + 22 tests + fmt、Phase 4-a 手動確認の組み合わせは CSS-only 変更に対して十分 |
| 自動検証結果の再現性 | ✓ レビュー側再実行で `npm test`(2 files / 29 passed)、`cargo test`(22 passed)、`cargo fmt -- --check`(差分なし) が実装記録 §7 の主張と一致 |
| 互換性記述 (実装記録 §6) | ✓ 1028px 以下で従来同値・超で拡張・viewport 760px 以下 responsive 無変更・state/operation contract 無変更・migration 非追加が実装差分と整合 |
| 実装記録の内容整合 | ✓ §3 設計差分表、§4 設計レビュー反映、§5 恒久ドキュメント反映表が実コミット差分と一致。§8 Phase 4-a シナリオが completion 条件の手動確認軸を網羅 |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 | ブロッキング | Round 1 結果 |
| --- | --- | --- | --- | --- |
| 低 | 3.1 `meta.md` `impl_status` の lifecycle 整合 | front matter の表記のみで実装・fixture・docs の正しさと Phase 4 検証に影響しない | 否 | 解決済み（`64b7b12`。documented lifecycle 上の正常遷移を確認） |

---

## 7. 残リスク / Phase 4 での注意点

- 本変更は CSS-only の visible layout 変更のため、自動テストで幅を直接検証できない。Phase 4-a では実装記録 §8 / `development_workflow.md` の手動確認（1028px 超拡張・広幅図表・viewport 760px 以下 14px・viewport 760px 超維持の Explorer resize で 24px 維持・HTML iframe 全幅と文書固有 layout・Light / Dark）を漏れなく実施すること。
- `sample_docs/preview_width.md` の PlantUML 図の描画には `plantuml.jar` 設定が必要。Phase 4-a の PlantUML 確認時は jar path 設定を前提とする（fixture 自体の妥当性には影響しない）。
- 改善提案 3.1 は Round 1 (`64b7b12`) で `impl_status: in_review` へ正常遷移済み。Phase 3 完了コミットで `impl_status` を `done`、`status` を `implemented` へ更新する（documented lifecycle 手順 10-11 / Phase 3 exit 条件）。

---

## 8. 結論

実装は承認済み設計 §6.1 の採用案どおり `.markdown-body` の固定 980px 上限を pane 相対の `calc(100% - 48px)` へ置き換える 1 行の CSS 変更に正しく限定され、旧 980px 経路を残さず、760px viewport breakpoint の `calc(100% - 28px)` を維持している。子要素 overflow / scaling、HTML iframe 全幅、Explorer / tab / security 境界には変更がなく、JavaScript 計測・互換レイヤー・fallback・重複抽象化のいずれも追加されていない。恒久ドキュメント 5 種は実装と一致し、設計レビュー 3.1 の「本文幅 = pane 基準 / gutter breakpoint = viewport 基準」という区別を 4 文書で一貫して反映している。`sample_docs/preview_width.md` は table / Mermaid / PlantUML / image / long code を含む広幅確認 fixture として有効で、参照画像も実在する。

自動検証はレビュー側でも再実行し、frontend 29 tests / Rust 22 tests / fmt 差分なしが実装記録の主張と一致することを確認した。CSS-only 変更に対する unit test 非追加は現行 Vitest の制約と可視幅検証の観点から妥当で、build + 既存テスト回帰 + Phase 4-a 手動確認の組み合わせで代替する方針は十分である。

TODO-2026-021 の全完了条件は実装へ追跡可能であり（第 4 節、全行 ✓）、ブロッキングとなる齟齬・不整合・ドキュメント不足は検出しなかった。初回検出の唯一の指摘は `meta.md` の `impl_status: "draft"` に関する Low の非ブロッキング表記整合（3.1）であった。

### 再確認結果 (2026-07-25 follow-up, commit `64b7b12`)

`spec-change-workflow` Phase 3 の documented lifecycle（`phase_3_impl_and_docs_review.md` 手順 6 / 9 / 10-11、Phase 3 exit 条件）と Round 1 fix (`64b7b12`) の差分を照合して再確認した。

- **3.1 (Low) — 解決済み**: (1) レビュー対象コミット `9694e2b` の `impl_status: "draft"` は手順 6 のレビュー依頼前状態に一致し、documented lifecycle 上は正常であった（初回指摘は完了済み metadata のみとの比較に基づく anomaly 判定で、進行中の中間状態には比較対象がなかった）。(2) `64b7b12` で `impl_status` が `in_review` へ正しく遷移し（手順 9）、`related_commits` 追記と本 review 文書 §3.1 への対応説明追記も確認した。(3) 未解決指摘 0 件確認後に Phase 3 完了コミットで `impl_status: done` / `status: implemented` へ更新する方針は手順 10-11・Phase 3 exit 条件と完全に一致し、妥当である。

follow-up による新たな齟齬は検出しなかった。受け入れ条件トレース（第 4 節）は全行 ✓ を維持している。

以上より本実装を **承認 (Approved)** とし、Phase 4（検証・完了）への進行を可とする。**未解決指摘は 0 件**。Phase 4 では第 7 節の注意点（CSS-only 変更の手動確認網羅、PlantUML jar 前提、Phase 3 完了コミットでの `impl_status: done` / `status: implemented` 更新）に留意すること。

---

## 9. 指摘対応 Round 1

| 指摘 | severity | 対応 | 状態 |
| --- | --- | --- | --- |
| 3.1 `meta.md` `impl_status` の lifecycle 整合 | Low（改善提案・非ブロッキング） | `64b7b12` で `impl_status` を `draft` → `in_review` へ更新（手順 9）。documented lifecycle 上、`9694e2b` の `draft` はレビュー依頼前の正常状態であり、完了処理で `done` / `implemented` へ遷移する方針を確認 | 解決済み（follow-up 再確認済み、`64b7b12`） |

Round 1 の指摘について、`spec-change-workflow` Phase 3 の documented lifecycle と `64b7b12` の差分が整合し、新たな齟齬を生じさせていないことを確認した。未解決指摘は 0 件であり、総合判定は **承認 (Approved)**。Phase 4（検証・完了）へ進行してよい。
