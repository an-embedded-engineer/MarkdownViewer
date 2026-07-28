# TODO-2026-023 Tauri pane-local tab group / pane 間移動 実装・恒久ドキュメントレビュー

**レビュー日**: 2026-07-28
**再確認日**: 2026-07-28
**対象ドキュメント**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/impl/tauri_pane_local_tab_groups_feature_impl.md`
**対象設計書**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/design/tauri_pane_local_tab_groups_feature_design.md`（承認済み `8ecbe5a`）
**対象設計レビュー**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/review/tauri_pane_local_tab_groups_design_review.md`（承認、検出 13 件すべて解決済み・未解決 0 件）
**対象 meta**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-023（統合済み TODO-2026-024 を含む）
**初回レビュー対象コミット**: `13c87a3` (Phase 3 implement Tauri pane-local tab groups)
**Round 1 fix コミット**: `83e0ce8` (Phase 3 address pane-local tab groups implementation review)
**判定**: **承認 (Approved)**。Phase 4（ユーザ検証・完了処理）へ進行可。**blocking 指摘 0 件**。初回検出の **Medium 1 件 / Low 2 件 = 全 3 件は Round 1 fix (`83e0ce8`) ですべて解決済み**と再確認した。**未解決指摘 0 件。** 再確認で新規指摘は検出しなかった。

---

## 概要

TODO-2026-023 Phase 3 の実装・恒久ドキュメントレビュー。`13c87a3` の差分（frontend 4 ファイル、恒久 docs 12 ファイル、実装記録・meta）と更新後ファイル全体を、承認済み設計書 §6〜§18、承認済み設計レビューの指摘 13 件、`docs/todo/todo.md` TODO-2026-023 の受け入れ条件、`ai-review-response-workflow` の review checkpoints に照らして検証した。自動検証は本レビューでも全コマンドを再実行して再現している。

実装の骨格は設計どおりである。

- `splitView.ts` が `PaneState.orderedTabIds` を持つ新 schema へ**一括置換**され、旧 `remove-tab` action と旧 `PaneState` 解釈は完全に除去されている（`grep` で `remove-tab` / `fallbackTabId` / `orderedTabIds` payload の残存なし）。互換経路を残さない §13 の単一路線化が守られている。
- `reduceSplitView` は入力 state と出力 state の**両方**を `assertSplitViewState` で検証する（`splitView.ts:73`, `:210`）。invariant 1（duplicate ID）、2（active membership）、3（pending = active）、7（single ⇒ active primary）、8（nonempty ⇒ active non-null）がすべて実行時に強制され、reducer を経由する限り破れた state は生成も受理もされない。
- `resolveGroupTabs<T extends { id: string }>` が `splitView.ts:218-231` に generic として置かれ、`OpenDocumentTab` 具体型に依存しない。App は `useMemo` から primary / secondary をそれぞれ 1 回だけ解決し（`App.tsx:197-205`）、`DocumentPane` は解決済み view を受けるだけで再解決しない。missing ID の throw は App integration boundary に限定されている。
- `setPanePreviewStatus` の呼び出しは**定義を除き 2 箇所だけ**（`App.tsx:336` の `updatePanePreviewPhase` 経由の設定と `App.tsx:1185` の generic stale effect による clear）。設計 §9.1 / §14 が Phase 3 完了条件として掲げた「2 経路への限定」が算術的に達成されている。
- security 境界は不変である。`documentPolicy.ts`、`imageViewer.ts`、`paneRuntime.ts`、`src-tauri/`、Tauri config / capabilities のいずれにも差分が無い（`13c87a3` の変更ファイル一覧で確認）。Mermaid の `securityLevel: "strict"` と `paneId + tabId + revision + index` の render ID、iframe key `paneId + tabId + revision`、`sandbox="allow-scripts"`、`event.source` 照合と pane-local duplicate guard はいずれもそのまま維持されている。
- 承認済み設計レビューで確定した 13 件の契約（pending 規則、初期化 signature、split payload 削除、private adjacent helper、置換対象 docs、runtime status 一本化、hidden secondary 回復導線、invariant 8 と旧 roving fallback 削除、single+secondary throw、generic resolver 境界、image viewer、Reload、split tab 幅、ADR 再評価）は**すべて実装またはドキュメントへ落ちている**（§5 のトレース表を参照）。

テストは旧仕様を緩めたものではない。`splitView.test.ts` は共通 fixture `stateWithPaneTabs` を導入した上で、旧仕様 test（secondary 隣接自動選択、active secondary → primary 引き継ぎ、global `remove-tab`、group 未登録 ID の `select-tab`）を**削除**し、新 contract の境界値と失敗系を直接検証する 14 test へ置換している。`paneRuntime.test.ts` も引数付き初期 state 前提を group membership 前提へ書き換えた上で、move 前後の source / destination 判定、single 中の retained secondary 拒否、再 split 後の revision guard、同一 document 両 group の error 分離を追加している。width / ratio / keyboard の既存 policy test は意味を変えずそのまま残っている（設計 §16.1 の移行方針どおり）。

初回レビューで検出した 3 件はいずれも非ブロッキングであった。恒久 docs に承認済み設計 §15 の置換対象が 1 行残っていること（指摘 2.1）、設計 §15 の対象外だった Avalonia rollout spec に Tauri で廃止した split 継承規則が `common` baseline として残っていること（指摘 2.2）、`loadRoot` の global tabs / group 更新順が `closeTab` と逆で invariant 4 の維持を React の batching に依存していること（指摘 3.1）である。

Round 1 fix (`83e0ce8`) では、(1) `interface_spec.md` の当該行を「表示単位 = pane group の tab」「一意性 = global path」へ粒度を分けて書き換え、(2) Avalonia rollout spec へ baseline / 現行 Tauri semantics / 再評価条件の 3 点を注記し、(3) `loadRoot` の 2 行を入れ替えて全中間状態で `group ⊆ global tabs` を成立させ、併せて `common_pitfalls.md` へ順序規則を、実装記録へ対応内容を同期した、という形で 3 件とも推奨対応どおり解決されている。

再確認の結果、対応による新たな齟齬・退行・契約逸脱は検出しなかった。自動検証 6 コマンドを再実行し、すべて Round 1 fix 前と同じ結果（5 files / 77 tests、build 成功、`cargo` 3 種成功、`git diff --check` 成功）であることを確認している。

---

## 1. 齟齬・不整合

**blocking 指摘は無い。** 承認済み設計の状態モデル、action 契約、App integration、runtime guard、security 境界、accessibility 契約はいずれも実装と一致しており、設計に無い挙動の追加も、設計が要求した挙動の欠落も検出しなかった。

実装が設計より**厳格**になっている箇所が 1 点あるが、いずれも設計の意図（programming error を throw で顕在化する）と同方向であり、齟齬としない。

- 設計 §7 は `close-pane-tab` の nonmember を明示的に throw 対象と書いているが、実装は `select-tab` / `close-pane-tab` / `move-tab` の 3 箇所で共通 `assertPaneMember` を使い、エラーメッセージへ pane 名を含めている（`splitView.ts:248-252`）。
- 設計 §6.2 は invariant 8 を「nonempty ⇒ active non-null」とだけ定義するが、実装は逆向きの「empty ⇒ active null」も検証する（`splitView.ts:266-268`）。invariant 2 の系であり矛盾しない。

---

## 2. ドキュメント不足

### 2.1 `interface_spec.md` の TabStrip 節に旧 global 表示の記述が 1 行残っている

**severity**: Medium
**blocking**: **non-blocking**
**工程**: Phase 3（恒久ドキュメント修正）
**status**: **解決済み**（2026-07-28 再確認、commit `83e0ce8`）

**対応**: `interface_spec.md:55` を、表示単位（pane group に属する tab）と data 一意性（global の path 一意）へ粒度を分けた記述へ置換した。

**根拠**: 承認済み設計 §15 は `docs/components/tauri_viewer/interface_spec.md` について「`## TabStrip 表示`の同一global collection / global open順をpane-local所属・挿入順へ**節単位で書換え**」と定めている。また承認済み設計レビュー指摘 1.3 は、置換が必要な確定記述として同節の 2 文を名指ししていた。

