# TODO-2026-021 Tauri document preview 横幅の可変化 設計レビュー

**レビュー日**: 2026-07-25
**対象ドキュメント**: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/design/tauri_document_preview_responsive_width_design.md`
**対象 meta**: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-021
**初回レビュー対象コミット**: `3942be4` (docs: design responsive Tauri preview width)
**判定**: **承認 (Approved)**。Phase 3 進行可。ブロッキング指摘 (High / Medium) 0 件。改善提案 (Low) 1 件は非ブロッキングで、Phase 3 の恒久ドキュメント更新に折り込めば足りる。

---

## 概要

TODO-2026-021 (Tauri document preview 横幅の可変化) の Phase 2 設計レビュー。`.markdown-body` の固定 `min(980px, calc(100% - 48px))` 上限を廃止して preview pane 相対の `calc(100% - 48px)` を唯一の幅基準へ置き換える設計を、現行実ソース (`markdown-viewer-tauri/src/App.css`)、既存 HTML fixture (`sample_docs/html_fixture/assets/style.css`)、workspace / preview layout、恒久ドキュメント (`docs/components/tauri_viewer/*`) を根拠に検証した。

検証の結果、設計が引用する現行契約はすべて実ソースと一致していた。

- 現行 `.markdown-body` は `width: min(980px, calc(100% - 48px))`（`App.css:728-735`）で、design §1 / §5 / §6.1 の Before 記述と一致する。
- `@media (max-width: 760px)` 下の `width: calc(100% - 28px)`（`App.css:877-885`）が既存の狭幅 gutter として実在し、design が「維持」とする対象と一致する。
- `.html-preview-frame { width: 100%; height: 100%; border: 0 }`（`App.css:720-726`）は既に全幅であり、design §6.3 の「変更しない」判断と一致する。
- table / pre / mermaid / plantuml の `overflow-x: auto`、img / plantuml svg の `max-width: 100%`（`App.css:804-861`）は design §6.2 の維持対象と一致する。
- `.markdown-body` の containing block である `.preview-pane` は `overflow: auto`（`App.css:711-714`）で、`.workspace` grid の `minmax(0, 1fr)` 列（`App.css:464-467`）配下にあり、`calc(100%)` が pane content box を基準にする前提は成立する。
- design §6.3 / §17 が「HTML 文書自身の layout」と分離する `max-width: 900px` は `sample_docs/html_fixture/assets/style.css:8` に実在し、Viewer viewport とは別契約という記述は妥当。

1028px 境界の算術（`min(980px, 100% - 48px)` は `100% = 1028px` で 980px と一致し、以下では従来と同値・超では 980px 固定を選ぶ）も正しく、design §10 の「1028px 以下は従来同値、超で拡張」という互換記述は数式レベルで整合する。採用案 / 不採用案（JavaScript 計測、互換レイヤー、fallback、設定化の各不採用）は要求範囲と一致しており、CSS-only・手動 fixture・自動テスト非追加の方針も現行 Vitest が DOM / computed layout を持たない事実と整合する。

検出した唯一の指摘は、狭幅 gutter (28px) の切替が実際には **viewport 幅**の media query に紐づく一方、幅基準 (`100%`) は **preview pane** の content box であるという意味差が、設計文と Phase 3 で更新する恒久ドキュメントで曖昧になり得る点（Low, 改善提案）である。挙動そのものは既存かつ非対象範囲で、本変更が壊すものではない。

---

## 1. 齟齬・不整合

ブロッキングとなる齟齬・不整合は検出しなかった。設計が引用する現行 CSS 契約・fixture・layout はいずれも実ソースと一致し、1028px 境界・互換記述・採用/不採用判断に矛盾はない。

---

## 2. ドキュメント不足

なし。恒久ドキュメント更新予定 (design §14: README / basic_design / detail_design / interface_spec / development_workflow.md) は妥当。現行 `detail_design.md` の UI レイアウト節（`detail_design.md:453`）や `interface_spec.md` には `.markdown-body` の幅契約が未記載であり、今回追記する「pane 相対の可変幅」は既存記述の書き換えではなく純粋な追補になるため、更新による旧記述との矛盾は生じない。ADR 非追加の判断（design §14 末尾: 「Tauri Viewer 局所の CSS layout 契約であり横断判断ではない」）は、`docs/adr/README.md` に preview 幅 / layout 責務境界を扱う既存 ADR がないことと矛盾しない。

---

## 3. 改善提案

### 3.1 狭幅 gutter (28px) が pane 幅ではなく viewport 幅で切り替わる意味差を、恒久ドキュメントで明示する

**ドキュメント記載**: 「狭幅でもpaneからはみ出さない → 通常48px、760px以下28pxの既存inline gutterを維持する」(design §3 完了条件表)。「760px以下のMarkdown本文 … 変更なし」(design §5)。ユーザー確認シナリオ5「windowを760px以下へ狭め、本文が左右14pxを残してpane内へ収まる」(design §16-5)。

**差異**: 現行実装では狭幅 gutter は `@media (max-width: 760px)`（`App.css:877`）＝ **window / viewport 幅**の条件で切り替わる。一方、`.markdown-body` の幅基準 `calc(100% - 48px)` の `100%` は containing block である `.preview-pane` の content box、すなわち **preview pane 幅**である。両者の基準が異なるため、次のケースが生じる。

- viewport が 760px 超だが Explorer separator を大きく広げて preview pane が狭い（例: pane 幅 400px）場合、media query は発火せず gutter は 48px のまま維持される（28px にはならない）。
- 逆に split view（TODO-2026-006）で 1 pane が狭くても、window 全体が 760px 超なら各 pane の gutter は 48px のままになる。

design §16-5 は window 幅で狭幅を説明しているため実挙動と一致しており、この意味差自体は既存挙動で、本変更が新たに壊すものではない（Explorer resize 時の gutter 変更は design §4.2 で非対象）。したがって**設計判断としては妥当**である。ただし design §3 の完了条件表・§9.1 UI 契約は gutter を「狭幅時」という pane 幅を連想させる語で記述しており、Phase 3 で `detail_design.md` の UI レイアウト節へ幅契約を追記する際に、gutter の 48px→28px 切替が **pane 幅ではなく viewport 幅の 760px breakpoint に紐づく**ことを一文で明示しないと、恒久ドキュメントが「pane が狭ければ gutter が縮む」という誤読を許す恐れがある。これは prompt のレビュー観点「760px breakpoint・Explorer resize・将来 split view での pane 相対幅に見落としがないか」に対応する。

**推奨対応**: design §9.1（または恒久ドキュメント更新時の `detail_design.md`）へ「本文幅は preview pane content box 相対（`calc(100% - 48px)`）だが、左右 gutter を 24px→14px へ縮める breakpoint は viewport 幅 760px を基準とする既存 media query であり、Explorer resize や split view による pane 幅の増減では gutter 幅は切り替わらない」旨を明記する。design §16 の手動シナリオ 6（Explorer resize）に「resize 中も gutter 幅は 24px のまま（pane 幅では切り替わらない）」ことを観察項目として一言添えると、Phase 4 での期待値ずれを防げる。

**severity**: Low（挙動は既存かつ非対象で機能要求は満たされる。恒久ドキュメントの精度と Phase 4 期待値の明確化に限られ、Phase 3 実装をブロックしない）

**工程**: Phase 3（恒久ドキュメント更新時に明記）

**status**: addressed（reviewer follow-up確認待ち）

**対応**: 設計書§3の完了条件を「window viewportが760px以下」と明確化し、§9.1へ本文widthの基準はpreview pane content box、gutter切替の基準はwindow viewportであり、Explorer resizeや将来のsplit viewによる個別pane幅の変化ではgutterを切り替えないことを追記した。§16-6にも、window viewportを760px超に保ったExplorer resizeでは左右gutterが24pxのまま維持される確認観点を追加した。Phase 3では同じ契約を`detail_design.md`を含む恒久ドキュメントへ反映する。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-021 完了条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| 980px を超える pane で本文が固定 980px に制限されず、pane 幅から左右 margin を引いた幅まで拡張される | §3 表、§5、§6.1（`min(980px, ...)` 撤去→`calc(100% - 48px)`）、§10（1028px 境界） | ✓ 整合。1028px 境界の算術が正しく、超過幅で 980px 固定を除去する |
| 狭幅時も本文が pane からはみ出さず、既存 responsive margin が維持される | §3 表、§5、§6.1（48px / 28px gutter 維持）、§11（境界条件） | ✓ 整合。改善提案 3.1 の意味差は挙動を変えず、非対象範囲内 |
| 横長 table / Mermaid / PlantUML / image が拡張後の本文幅を利用でき、必要時に既存の横 scroll / 縮小が機能する | §6.2、§13、§16-3/4、§17（risk 対応） | ✓ 整合。親幅拡張のみで子要素の `overflow-x` / `max-width` 契約を保持する |
| trusted HTML iframe が pane 全幅へ追従し、HTML 文書自身の layout と security 境界が維持される | §6.3、§9.2、§10（互換レイヤー非追加）、§17 | ✓ 整合。`.html-preview-frame` 現行契約と fixture `max-width: 900px` 分離が実ソースと一致 |
| Explorer resize、tab 切替、Markdown / HTML 切替、preview scroll に退行がない | §4.2（非対象）、§8（依存方向）、§16-6/7/8 | ✓ 整合。React state / observer / listener 非追加で CSS layout のみに閉じる |
| `npm run build`、`npm test -- --run`、`cargo check`、`cargo test` が成功する | §15（検証コマンド一式） | ✓ 整合。`cargo fmt -- --check` も追加され回帰確認範囲が広い |
| 横長 fixture で通常幅・980px 超・狭幅・Explorer resize・Light / Dark を手動確認する | §4.1（sample_docs fixture 追加）、§16-1〜8 | ✓ 整合。手動シナリオが全確認軸を網羅する |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| Before 記述と現行 `App.css` の一致 (§1, §5) | ✓ 整合。`width: min(980px, calc(100% - 48px))`（`App.css:729`）、狭幅 `calc(100% - 28px)`（`App.css:883`）が実在 |
| 1028px 境界の算術と互換記述 (§10) | ✓ 整合。`100% - 48px = 980px ⇔ 100% = 1028px`。以下は従来同値、超で 980px 固定を選ぶという記述が数式レベルで正しい |
| box model の妥当性 (§6.1) | ✓ 整合。global `box-sizing: border-box` と左右 padding 0（`padding: 32px 0 56px`）により border box = `calc(100% - 48px)` が pane content box 内へ収まり、`margin: 0 auto` が残余を等分する |
| containing block 前提 (§6.1, §8) | ✓ 整合。`.markdown-body` の親 `.preview-pane` が `overflow: auto`（`App.css:711`）で `.workspace` の `minmax(0, 1fr)` 列（`App.css:467`）配下にあり、縦 scrollbar 出現時も `100%` が縮小 content box を基準にするため overflow を招かない |
| Markdown 子要素 overflow / scaling の維持 (§6.2) | ✓ 整合。table `display:block; width:100%; overflow-x:auto`、pre / mermaid / plantuml `overflow-x:auto`、img / svg `max-width:100%`（`App.css:804-861`）を変更せず親幅のみ拡張する |
| HTML iframe 全幅契約と文書 layout の分離 (§6.3, §17) | ✓ 整合。`.html-preview-frame { width:100% }`（`App.css:722`）維持と fixture `max-width: 900px`（`style.css:8`）非撤去の別契約化が実ソースと一致 |
| JavaScript 計測・互換レイヤー・fallback・過剰抽象化の非導入 (§7, §11, §12) | ✓ 整合。CSS 包含 block 計算で幅が決まるため state / `ResizeObserver` / window listener / 共通 utility を追加しない判断は妥当。Explorer 幅（stateful policy）と gutter（静的 layout）を共通化しない責務分離も適切 |
| 自動テスト非追加の妥当性 (§15) | ✓ 整合。現行 Vitest は DOM / computed style を提供せず、CSS source 文字列テストは実装詳細依存でユーザー可視幅を検証しないため非追加。`npm run build` による CSS parse 検証と手動 fixture で代替する方針は CSS-only 変更に対して妥当 |
| 将来 split view との責務境界 (§17) | ✓ 整合。pane 相対 CSS のため各 pane 包含 block へ追従し、split view 固有の minimum width は TODO-2026-006 で扱うという非対象判断が todo と整合（gutter の viewport 基準は改善提案 3.1 で明確化を推奨） |
| ADR 要否判断 (§14 末尾) | ✓ 整合。`docs/adr/README.md` に preview 幅 / layout 責務境界の既存 ADR はなく、横断判断でないという根拠と矛盾しない |
| 恒久ドキュメント更新先の網羅性 (§13, §14) | ✓ 整合。README / basic_design / detail_design / interface_spec / development_workflow.md への追記先が妥当で、現行 docs に旧 980px 記述がなく矛盾を生じない |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 | ブロッキング |
| --- | --- | --- | --- |
| 低 | 3.1 狭幅 gutter が pane 幅でなく viewport 幅で切替わる意味差の明記 | 挙動は既存・非対象で機能要求は満たすが、恒久ドキュメントの精度と Phase 4 期待値の明確化に有用 | 否 |

---

## 7. 残リスク / Phase 3・Phase 4 での注意点

- 改善提案 3.1 の gutter breakpoint（viewport 760px）と幅基準（pane content box）の意味差は、Phase 3 の `detail_design.md` 追記で明示し、Phase 4 手動シナリオ 6 で「Explorer resize 中も gutter 幅は変わらない」ことを観察する。
- design §4.1 は「横長 table と diagram の目視確認に必要な Markdown fixture を追加する」とするが、fixture ファイル名・格納先は未指定。Phase 3 で `sample_docs/` の既存命名規約に沿って具体化し、§16 の手動シナリオ 1〜4 が参照できる状態にする（設計段階では詳細度として妥当なため指摘化しない）。
- CSS-only 変更のため自動テストで幅を直接検証できない。§15 の build / Vitest / cargo 一式に加え、§16 の通常幅・1028px 超・狭幅・Explorer resize・Light / Dark を Phase 4 で漏れなく手動確認する。

---

## 8. 結論

設計は `.markdown-body` の固定 980px 上限を pane 相対の `calc(100% - 48px)` へ置き換えるという単一の CSS 変更に範囲を正しく限定し、Before / After・1028px 境界・互換記述・採用/不採用判断・子要素 overflow 契約の維持・HTML iframe と文書 layout の分離・CSS-only の自動テスト非追加方針を、いずれも現行実ソースと一致する根拠に基づいて整理している。JavaScript 計測・互換レイヤー・fallback・過剰抽象化を導入しない判断も要求範囲と包含 block 計算の性質に照らして妥当である。

TODO-2026-021 の全完了条件は設計へ追跡可能であり（第 4 節、全行 ✓）、ブロッキングとなる齟齬・不整合・ドキュメント不足は検出しなかった。唯一の指摘は、狭幅 gutter が viewport 幅 760px の media query で切り替わる一方で幅基準が preview pane content box であるという意味差を恒久ドキュメントで明示すべきという Low の改善提案（3.1）であり、挙動そのものは既存かつ非対象範囲で本変更が壊すものではないため、Phase 3 の docs 更新に折り込めば足り、Phase 3 実装をブロックしない。

以上より本設計を **承認 (Approved)** とし、Phase 3（実装・docs 反映）への進行を可とする。ブロッキング未解決指摘は 0 件。Phase 3 では改善提案 3.1 と第 7 節の注意点に留意すること。