`13c87a3` では「single / splitの各paneに同じglobal tab collectionを表示する。」は削除され、「各TabStripは自paneの`orderedTabIds`に属するtabだけをlocal挿入順で表示する。」へ置換されている。しかしもう一方の

```
docs/components/tauri_viewer/interface_spec.md:55
- 同一root内でopenしたMarkdown / HTMLをopen順に表示する。同一pathのtabは重複作成しない。
```

が**同じ箇条書きの先頭に旧文のまま残っている**。結果として同節が次の 2 つを並記している。

- 55 行目: 「同一 root 内で open した Markdown / HTML を open 順に表示する」＝ root 内で開いた文書がすべて、global な open 順で並ぶ読み方が成立する。
- 58 行目: 「各 TabStrip は自 pane の `orderedTabIds` に属する tab だけを local 挿入順で表示する」＝ pane 所属と pane-local 順。

本機能で偽になったのは前者である。TabStrip はもはや「root 内で open した文書」ではなく「その pane group に属する tab」を表示する。また「同一pathのtabは重複作成しない」も、global document data については真だが、tab（表示単位）は両 group に現れうるため、pane-local group を説明する節の文としては誤解を招く。review checkpoint 5「要求されていない旧経路（記述）を残していないか」および checkpoint 7 に該当する。

なお Phase 4-a の合否基準である `docs/rules/development_workflow.md:174-178` は正しく置換済みであり（旧 split toggle / close の manual 基準は残っていない）、本指摘はユーザ検証を妨げない。

**推奨対応**: `interface_spec.md:55` を削除するか、pane-local 契約へ書き換える。例:

```markdown
- 各TabStripは自paneのgroupに属するtabだけを表示する。global document dataはroot内でpath一意であり、同一pathのdocumentを重複作成しない。
```

置換後、同節が「表示単位は pane group の tab」「data の一意性は path」という 2 つの粒度を混同しないことを確認する。

**確認 (`83e0ce8`)**: 推奨とほぼ同文へ置換され、粒度の混同が解消された。

- 55 行目が「各TabStripは自paneのgroupに属するMarkdown / HTMLだけを表示する。global document dataはroot内でpath一意とし、同一pathのdocumentを重複作成しない。」へ書き換わった。表示単位（pane group）と一意性の対象（global document data の path）が別の主語として書き分けられており、「root 内で open した文書がすべて global な open 順で並ぶ」と読める余地は無くなった。
- 同節 58 行目「各TabStripは自paneの`orderedTabIds`に属するtabだけをlocal挿入順で表示する。ArrowLeft / ArrowRight / Home / Endもlocal順へ適用する。」との関係も確認した。55 行目が「何を表示するか + data 一意性」、58 行目が「どの順で並べ、keyboard がどの順に従うか」を扱っており、記述の重なりはあるが矛盾は無い。
- 恒久 docs 全体を再 grep し、`open順に表示` / `同じglobal tab collection` / `global tabを両pane` のいずれも `design_analysis/` 配下の履歴文書を除いて残存しないことを確認した。**設計 §15 の置換対象は全件反映済みである。**

### 2.2 Avalonia rollout spec が Tauri で廃止した split off / on 継承規則を `common` baseline として残している

**severity**: Low
**blocking**: **non-blocking**
**工程**: Phase 3（恒久ドキュメント追記）
**status**: **解決済み**（2026-07-28 再確認、commit `83e0ce8`）

**対応**: rollout spec の `Split View baseline` 節へ、当該規則が TODO-2026-006 baseline であること、Tauri では TODO-2026-023 で置換済みであること、Avalonia へ採用する semantics は TODO-2026-011 / TODO-2026-012 で確定することを 1 行で注記した。実装記録 §5 の docs 反映一覧へも同ファイルを追加した。

**根拠**: `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md` は「現在のAvalonia実装を説明する文書ではなく、`TODO-2026-008`から`TODO-2026-012`で段階導入する **target contract**」と定義されている。その `Split View baseline` 節に次が残っている。

```
docs/components/avalonia_viewer/tauri_ux_rollout_spec.md:70
- split on時はprimaryを維持し、可能なら隣接する別tabをsecondaryへ選ぶ。候補がなければsecondaryの未選択を正当なstateとする。
docs/components/avalonia_viewer/tauri_ux_rollout_spec.md:71
- split off時は選択済みactive paneをprimaryへ引き継ぐ。active paneが未選択なら既存primaryを維持し、両pane未選択かつtabが残る時だけ先頭tabへfallbackする。
```

これは TODO-2026-006 で確定し、本変更（設計 §2.3「明示的な互換性変更」）で Tauri から**削除された**規則である。同ファイル 31 行目の `Split View baseline` 行は反映区分を `common`（＝「利用者が観測する操作、状態遷移、security / accessibility outcome を合わせる」）としているため、この 2 行をそのまま実装すると、Avalonia だけが Tauri に存在しない状態遷移を持つことになり、`common` の定義と矛盾する。

同ファイル 32 行目に「pane-local tab group / pane間移動 | `follow-up` | TODO-2026-023へ統合して追跡 | Avalonia baselineをブロックしない。TODO-2026-012で採否を再評価する」があるため、Avalonia が当面 TODO-2026-006 baseline を目標にすること自体は文書内で一貫している。問題は、**その baseline が Tauri 側で置き換わった事実がどこにも記録されていない**点である。TODO-2026-011（Avalonia Split view）の実装者は、参照元が既に変更されたことを知らずに旧規則を実装しうる。

本ファイルは承認済み設計 §15 の置換対象一覧に含まれていないため、実装担当の逸脱ではなく設計時点のスコープ漏れである。ただし review checkpoint 7「関連コンポーネント文書へ反映済みか」に該当するため記録する。

**推奨対応**: 70-71 行目に、Tauri 側の現行仕様との関係を 1 行で注記する。例:

```markdown
- （注）この split on / off 規則は TODO-2026-006 baseline である。Tauri では TODO-2026-023 の pane-local tab group 導入により、両groupの所属・順序・選択を保持する仕様へ置換済み。TODO-2026-011 / TODO-2026-012 でどちらの semantics を Avalonia baseline とするかを確定する。
```

32 行目の `follow-up` 行へ「Tauri は TODO-2026-023 で採用済み」を追記して、再評価の起点を明確にしてもよい。

**確認 (`83e0ce8`)**: 推奨した 3 要素がすべて 1 行に収まる形で追記された。

- 72 行目へ「上記split on / off規則はTODO-2026-006のbaselineである。TauriではTODO-2026-023で両groupの所属・順序・選択を保持するpane-local tab group仕様へ置換済みであり、TODO-2026-011 / TODO-2026-012でAvaloniaへ採用するsemanticsを確定する。」が入った。(a) baseline の出自、(b) Tauri 側が置換済みである事実、(c) 再評価の担当 TODO、の 3 点が揃っており、TODO-2026-011 の実装者が参照元の変更に気付かないまま旧規則を実装する経路は塞がれた。
- 注記を 70-71 行の直後に置き、元の baseline 記述自体は残す構成になっている。rollout spec が「target contract であって現行実装の説明ではない」という同ファイル冒頭の位置づけと整合し、TODO-2026-011 が baseline を選ぶ判断材料として両方の semantics が読める。`common` 区分（31 行目）との矛盾も、再評価前提であることが明示されたため解消している。
- 実装記録 §5 へ「`docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`: TODO-2026-006 baselineとTauri現行pane-local semanticsの差、およびAvalonia導入時の再評価条件を注記」が追加され、恒久 docs 反映一覧と実ファイルが一致した。`meta.md` の `components` にも同ファイルが追加されている。

---

## 3. 改善提案

### 3.1 `loadRoot` の global tabs / group 更新順が `closeTab` と逆で、invariant 4 の維持を batching に依存している

**severity**: Low
**blocking**: **non-blocking**
**工程**: Phase 3（2 行の入れ替え）
**status**: **解決済み**（2026-07-28 再確認、commit `83e0ce8`）

**対応**: `loadRoot` の 2 行を入れ替えて `reset-root` を先行させ、`common_pitfalls.md` へ順序規則を、実装記録へ対応内容を同期した。

**根拠**: 実装は invariant 4（各 ordered ID は global `OpenDocumentTab[]` に実在する）を silent filter ではなく throw で守る設計（§4.5 / §9.2）を採っており、`resolveGroupTabs` は App の `useMemo`、すなわち **render path** で評価される（`App.tsx:197-205`）。したがって「group が global tabs に無い ID を持つ状態で render が走る」ことは、表示崩れではなく**復帰不能な throw** になる。

group と global tabs を同時に変更する 3 経路のうち、2 経路は「どの中間時点でも group ⊆ tabs」が成り立つ安全な順序を採っている。

- `closeTab`（`App.tsx:772-778`）: 先に `close-pane-tab` で group を縮め、その後 `updateTabs` で global data を削除する。group が先に縮むため中間状態も安全。
- `openOrActivateTab`（`App.tsx:675-676`）: 先に `updateTabs` で global data を足し、その後 `open-tab` で group へ足す。tabs が先に増えるため中間状態も安全。

一方 `loadRoot` だけが逆順である。

```ts
// App.tsx:471-472
updateTabs(() => []);            // global tabs を先に空にする
applySplitView({ type: "reset-root" }); // group はこの後で空になる
```

この 2 行の間だけ「group は旧 root の ID を保持しているのに global tabs は空」という invariant 4 違反の中間状態が存在する。現在は React 19 の自動 batching により両 `setState` が同一 commit へ入るため render は挟まらず、**実際には throw しない**（本レビューで `npm test` / `npm run build` および全経路の追跡により確認済み）。ただし安全性が完全に batching の保証へ依存しており、同じファイル内の他 2 経路が採っている「順序自体で安全」という性質を持たない。

承認済み設計 §8.6 は「scan成功後だけglobal tabsをemptyにし、`reset-root`で両groupをclearする」と述べているが、これは commit point（scan 成功後）を定めた文であって 2 文の実行順を規定したものではないため、入れ替えても設計違反にはならない。

**推奨対応**: 2 行を入れ替え、`closeTab` と同じ「group を先に縮める」順序へ揃える。

```ts
applySplitView({ type: "reset-root" });
updateTabs(() => []);
```

これにより invariant 4 は batching の有無にかかわらず全中間時点で成立し、3 経路の順序規則が「group ⊆ tabs を常に保つ」で統一される。併せて `docs/architecture/common_pitfalls.md` の `## 11. pane-local tab group` へ「global tabs と group を同時に変える時は、常に group ⊆ tabs が成り立つ順序で更新する」を 1 行加えると、resolver が throw する設計意図と対で残る。

**確認 (`83e0ce8`)**: 推奨どおり 2 行が入れ替わり、docs も同期された。

- `App.tsx:471-472` が `applySplitView({ type: "reset-root" });` → `updateTabs(() => []);` の順になった。中間状態を追跡すると、(1) `reset-root` 適用後は group = ∅、tabs = 旧 tabs（∅ ⊆ 旧 tabs で成立）、(2) `updateTabs(() => [])` 適用後は group = ∅、tabs = ∅（成立）、(3) 続く `openOrActivateTab` は `updateTabs`（tabs = [t]、group = ∅）→ `open-tab`（group = [t]）の順で、いずれも成立する。**全中間状態で `group ⊆ global tabs` が保たれ、React の batching に依存しない。**
- 挙動は不変である。`reduceSplitView` は `tabsRef` を参照せず、2 行の間に両者を同時に読む処理も無いため、入れ替えによる副作用は生じない。設計 §8.6 の「scan 成功後だけ」という commit point も維持されている（`scan_directory` の `await` 成功後に実行）。`npm test` 77 tests と `npm run build` の成功も再確認した。
- `docs/architecture/common_pitfalls.md` の `## 11. pane-local tab group` へ「global tabsとgroupを同時に更新する時は、すべての中間状態で`group ⊆ global tabs`が成立する順序を選ぶ。openはglobal data追加を先行し、close / root resetはgroup縮小を先行する。」が追加された。3 経路それぞれの正しい順序まで書かれており、`resolveGroupTabs` が missing ID を throw する（同節の次項）という設計意図と対で残る。
- 実装記録へ §7「実装レビュー対応」が新設され、3 件の対応内容と「対応後も仕様差分はなく、root scan 成功後の commit point と既存の表示挙動を維持する」旨が記録された（旧 §7 既知制約は §8 へ繰り下げ、本文中に旧番号への参照は無いことを確認済み）。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-023 完了条件 | 実装 | 結果 |
| --- | --- | --- |
| 各 pane の TabStrip にはその pane で開いた tab だけが表示され、他 pane の tab 追加・close で意図せず増減しない | `resolveGroupTabs` による pane view 解決（`App.tsx:197-205`）、`DocumentPane` / `TabStrip` へ解決済み view を伝搬（`App.tsx:1286`, `:1346`）、`close-pane-tab` が source group だけを更新（`splitView.ts:128-144`） | ✓ 整合。test「keeps source selection, pending navigation, and the other group on non-active close」が他 group の参照同一性まで検証 |
| tab activate / close、Reload、relative link、root 変更、split on / off で pane-local tab collection と active tab が一貫して復旧する | 10 action すべてに membership / selection / pending 規則を実装し、入出力両方で `assertSplitViewState`（`splitView.ts:73`, `:210`, `:254-282`） | ✓ 整合。invariant 1 / 2 / 3 / 7 / 8 が実行時強制され、test 13 が 5 種の不正 state 拒否を検証 |
| Markdown / HTML / Mermaid / PlantUML の非同期結果と loading / error 表示が pane 間で混線しない | `paneRuntime.ts` 無変更、`setPanePreviewStatus` を設定 1 / clear 1 の 2 経路へ限定（`App.tsx:336`, `:1185`）、render ID / iframe key 不変 | ✓ 整合。`paneRuntime.test.ts` が move 前後の source 拒否・destination 受理、single 中 retained secondary 拒否、同一 document 両 group の error 分離を検証 |
| 移動元は隣接 tab または未選択へ復旧し、移動先では対象 tab が選択される | `move-tab` が変更前順序基準の右→左→null fallback と destination dedupe add / select を 1 action で確定（`splitView.ts:145-180`） | ✓ 整合。active / non-active / last source / destination 既存の 4 パターンを test で検証 |
| keyboard だけでも移動操作へ到達でき、focus と accessible name / state が維持される | move / close の `tabIndex={isActive ? 0 : -1}`、roving は local 順（`App.tsx:2468-2488`）、`Move <name> to <pane> pane` / `Close <name> in <pane> pane`、move 後 rAF で destination tab へ focus（`App.tsx:789-802`） | ✓ 整合。実機 focus / 支援技術は Phase 4-a で確認 |
| `npm test`、`npm run build`、`cargo check` が成功する | 本レビューで再実行（§7） | ✓ 整合 |
| frontend policy test で pane 別の追加・activate・close、同一 document の両 group 参照、pane 間移動、split off / on、root reset、stale async result 拒否を検証できる | `splitView.test.ts` 14 test + `paneRuntime.test.ts` 8 test。合計 5 files / 77 tests | ✓ 整合。設計 §16.2 / §16.3 の列挙項目をすべて充足（§6 参照） |
| 手動確認で Explorer / relative link から active pane へ tab が追加され、左右の TabStrip が独立して増減・選択される | `openOrActivateTab` が `open-tab` へ接続（`App.tsx:658`, `:676`）。`development_workflow.md` へ手動項目を追加 | ✓ 整合（実機確認は Phase 4-a） |
| 手動確認で pointer / keyboard の双方から move でき、fallback、destination selection、focus、StatusBar / ErrorBanner routing が一致する | `move-tab` が `activePaneId` を destination へ更新し、`activeTab` は active pane の group view から導出（`App.tsx:206-208`） | ✓ 整合（実機確認は Phase 4-a） |
| 手動確認で同じ Markdown / HTML を両 pane に開き、Mermaid / PlantUML / HTML ready・timeout が混線しない | global data 共有 + pane-local runtime を維持。両 group 参照は `open-tab` の dedupe append で成立 | ✓ 整合（実機確認は Phase 4-a） |
| 既存 single / split view と HTML security boundary の回帰が無い | `documentPolicy.ts` / `imageViewer.ts` / `paneRuntime.ts` / `src-tauri` / capabilities いずれも差分なし | ✓ 整合 |
| 恒久ドキュメント同期 | 13 ファイル更新（Round 1 fix で `avalonia_viewer/tauri_ux_rollout_spec.md` を追加）。設計 §15 の置換対象は全件反映済み | ✓ 整合。指摘 2.1 の残存 1 行は `83e0ce8` で置換済み。Phase 4-a の合否基準（`development_workflow.md`）も正しく置換されている |

---

## 5. 承認済み設計レビュー指摘 13 件の実装トレース

Phase 2 で確定した契約が実装へ落ちているかを、設計レビューの追跡観点に沿って確認した。

| 設計レビュー指摘 | 実装での確認 | 結果 |
| --- | --- | --- |
| 1.1 pending navigation 規則を 10 action へ | `open-tab` は anchor 有無で設定/`null`（`splitView.ts:87-89`）、`select-tab` は常に `null`（`:104`）、`close-pane-tab` は active close のときだけ `null`（`:140`）、`move-tab` は source active move のときだけ `null` / destination は selection 変化時 `null`（`:167`, `:174-176`）、`disable-split` は secondary だけ `null`（`:125`）、`reset-root` は両 pane `null`（`:185-186`）。`assertSplitViewState` が pending = active を全出力で強制（`:275-280`） | ✓ 完全一致。旧 `remove-tab` の到達不能 guard も残っていない |
| 1.2 初期化 signature / split payload / adjacent helper / test 移行 | `createInitialSplitViewState(): SplitViewState` は引数なしで両 group empty（`:57-65`）、`enable-split` / `disable-split` は payload なし（`:38-39`）、`findAdjacentTabId` は非 export の module-private（`:233`）。`splitView.test.ts` / `paneRuntime.test.ts` は共通 fixture へ移行済み | ✓ 完全一致 |
| 1.3 恒久 docs の置換対象 | `13c87a3` で 12 ファイル更新（`interface_spec.md` の `Tab close` / `Split View 表示` 節、`detail_design.md:474`、`development_workflow.md:174-178`、`markdown-viewer-tauri/README.md` ほか）、`83e0ce8` で `interface_spec.md:55` と Avalonia rollout spec を追加対応 | ✓ 完全一致。設計 §15 の置換対象は全件反映済み（指摘 2.1 / 2.2 解決済み） |
| 2.1 / 3.8 runtime status の generic effect 一本化 | `setPanePreviewStatus` の呼び出しは `updatePanePreviewPhase`（`App.tsx:336`）と generic effect（`:1185`）の 2 箇所だけ。`loadRoot` / `reload` / `openOrActivateTab` / `closeTab` / `toggleSplitView` の直接 clear 5 箇所はすべて削除済み | ✓ 完全一致。設計 §9.1 の完了条件（2 経路限定）を達成 |
| 2.2 hidden secondary 回復導線 | `hiddenSecondaryTabCount` を `mode === "single" && primaryTabs.length === 0` の時だけ算出（`App.tsx:1291-1295`）、`role="status"` で件数と `Enable Split View` 案内を表示（`:2407-2412`）。単数 / 複数の語形も分岐 | ✓ 完全一致（単複分岐は設計文言からの改善） |
| 3.1 invariant 8 と旧 roving fallback 削除 | `assertSplitViewState` が nonempty ⇒ active non-null を強制（`splitView.ts:269-271`）、TabStrip は `tabIndex={isActive ? 0 : -1}` のみで旧 `activeTabId === null && index === 0` 分岐は削除済み（`App.tsx:2540`） | ✓ 完全一致 |
| 3.2 single + secondary の対称 throw | `assertPaneAvailable` を `open-tab` / `select-tab` / `activate-pane` / `close-pane-tab` へ適用（`splitView.ts:241-246`）、`move-tab` は mode 判定で拒否（`:146-148`） | ✓ 完全一致。test 10 が 4 action + move の拒否を検証 |
| 3.3 generic resolver 境界 | `resolveGroupTabs<T extends { id: string }>`（`splitView.ts:218-231`）、App の `useMemo` 2 箇所だけで呼び出し、`DocumentPane` は解決済み view を受けるのみ | ✓ 完全一致 |
| 3.4 move 時の image viewer | 追加コードなし。既存 identity effect（`App.tsx:1145-1160`）が origin pane の selection 変化で閉じる。設計 §14「`imageViewer.ts` 変更なし」と一致 | ✓ 完全一致（下記注記も参照） |
| 3.5 Reload 対象の明確化 | `reload()` は `activeTab`（active pane group から導出）1 件だけ revision を増やす（`App.tsx:621-660`） | ✓ 完全一致 |
| 3.6 split 時 tab 幅 | `.tab-item.tab-item-split { grid-template-columns: minmax(0, 1fr) 30px 30px; min-width: 160px; }`（`App.css:878-881`）。`width: min(220px, 32vw)` は据え置き | ✓ 完全一致。TODO-2026-021 の viewport 基準契約も不変 |
| 3.7 ADR 再評価条件 | 設計 §13 に記載済み。ADR 追加は無し（`docs/adr/README.md` の一覧は空のまま） | ✓ 完全一致 |

注記（3.4 の実機挙動）: image viewer が開いている間は `app-shell` に `inert` / `aria-hidden` が付く（`App.tsx:1204-1205`）ため、viewer 表示中に move / close button を操作する経路は存在しない。したがって §8.3-7 と §8.2 の image viewer 規則は防御的な契約であり、focus 復帰（`imageViewerFocusReturnRef`）と move 後 focus が競合する経路も発生しない。Phase 4-a では「viewer を閉じてから move する」順で確認すれば足りる。

---

## 6. テスト評価

設計 §16.1 の移行方針および §16.2 / §16.3 の項目に対する充足状況。

| 設計 §16 の項目 | 対応 test | 結果 |
| --- | --- | --- |
| 既存 test の意味を維持して移行（width / ratio / keyboard / guard / 合成） | `splitView.test.ts` の `split pane width policy` 4 test は変更なし。`paneRuntime.test.ts` の presentation 4 test は fixture だけ差し替え | ✓ 緩めていない。期待値は従来どおり |
| 旧仕様 test の削除・置換 | secondary 隣接自動選択 3 test、active secondary → primary 引き継ぎ 3 test、global `remove-tab` 1 test、group 未登録 ID の `select-tab` を削除。secondary group 保持 / nonmember throw / 両 group 登録の test へ置換 | ✓ 方針どおり |
| 共通 fixture helper | `stateWithPaneTabs({ primary, secondary, activePaneId, mode, requestedSplitRatio })`（`splitView.test.ts:24-52`）、`paneRuntime.test.ts` にも同名 helper | ✓ action 積み上げによる意図の不透明化を回避 |
| open の末尾追加 / dedupe / 両 group / anchor | test 2, 3 | ✓ |
| local order select、nonmember / invalid secondary 拒否 | test 4, 10 | ✓ |
| close の右→左→empty、non-active 維持、他 group 不変 | test 5, 6（他 group は `toBe` で参照同一性まで検証） | ✓ |
| reference set と shared ID の referenced 判定 | test 6（primary から `b` を close しても secondary が参照するため `{a, b}`）、test 14 | ✓ |
| move の destination absent / present、active / non-active、last source、pending | test 7, 8, 9 | ✓ |
| single move / same pane move / nonmember move の拒否 | test 10 | ✓ |
| split off / on の group 保持と secondary pending clear | test 11（`toBe` で primary の参照同一性も検証） | ✓ |
| root reset の mode / ratio 維持 | test 12 | ✓ |
| pending 保持中の open / select / active close / non-active close / move で invariant 3 維持 | test 2（open が pending を置換）、4（select が clear）、5（active close が clear）、6（non-active close が維持）、8 / 9（move の source 維持 / destination clear） | ✓ 5 経路すべて |
| duplicate ID / active nonmember / nonempty + null active / pending 不一致 / single + secondary active の拒否 | test 13 | ✓ |
| generic resolver の local 順 / missing throw / duplicate throw / reference 導出 | test 14 | ✓ |
| move 後 source 拒否・destination 受理 | `paneRuntime.test.ts` test 3 | ✓ |
| single 中の retained secondary 拒否、再 split 後の revision guard | 同 test 4 | ✓ |
| 同一 document 両 group の pane-local error 分離 | 同 test 7 | ✓ |
| shared loading / rendering / error precedence 回帰 | 同 test 5, 6, 8 | ✓ |

観察（指摘ではない）: `assertSplitViewState` の 6 分岐のうち「empty pane cannot have an active tab」（`splitView.ts:266-268`）だけが test 13 の不正 state 一覧に含まれていない。invariant 2 の系であり設計 §16.2 も要求していないため充足判定には影響しないが、将来 test を追加する際の候補として記録する。

---

## 7. 検証評価

実装記録 §6 の自動検証結果を、初回レビュー（`13c87a3` 時点）と Round 1 fix 後（`83e0ce8` 時点）の 2 回再実行し、いずれも一致することを確認した。下表の再実行結果は `83e0ce8` 時点のものである。

| コマンド | 実装記録の記載 | 本レビューでの再実行結果 | 一致 |
| --- | --- | --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | 成功。5 files / 77 tests passed | `Test Files 5 passed (5)` / `Tests 77 passed (77)` | ✓ |
| `cd markdown-viewer-tauri && npm run build` | 成功。既知の chunk size warning のみ | `✓ built in 5.38s`。警告は `Some chunks are larger than 500 kB` のみ | ✓ |
| `cd markdown-viewer-tauri/src-tauri && cargo fmt -- --check` | 成功 | 差分出力なし | ✓ |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | 成功 | `Finished dev profile` | ✓ |
| `cd markdown-viewer-tauri/src-tauri && cargo test` | 成功。22 tests passed、0 failed | `test result: ok. 22 passed; 0 failed` | ✓ |
| `git diff --check` | 成功 | 出力なし | ✓ |

`docs/rules/development_workflow.md:156-164` の Tauri 検証コマンドおよび同 :219-225（`cargo fmt`、lint script 未定義のため `npm run build` の TypeScript compile を完了条件に含める運用）とも一致する。実装記録の記載に誇張や未実行のコマンドは無い。Round 1 fix は `loadRoot` の 2 行入れ替えと docs 4 ファイルのみで、test 件数（77）にも Rust 側（22）にも変化は無い。

---

## 8. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| 旧 schema の完全除去（checkpoint 5） | ✓ `remove-tab` action、`fallbackTabId`、`enable-split` / `disable-split` の `orderedTabIds` payload、`findAdjacentTabId` の export、TabStrip の `activeTabId === null` fallback、handler の直接 status clear がいずれも残存しない。互換経路ゼロ |
| reducer の入出力二重検証 | ✓ `reduceSplitView` が入力（`splitView.ts:73`）と出力（`:210`）の両方を検証。`consume-navigation` の early return は検証済み入力をそのまま返すため安全（`:197`） |
| fallback の基準順序 | ✓ `close-pane-tab` / `move-tab` とも**変更前**の `orderedTabIds` を `findAdjacentTabId` へ渡す（`:138`, `:165`）。設計 §7「sourceの変更前順序を基準に」と一致。global 順は使用していない |
| 参照集合による eviction | ✓ `closeTab` が reducer 適用**後**の state から `getReferencedTabIds` を評価し、最後の参照時だけ global data を削除（`App.tsx:772-778`）。設計 §4.3 の順序と一致。同 ID を両 group が参照する場合は data / revision / shared load state を維持 |
| in-flight load と eviction の競合 | ✓ `updateTabIfCurrent` は id + revision 一致の `map` であり（`App.tsx:421-429`）、global tab 削除後は自動的に no-op になる。`nextTabIdRef` は単調増加のため ID 再利用による誤着地も起きない |
| `useMemo` の再計算最小化 | ✓ `select-tab` / `activate-pane` / `enable-split` / `consume-navigation` / `set-requested-ratio` はいずれも `orderedTabIds` の参照を保持するため（spread による）、group view の再解決が起きない。`disable-split` も `...state.secondary` により配列参照を維持 |
| App integration の更新順 | ✓ `closeTab`（group 先行縮小）、`openOrActivateTab`（tabs 先行追加）、`loadRoot`（`reset-root` 先行、`83e0ce8` で修正）の 3 経路とも、全中間状態で `group ⊆ global tabs` が成立する。React の batching に依存しない（指摘 3.1 解決済み） |
| move の focus 調停 | ✓ rAF 後に `tab-<destination>-<tabId>` を取得し `HTMLButtonElement` 判定の上で focus + `scrollIntoView`。欠落時のみ `document-pane-<destination>`（`tabIndex={-1}` で focusable）へ戻して `console.error`。source の消滅要素へは戻さない（`App.tsx:789-805`）。設計 §8.3-5 と一致 |
| close の focus 調停 | ✓ `closeTab` の戻り値が source pane の fallback active tab。TabStrip の `close()` が fallback tab、無ければ `document-pane-<paneId>` へ focus（`App.tsx:2490-2497`）。設計 §9.4 と一致 |
| 移動先 pane の active 化 | ✓ `move-tab` が `activePaneId` を destination へ更新（`splitView.ts:161`）。focus 移動で発火する `onFocusCapture` → `activatePane` は同一 pane のため no-op（`App.tsx:893-897`）。二重更新なし |
| accessible name | ✓ move は `Move <name> to <secondary\|primary> pane`、close は `Close <name> in <primary\|secondary> pane`。tablist は `<Primary\|Secondary> pane open documents`、region は `<Primary\|Secondary> document pane`。同名 document が両 pane にあっても操作対象を識別できる |
| Tab 順の設計一致 | ✓ activate は `isActive ? 0 : -1`、move / close も `isActive ? 0 : -1`。active tab だけが Tab 順に move / close を含む（設計 §11） |
| security 境界 | ✓ `documentPolicy.ts` / `imageViewer.ts` / `paneRuntime.ts` / `src-tauri/` / `tauri.conf.json` / `capabilities/` に差分なし。iframe key・`sandbox`・CSP・`event.source` 照合・pane-local duplicate guard・scheme allowlist・Mermaid `securityLevel: "strict"` と pane 込み render ID をすべて維持。group membership や active pane を許可条件へ持ち込んでいない |
| image viewer identity | ✓ 既存 effect が `paneId` + `tabId` + `revision` + `visual.isConnected` を照合（`App.tsx:1145-1160`）。move / close 用の追加コードは無く、設計 §14「`imageViewer.ts` 変更なし」と一致 |
| CSS | ✓ split 時のみ 3 列 + `min-width: 160px`、single 時は既存 2 列 + 130px。`width: min(220px, 32vw)`、horizontal overflow、`focus-visible`、loading / error 表示は不変。`.tab-move` は `.tab-activate` / `.tab-close` と同じ hover / focus 規則へ追加済み |
| 恒久 docs の内容一致 | ✓ `README.md` / `project_overview.md` / `architecture/overview.md` / `code_patterns.md` / `common_pitfalls.md`（新設 §11）/ `tauri_viewer/README.md` / `basic_design.md` / `detail_design.md` / `interface_spec.md` / `development_workflow.md` / `markdown-viewer-tauri/README.md` の記述はいずれも実装挙動と一致。`interface_spec.md:55` の 1 行のみ例外（指摘 2.1） |
| 実装記録の正確性 | ✓ §2 の設計対応表、§3 の状態・action・UI 一覧、§4 のテスト更新、§5 の docs 反映、§6 の検証結果はいずれも実物と一致。「設計からの仕様差分はない」という記述も本レビューの確認と一致する |
| meta.md | ✓ `design_status: "done"` / `impl_status: "draft"`、`related_commits` へ Phase 2 の 6 コミットと `13c87a3` が追加済み。Phase Status の Phase 3 行も「Draft implementation and permanent docs prepared; automated verification passed; review pending」でレビュー未完了の現状と整合する。本レビューでは変更していない |

---

## 9. 指摘一覧と最終 status

| # | 指摘 | severity | blocking | status |
| --- | --- | --- | --- | --- |
| 2.1 | `interface_spec.md:55` に旧 global 表示の記述が残存 | Medium | non-blocking | **解決済み** (`83e0ce8`) |
| 2.2 | Avalonia rollout spec が廃止済み split 継承規則を `common` baseline として保持 | Low | non-blocking | **解決済み** (`83e0ce8`) |
| 3.1 | `loadRoot` の tabs / group 更新順が他 2 経路と逆 | Low | non-blocking | **解決済み** (`83e0ce8`) |

**検出指摘 3 件（Medium 1 / Low 2）はすべて解決済み。未解決指摘 0 件。** blocking 指摘は初回から 0 件であり、Phase 4 へ進行できる。

---

## 10. 残リスク / Phase 4 での注意点

- **Phase 4-a で重点確認したい項目**: pane-local group の実挙動はすべて pure reducer の unit test で固定されているが、DOM / focus / 支援技術に関わる部分は自動検証の対象外である。特に (a) move 後に destination tab へ実際に focus が移り destination pane が active になること、(b) local close 後の fallback tab focus と、group が空になった場合の pane region focus、(c) split 時の tab 幅 160px で document 名が ellipsis 付きで判別できること、(d) primary empty / secondary nonempty の回復案内が `role="status"` で読み上げられること、を `docs/rules/development_workflow.md` の該当項目で確認されたい。
- **image viewer と move の組み合わせ**: §5 の注記のとおり viewer 表示中は shell が `inert` のため move / close は操作できない。Phase 4-a では「viewer を閉じてから move / close する」順で確認すれば十分であり、viewer 表示中に move できないこと自体は仕様である。
- **throw の可視化**: 本実装は internal inconsistency を throw で顕在化する方針（設計 §4.5）を採るため、万一 invariant が破れた場合は WebView 上で例外として現れる。Phase 4-a で予期しない画面停止が発生した場合は、コンソールの `Pane tab group references missing tab` / `Active tab is not a member` / `Pending navigation does not match` 等のメッセージを記録すると原因特定が速い。
- **memory**: split off 中も secondary group が global data を参照し続けるため、hidden secondary に大きな document を残したまま single で作業すると cache が解放されない。設計 §18 のとおり session-only・最大 2 group・data 共有であり通常利用では問題にならないが、Phase 4-a で大きな HTML / PlantUML を扱う場合は体感を確認しておくとよい。
- **TODO-2026-011 / TODO-2026-012 への申し送り**: 指摘 2.2 の対応により、Avalonia rollout spec には TODO-2026-006 baseline と Tauri 現行 semantics の差、および再評価条件が記録された。TODO-2026-011 着手時に、旧 baseline と pane-local group のどちらを Avalonia の目標とするかを先に確定する必要がある点は変わらないため、Phase 4-b の完了処理で TODO 側へも申し送っておくとよい。

---

## 11. 結論

**判定: 承認 (Approved)。Phase 4 へ進行可。未解決指摘 0 件。**

- **blocking 指摘: 0 件**（初回・再確認とも）。
- 承認済み設計 §6〜§18 の契約、および Phase 2 設計レビューで確定した 13 件の指摘対応は、すべて実装・恒久ドキュメントへ反映されている。
- 旧 schema・旧 action・旧 fallback・handler の直接 status clear はいずれも残存せず、単一路線化（設計 §13）が達成されている。
- security 境界（trusted HTML、Mermaid、PlantUML、image viewer、Rust / capability / CSP）に退行は無い。
- テストは旧仕様を緩めたものではなく、新 contract の境界値と失敗系を直接検証している。自動検証は全コマンドを再実行して実装記録との一致を確認した。
- 初回検出の Medium 1 件 / Low 2 件は Round 1 fix (`83e0ce8`) ですべて解決済みで、**未解決指摘 0 件**である。再確認で新規指摘は検出しなかった。
- Round 1 fix により、恒久 docs は設計 §15 の置換対象を全件反映し、`group ⊆ global tabs` の更新順規則は 3 経路すべてで batching 非依存となり、`common_pitfalls.md` と実装記録にも同期された。
