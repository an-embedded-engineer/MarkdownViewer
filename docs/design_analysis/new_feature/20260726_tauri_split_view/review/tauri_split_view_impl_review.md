# TODO-2026-006 Tauri Split view 導入 実装・恒久ドキュメントレビュー

**レビュー日**: 2026-07-26
**再確認日**: 2026-07-26
**対象ドキュメント**: `docs/design_analysis/new_feature/20260726_tauri_split_view/impl/tauri_split_view_feature_impl.md`
**対象設計書**: `docs/design_analysis/new_feature/20260726_tauri_split_view/design/tauri_split_view_feature_design.md`
**対象設計レビュー**: `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_design_review.md`（承認済み、未解決 0 件）
**対象 meta**: `docs/design_analysis/new_feature/20260726_tauri_split_view/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-006
**初回レビュー対象コミット**: `810f0c3` (Phase 3 implement Tauri split view)
**Round 1 fix コミット**: `c8f5272` (Phase 3 address Tauri split view implementation review)
**判定**: **承認 (Approved)**。Phase 4（検証・完了処理）へ進行可。初回検出の Medium 1 件 / Low 3 件は Round 1 fix (`c8f5272`) ですべて実装へ反映済みと再確認した。**未解決指摘 0 件**。

---

## 概要

TODO-2026-006 Phase 3 の実装・恒久ドキュメントレビュー。`810f0c3` の差分（frontend 6 ファイル、恒久 docs 11 ファイル、実装記録・meta）と更新後ファイル全体を、承認済み設計書第 7〜19 節、`docs/todo/todo.md` の受け入れ条件、`ai-review-response-workflow` の review checkpoints に照らして検証した。

実装の骨格は設計どおりである。旧 global `activeTabId` / `pendingNavigation` は完全に除去され（`App.tsx` 内の該当識別子はすべて `PaneState.activeTabId` / `pane.pendingNavigation` への参照）、single / split とも `SplitViewState` + `DocumentPane` の単一経路へ収束している。`splitView.ts`（純粋 policy）と `paneRuntime.ts`（guard と表示 state 合成）は React・DOM・Tauri・Mermaid へ依存せず、設計 §9.4 / §9.5 の責務どおりに分離されている。Mermaid は App instance 所有 queue で直列化され、`mermaid.render` に `paneId + tabId + revision + index` を含む一意 ID を渡すことで、設計 §10.1 が要求した「同一 document 内での生成 ID 一意性」を実装レベルで確定させている（`securityLevel: "strict"` は維持）。HTML bridge は pane ごとの `event.source` 照合・pane-local duplicate guard・pane runtime への ready / timeout 反映で分離され、active pane 条件は security 判定へ入っていない。Rust command、custom protocol、capability、CSP、settings schema は一切変更されていない（`810f0c3` / `c8f5272` とも `src-tauri/` の差分なし）。

初回レビューでは次の 1 点をブロッキング（Medium）として指摘した。

- pane の preview 要素登録 effect の依存配列が `[paneId, selectedTab?.id, selectedTab?.revision]` のみで、Markdown 本文が到着して `MarkdownPreview` が mount しても再登録されない。新規に開いた tab では `panePreviewElementsRef` が focusable でない `.preview-pane` div を指したままになり、pointer 起点の image viewer を閉じた時に focus が preview へ戻らない。

Round 1 fix (`c8f5272`) では、(1) Markdown preview を callback ref で live 登録し fallback を focus 可能な pane region へ変更、(2) 選択が変わらない経路の pane status clear を廃止して Reload を対象 pane 限定へ、(3) `available < 2` で width bounds を `null` へ縮退、(4) pane 選択判定と tab revision 判定を独立 pure function へ分離して HTML bridge context へ個別配線、という形で 4 件とも根本原因のレベルで解決されている。恒久ドキュメントと設計契約の変更は不要であり、実装記録 §7 に対応内容と再検証結果が追記されている。

再確認の結果、対応による新たな齟齬・退行・契約逸脱は検出しなかった。frontend test は 70 → 71 tests（境界 test と独立判定 test の追加）へ増え、本レビューでも `npm test -- --run` と `npm run build` の成功を再現した。

---

## 1. 齟齬・不整合

### 1.1 preview 要素の登録が document 読み込み前で固定され、pointer 起点 image viewer の focus 復帰が働かない

**severity**: Medium（ブロッキング）
**工程**: Phase 3（実装修正）
**status**: 解決済み（2026-07-26 再確認、commit `c8f5272`）

**根拠**:

`DocumentPane` は preview 要素を effect で App へ登録する。

```tsx
// App.tsx:2173-2176（初回レビュー時点）
useEffect(() => {
  onPreviewElement(paneId, previewRef.current ?? previewPaneRef.current);
  return () => onPreviewElement(paneId, null);
}, [paneId, selectedTab?.id, selectedTab?.revision]);
```

新規 tab を開く経路では、この effect が最初に走る時点で tab は `loadState: "loading"` かつ `sourceText === null` である。このとき `DocumentPane` は `preview-empty` を描画しており `previewRef.current` は `null` なので、fallback の `previewPaneRef.current`（`.preview-pane` div）が登録される。

その後 `loadTab` が `sourceText` を設定して `MarkdownPreview` が mount しても、この effect の依存値（`paneId` / `selectedTab.id` / `selectedTab.revision`）は変化しないため**再登録されない**。同じ `DocumentPane` 内の Mermaid effect は依存に `selectedTab?.plantUmlDiagrams` を含むため読み込み完了時に再実行されるのに対し、登録 effect だけが取り残されている。

結果として `panePreviewElementsRef.current[paneId]` は `.markdown-body`（`tabIndex={-1}`）ではなく `.preview-pane` div を指し続ける。この div は `tabIndex` を持たない非 focusable 要素であるため、

- `closeImageViewer` が pointer 起点で選ぶ復帰先、
- focus 復帰 effect の `focusReturn.focus()`、
- 起点が切断済みの場合の fallback `panePreviewElementsRef.current.primary?.focus()`

がいずれも no-op となり、image viewer を閉じた後の focus が preview へ戻らず body へ落ちる。keyboard 起点（`focusOrigin` = 起点 button）は影響を受けないが、pointer 起点は新規 open 直後の tab で常にこの状態になる。

**影響する契約**:

- `docs/components/tauri_viewer/interface_spec.md`「keyboard 起点では発生元 pane の起点 button、**pointer 起点では発生元 preview へ focus を戻す**。…接続済み起点がなければ primary pane へ focus を戻す」。
- 同 `detail_design.md`「close 後は keyboard 起点なら button、pointer 起点なら発生元 Markdown preview へ focus を戻し、復帰先が detach 済みなら primary pane へ fallback する」。
- 設計書 §10.3 / §19-8、`docs/rules/development_workflow.md` の image viewer focus 手動確認項目。

**推奨対応**: 登録 effect が preview 要素の実体変化に追従するようにする。最小修正は依存配列へ描画実体の切り替わりを表す値を加えることで、Mermaid effect と同じ `selectedTab?.plantUmlDiagrams` を足すか、より意図が明確な `selectedTab?.documentType` と `selectedTab?.sourceText !== null`（または `previewRef.current` を設定する ref callback 方式）を用いる。あるいは登録 ref を廃し、`closeImageViewer` 側で発生元 pane の live な preview 要素を取得する形にしてもよい。いずれの場合も、`.preview-pane` へ fallback するときは focus 可能な要素（pane region `document-pane-${paneId}` は `tabIndex={-1}` を持つ）を選ぶか、fallback 先が focusable であることを保証すること。

**確認 (`c8f5272`)**: 推奨対応のうち「callback ref 方式」と「focus 可能な fallback」の両方が採られ、確認事項 4 点すべてが満たされている。

- `MarkdownPreviewProps.previewRef` が `React.RefObject<HTMLElement | null>` から `React.RefCallback<HTMLElement>` へ変わり（`App.tsx:2640`）、`<article ref={previewRef} tabIndex={-1}>`（`App.tsx:2662`）へそのまま渡る。`DocumentPane` 側の `registerMarkdownPreview`（`App.tsx:2193-2196`）が `previewRef.current = element` と `onPreviewElement(paneId, element ?? paneRegionRef.current)` を同時に行うため、**登録先が DOM の実体と常に一致する**。
- **loading 完了**: 本文到着で `<article>` が mount した瞬間に callback ref が live 要素で発火する。加えて登録 effect の依存へ `hasMarkdownPreview`（`selectedTab?.documentType === "markdown" && sourceText !== null`、`App.tsx:2191-2201`）が追加され、effect 経路でも同じ要素が再登録される。二重に追従するが登録値は同一で冪等である。
- **theme remount**: `MarkdownPreview` の key は theme を含むため、theme 切替時は detach → attach が起きる。detach 時の `registerMarkdownPreview(null)` は `null ?? paneRegionRef.current` により pane region を登録し、attach 時に新しい article を登録する。**中間状態でも focus 可能な要素が登録されている**。
- **非 Markdown 時**: HTML tab、loading 中、未選択のいずれでも `previewRef.current` は `null` で、登録先は `paneRegionRef`（`App.tsx:2318` の `<section class="document-pane" id="document-pane-${paneId}" tabIndex={-1}>`）になる。旧 fallback の `.preview-pane` div は ref を持たなくなり（`previewPaneRef` は削除済み、残存参照なし）、非 focusable 要素が登録される経路は消えた。
- **unmount**: 登録 effect の cleanup `onPreviewElement(paneId, null)` が残っており、split off で secondary が消えた場合に `panePreviewElementsRef.current.secondary` は `null` になる。primary への fallback（`App.tsx:1160`）が参照する primary 側は article または pane region で、いずれも focusable である。

これにより `closeImageViewer`（`App.tsx:791-799`）が pointer 起点で選ぶ復帰先と、`focusReturn.isConnected` が false の場合の primary fallback がともに focus 可能な要素になり、`interface_spec.md` / `detail_design.md` / 設計 §10.3 の契約と一致する。`registerMarkdownPreview` は毎 render で新しい関数 identity になるため React が ref を detach / attach し直すが、いずれも commit 中に同期実行され最終的な登録値は article のままで、副作用は ref 書き込みだけ（setState を伴わない）であるため挙動・性能とも問題はない。

---

## 2. ドキュメント不足

恒久ドキュメントの不足は検出しなかった。設計 §17 が予定した更新先 11 件はすべて更新され、記載と実装を個別に照合した範囲で齟齬はない（第 5 節の確認表を参照）。実装記録 `impl/tauri_split_view_feature_impl.md` も、設計からの具体化 2 点（`mermaid.run` → `mermaid.render` + pane-scoped ID、separator を計測後だけ描画）と非変更範囲（Rust / protocol / capability / CSP / settings schema）を明示しており、Phase 2 レビュー第 7 節の注意点に対する回答になっている。

Round 1 fix (`c8f5272`) では実装記録へ §7「Phase 3 実装レビュー対応」が追記され、4 指摘の分類・対応・再検証結果（71 tests / build 成功）と「設計契約と恒久ドキュメントの変更は不要」という判断が記録された。今回の修正はいずれも実装の適合修正であり、`interface_spec.md` / `detail_design.md` の既存記述（pointer 起点は発生元 preview、fallback は primary pane）を変更せずに満たす方向の修正であるため、恒久ドキュメントの追随は不要という判断は妥当である。**未解決のドキュメント不足は無い。**

---

## 3. 改善提案

### 3.1 pane preview status を選択変更のない経路でも clear しており、pane の error 表示が消える

**severity**: Low
**工程**: Phase 3（実装修正）
**status**: 解決済み（2026-07-26 再確認、commit `c8f5272`）

**根拠**: `PanePreviewStatus` を `null` にする経路が 3 つある。

- `activateTab`（初回時点 `App.tsx:760-763`）と `openOrActivateTab` の既存 tab 分岐（`App.tsx:645-651`）は、選択が変わらない場合でも無条件に clear する。すでに選択中の tab を再度 click する、あるいは Explorer で表示中の file を再選択すると、pane status が `null` になる。
- `reload()`（`App.tsx:634-635`）は active pane の tab だけを再読込するにもかかわらず、primary / secondary 両方の status を clear する。

いずれの場合も、`DocumentPane` の Mermaid effect（依存: `paneId` / tab id / revision / `plantUmlDiagrams` / `theme`）と `HtmlPreview` の effect（依存: pane / tab / revision / URL）は依存値が変わらないため**再実行されず**、status が再設定されない。したがって、

- HTML handshake timeout 後にその tab を再 click すると、TabStrip の `Error` label と ErrorBanner が消える一方、iframe は失敗したままになる。
- 一方の pane で Mermaid error が出ている状態で他方の pane を Reload すると、無関係な pane の error 表示だけが消える。

設計 §8.4 は「同一 tab が両 pane に表示されている場合は…pane runtime は両方 clear し」と限定しており、異なる tab を表示する pane まで clear することは求めていない。また identity ベースの stale status clear effect が不一致の status を既に落とすため、これらの明示 clear は本来不要である。

**推奨対応**: `activateTab` / `openOrActivateTab` の clear を「pane の選択 tab が実際に変わった場合」に限定するか、identity ベース clear に委ねて明示 clear を削除する。`reload()` は、revision を更新した tab を選択している pane（同一 tab を両 pane が表示している場合は両方）だけを clear する。

**確認 (`c8f5272`)**: 推奨対応どおりに縮小され、確認事項 3 点を満たしている。

- **再 click で消さない**: `activateTab`（`App.tsx:764-766`）と `openOrActivateTab` の既存 tab 分岐（`App.tsx:651-655`）から `setPanePreviewStatus(paneId, null)` が削除された。選択中の tab を再 click しても status は残り、HTML timeout の `Error` label と ErrorBanner が維持される。
- **Reload は対象 pane だけ**: `reload()` が `for (const paneId of ["primary", "secondary"])` で `getPaneState(splitViewRef.current, paneId).activeTabId === activeTab.id` を判定し、revision を更新する tab を選択している pane だけ clear する（`App.tsx:634-641`）。他 tab を表示する pane の error 表示は保持される。
- **同一 tab 両 pane では両方**: 同じ判定が両 pane に対して個別に走るため、両 pane が同じ tab を選択している場合は両方が clear され、設計 §8.4 の「共有 revision 更新で両 pane が再描画」と一致する。
- 残る明示 clear は `loadRoot`（`App.tsx:461-462`、root 変更で両 pane 選択も clear される）、新規 tab の `openOrActivateTab`（`App.tsx:672`、選択が必ず変わる）、`closeTab`（`App.tsx:785`、closed tab id 一致時のみ）、`toggleSplitView` の secondary（`App.tsx:874`）で、いずれも選択またはライフサイクルが実際に変わる経路である。

選択切替の直後にまだ古い status が残る 1 render については、`resolvePaneTabPresentationState` が `pane.activeTabId === tab.id` と status の tab / revision 一致を要求し、`currentActivePaneStatus`（`App.tsx:196-202`）も同じ照合を行うため、旧 status が新 tab の表示へ適用されることはない。直後に identity 効果（`App.tsx:1166-1176`）が stale status を落とす。

### 3.2 極小幅で width policy が ratio 0 / 1 を生成し、event handler から throw しうる

**severity**: Low
**工程**: Phase 3（実装修正）または Phase 4（境界 test 追加）
**status**: 解決済み（2026-07-26 再確認、commit `c8f5272`）

**根拠**: `getSplitPaneWidthBounds` は `workspaceWidth > splitSeparatorWidth`（6px）であれば bounds を返し、`min = Math.min(240, Math.floor(available / 2))` を用いる。`available = workspaceWidth - 6 ≤ 1` の場合、`min = 0` / `max = available` となる。この状態では `min !== max` のため `getSplitRatioForKey` が keyboard 操作を受け付け、`Home` は `0 / available = 0`、`End` は `available / available = 1` を返す。返り値は `applySplitView({ type: "set-requested-ratio", ratio })` へ渡り、`assertSplitRatio` が `0 < ratio < 1` を要求して throw する。同様に pointer drag も `getRequestedRatioForPrimaryWidth` 経由で 0 / 1 を返しうる。

throw は React の keydown / pointermove handler 内で発生するため、graceful な no-op ではなくアプリ全体のクラッシュになる。発生条件は preview workspace の実幅が 6px 超 8px 未満という極端な帯域で実運用ではほぼ到達しないが、同一 module 内で「bounds を作る条件」と「ratio として受理する条件」が境界で食い違っており、設計 §7.3 / §9.4 が意図した切り分けから外れる。`splitView.test.ts` の width test も `available ≤ 1` を扱っていない。

**推奨対応**: `getSplitPaneWidthBounds` の返却条件を「両 pane に 1px 以上を割り当てられる幅（例: `available >= 2` かつ `min >= 1`）」へ狭めて `null` を返し、計測前と同じ 50/50 CSS fallback へ倒す。あるいは `getSplitRatioForKey` / `getRequestedRatioForPrimaryWidth` の返り値を `(0, 1)` の開区間へ clamp する。いずれの場合も `splitView.test.ts` へ境界 case と no-op 確認を追加する。

**確認 (`c8f5272`)**: 推奨の第 1 案が採られ、確認事項（available 1px 以下で bounds / keyboard / pointer policy が安全に no-op、reducer へ ratio 0 / 1 を渡さない）を満たしている。

- `getSplitPaneWidthBounds` へ `if (available < 2) { return null; }` が追加された（`splitView.ts:172-178`）。`available >= 2` が保証されるため `min = min(240, floor(available / 2)) >= 1`、`max = available - min >= 1` となり、`min / available > 0`、`max / available < 1` が常に成立する。`Home` / `End` / `ArrowLeft` / `ArrowRight` / pointer drag が返す ratio はすべて開区間 `(0, 1)` に収まり、`assertSplitRatio` の throw 経路へ到達しない。
- bounds が `null` の帯域では `getPrimaryPaneWidth` も `null` を返し、separator 自体が描画されない（`App.tsx` の `splitViewState.mode === "split" && splitWidthBounds && primaryPaneWidth !== null`）ため keyboard / pointer handler が存在せず、CSS の `.preview-grid.split:not(.measured)` による 50/50 fallback へ倒れる。計測前と同じ縮退で一貫している。
- 境界 test が追加された（`splitView.test.ts:178-186`）。`getSplitPaneWidthBounds(splitSeparatorWidth + 1)` が `null`、同幅での `getSplitRatioForKey("Home", ...)` が `null`、`getRequestedRatioForPrimaryWidth(0, splitSeparatorWidth + 1, initialSplitRatio)` が現在 ratio を返す（no-op）ことを検証する。
- `available === 2`（workspace 8px）では `min === max === 1` となり、既存の `min === max` no-op 経路（keyboard は `null`、pointer は現在 ratio 維持）に入る。`aria-valuemin === aria-valuemax === aria-valuenow === 1` は ARIA 上妥当で、既存 test「shrinks to equal effective minimums in a narrow workspace」と同じ縮退である。

### 3.3 HTML bridge context の `tabMatches` と `revisionMatches` が同一述語へ縮退している

**severity**: Low
**工程**: Phase 3（実装修正）
**status**: 解決済み（2026-07-26 再確認、commit `c8f5272`）

**根拠**: `HtmlPreview` は `evaluateHtmlBridgeMessage` の context へ次を渡していた。

```ts
tabMatches: isCurrent(paneId, tabId, revision),
revisionMatches: isCurrent(paneId, tabId, revision),
```

`isPaneResultCurrent` は「pane が split mode 上で有効」「pane の選択 tab が一致」「その id と revision を持つ tab が存在」をまとめて判定するため、判定強度は従来と同等以上であり **security 上の緩和はない**。`documentPolicy.ts:84-87` は両者の論理積しか見ないため挙動も同じである。

問題は契約の可読性と将来の安全余裕である。`HtmlBridgeContext` は tab 同一性と revision 同一性を独立した入力として定義しており（`documentPolicy.ts:16-24`）、同じ値を 2 度渡すとこの分離が実質失われる。`isPaneResultCurrent` は本来 pane runtime の stale guard 用 API であり、そこから pane 選択条件が外れるような将来変更があった場合、security 判定 2 項が同時に緩む。

**推奨対応**: security context には意味どおりの述語を渡す。`paneRuntime.ts` へ pane 選択判定と tab revision 判定を小さな pure 関数として公開し（`isPaneResultCurrent` はその論理積として実装）、`HtmlPreview` からは分けて渡す。

**確認 (`c8f5272`)**: 推奨対応どおりに分離され、確認事項（pane 選択と tab revision の pure 判定が独立し、stale guard は合成、bridge context へ個別配線）を満たしている。

- `paneRuntime.ts` へ `isPaneSelectionCurrent(paneId, tabId, splitViewState)`（split mode 上の pane 有効性 + 選択一致）と `isTabRevisionCurrent(tabId, revision, tabIdentities)` が追加され、`isPaneResultCurrent` は両者の論理積として再実装された（`paneRuntime.ts:33-59`）。合成結果は従来と同一であり、既存 guard の判定強度は変わらない。
- `App` は `isSelectionCurrent` / `isRevisionCurrent` を両 `DocumentPane` へ渡し（`App.tsx:1298-1303, 1352-1357`）、`HtmlPreview` が `tabMatches: isSelectionCurrent(paneId, tabId)` / `revisionMatches: isRevisionCurrent(tabId, revision)` として個別に配線する（`App.tsx:2736-2737`）。`documentPolicy.ts` の判定順・context 定義は無改変で、`HtmlBridgeContext` の 2 項が本来の意味に戻った。
- `isCurrent`（合成版）は Mermaid task guard、timeout guard、pending navigation guard など pane runtime 用途に残り、用途の分離が明確になっている。
- 独立性の test が追加された（`paneRuntime.test.ts:20-27`）。`isPaneSelectionCurrent` が別 tab で false、`isTabRevisionCurrent` が別 revision で false になることを個別に検証する。
- security 挙動は不変である。`sandbox="allow-scripts"`、`event.source === iframeRef.current?.contentWindow`、opaque origin、ready、transient activation、pane-local duplicate guard、scheme allowlist はいずれも変更されておらず、active pane 条件も判定へ入っていない。

---

## 4. 受け入れ条件トレース確認

Round 1 fix (`c8f5272`) 反映後の状態で再評価した。初回 △ だった 2 行はいずれも ✓ へ更新した。

| `docs/todo/todo.md` TODO-2026-006 完了条件 | 実装・test・docs | 結果 |
| --- | --- | --- |
| View メニューから single / 左右 2 pane split を切り替えられ、切替後も有効な表示対象と active pane が保たれる | `MenuBar` の `role="menuitemcheckbox"` + `aria-checked`、`toggleSplitView`、`enable-split` / `disable-split`（`splitView.ts:81-112`）、test「selects the right adjacent tab」「does not erase primary when an empty secondary is active」「falls back to the first tab only when both panes are empty」 | ✓ 整合 |
| primary / secondary pane に同一 root 内の異なる open tab を選択して同時表示できる | `preview-grid` と 2 つの `DocumentPane`、pane-local `TabStrip`、tab data は複製しない（`tabs` は single source） | ✓ 整合 |
| Explorer 選択、tab activate、Reload、relative Markdown link は active pane を対象とし、他方の pane selection を意図せず変更しない | Explorer は `splitViewState.activePaneId` へ open、`reload` は active pane の tab のみ revision 更新（`App.tsx:611-645`）、link / anchor は発生元 pane、`select-tab` は当該 pane だけ更新 | ✓ 整合 |
| tab close、最後の tab close、root 変更、split off / on 後も各 pane が残存 tab または未選択状態へ一貫して復旧する | `closeTab` + `remove-tab`、`reset-root`、最後の tab close で pane region へ focus、test「updates every pane that references a closed tab」「keeps mode and ratio while resetting root selection」 | ✓ 整合 |
| 各 pane で Markdown preview、相対画像、Mermaid、PlantUML、trusted HTML、anchor、独立 scroll、loading / error 表示が破綻せず、非同期結果が他 pane / tab へ混線しない | pane 固有 ref / key、App 所有 Mermaid queue と pane-scoped render ID、`isPaneResultCurrent` guard、TabStrip 合成、`paneRuntime.test.ts` の混線 test | ✓ 整合。指摘 3.1 の修正で、選択が変わらない再 click や他 pane の Reload では pane の loading / error 表示が保持されるようになった |
| split 表示でも HTML iframe の sandbox / CSP / root boundary / external link policy と Markdown の raw HTML 禁止を維持する | `sandbox="allow-scripts"` と `referrerPolicy` 維持、`event.source` 一致・opaque origin・ready・activation・duplicate・scheme は `documentPolicy.ts` 不変、`renderMarkdown` の `html: false` 不変、`src-tauri` 差分なし | ✓ 整合。指摘 3.3 の修正で tab / revision 判定が bridge context へ個別配線され、契約の分離も回復した |
| pane 幅変更または window / Explorer resize 後も preview が幅へ追従し、Mermaid が source 表示へ戻らず、PlantUML と HTML iframe が不必要に再読み込みされない | `preview-grid` の CSS 変数幅と `available < 2` の縮退、`MarkdownPreview` の memo 維持、iframe key = `paneId + tabId + revision`、PlantUML は tab 単位 cache のまま | ✓ 整合 |
| keyboard だけで split toggle、pane / tab 選択、pane 間移動、separator 操作へ到達でき、focus indicator と accessible name / role / state が確認できる | `menuitemcheckbox`、pane-scoped ID、split separator の `aria-controls` と min / max / now、roving tabindex、`.document-pane[data-active="true"]` と `:focus-visible` | ✓ 整合 |
| single view の既存 Multi-tab、Markdown / HTML、image viewer、MenuBar / StatusBar、Settings、Recent Folders の操作が退行しない | single も primary `DocumentPane` の同一経路、Explorer separator の `aria-controls` を `preview-workspace` へ更新、既存 test 3 種（documentPolicy / imageViewer / explorerPane）は無改変で通過 | ✓ 整合。指摘 1.1 の修正で pointer 起点 image viewer の focus 復帰が契約どおりに戻り、fallback も focus 可能な pane region になった |
| `npm test` / `npm run build` / `cargo check` が成功する（success_metrics） | 本レビューで `npm test -- --run`（5 files / 71 tests passed）と `npm run build`（成功）を再実行して確認。`src-tauri` に差分がないため `cargo check` / `cargo test`（22 tests）の結果は Phase 2 時点から不変 | ✓ 整合 |
| 手動確認項目が定義されている（success_metrics 3〜5 行目） | `development_workflow.md` へ split 切替 / pane 別 tab 選択 / separator 操作 / close・root 復旧 / 同一 Mermaid 両 pane / HTML split / secondary image viewer の 8 項目を追加、実装記録 §6 に Phase 4 観点 | ✓ 整合 |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| 旧 global state の除去（設計 §15） | ✓ 整合。`App.tsx` に残る `activeTabId` / `pendingNavigation` の識別子はすべて `PaneState` 経由で、single 専用 state / handler は存在しない。single も `DocumentPane` primary を通る |
| `splitView.ts` の遷移契約（設計 §7.3, §8.1, §8.2） | ✓ 整合。`enable-split` は primary 維持 + 右隣→左隣→`null`（`findAdjacentTabId`）、primary 未選択なら secondary も `null`。`disable-split` は「active pane が選択済みの時だけ引き継ぎ / 未選択なら primary 維持 / 両方未選択かつ tab ありで先頭 fallback」を実装し、Phase 2 指摘 1.1 の修正内容と一致 |
| `remove-tab` / `reset-root` / `consume-navigation`（設計 §7.3, §8.6, §8.7） | ✓ 整合。closed ID を参照する pane だけ fallback へ移し、他 pane の pending navigation も closed ID の時だけ落とす。`reset-root` は mode / ratio を維持。`consume-navigation` は pane + tab + anchor 一致時だけ state を変え、不一致では同一 object を返して再 render を誘発しない |
| width policy（設計 §12.2, §9.4） | ✓ 整合。`number \| null` 契約、未計測 / 非 finite / separator 幅以下 / `available < 2` は `null`、`min = min(240, floor(available / 2))`、自動 clamp を ratio へ書き戻さない、`min === max` で keyboard / drag を no-op とする挙動を実装・test 済み。初回指摘 3.2 の境界も閉じた |
| 計測前 50/50 と separator の ARIA（Phase 2 残リスク 1 点目） | ✓ 解決。`.preview-grid.split:not(.measured)` が `repeat(2, minmax(0,1fr))`、separator は bounds と primary 幅が確定した時だけ描画。値を持たない focusable `role="separator"` が生じない |
| Mermaid 直列 queue と生成 ID（設計 §5.4, §10.1 / Phase 2 残リスク 2 点目） | ✓ 解決。`mermaidQueueRef` の Promise chain で直列化し、`mermaid-${paneId}-${tabId}-${revision}-${index}` を `mermaid.render` へ渡す。task 前後で `isCurrent` と `node.isConnected` を確認し、`securityLevel: "strict"` を毎回指定。`deterministicIds` は未使用 |
| Mermaid effect の lifecycle | ✓ 整合。cleanup で `cancelled = true` と `adapter.cleanup()`。React StrictMode の二重実行では 1 回目の task が `cancelled` で即 return し、2 回目だけが描画する。描画後に `adapter.decorate()` と `data-processed="true"` を付与し image viewer decoration 契約を維持 |
| preview 要素登録と focus 復帰（指摘 1.1 対応後） | ✓ 整合。callback ref が live な `.markdown-body` を登録し、非 Markdown / detach 中は `tabIndex={-1}` の pane region へ fallback、unmount では `null`。`closeImageViewer` と primary fallback の復帰先が常に focusable である |
| pane runtime guard（設計 §9.5） | ✓ 整合。`isPaneSelectionCurrent` / `isTabRevisionCurrent` / その合成 `isPaneResultCurrent` が split mode / pane 選択 / tab id / revision を判定し、`updatePanePreviewPhase` と Mermaid / HTML callback がすべて経由する。identity 効果が stale status を落とす |
| TabStrip の shared / pane-local 合成（設計 §7.2） | ✓ 整合。`resolvePaneTabPresentationState` が shared `loading` / `rendering` / `error` を優先し、shared `ready` かつ当該 pane で選択中・identity 一致の時だけ pane phase を写像する。`paneRuntime.test.ts` が両 pane 同一 tab の片 pane error 非混線まで検証 |
| HTML tab の `loadState` 前倒し（設計 §11） | ✓ 整合。`loadTab` は previewUrl 受領時点で `ready` とし、旧 `markHtmlReady` / `markHtmlError` は削除済み。handshake 中の Loading と timeout Error は pane runtime 経由で TabStrip / StatusBar / ErrorBanner に出る |
| HTML security 境界（設計 §11） | ✓ 整合。iframe ごとの ref / ready flag / timeout / duplicate guard、`event.source` 照合、origin / shape / activation / scheme は `documentPolicy.ts` 不変。active pane 条件は判定へ入っておらず、非 active pane からの正当な click も許可される。pane 活性化は `onFocus` と external-open 受信時の `onActivity` で行い security とは分離 |
| image viewer の pane identity（設計 §10.3） | ✓ 整合。`PaneImageViewerRequest` は交差型で `paneId` を付与し `imageViewer.ts` は無改変。close 条件に split off、pane 選択変更、tab / revision 変更、`visual.isConnected` を含み、focus 復帰先も指摘 1.1 対応で契約どおりになった |
| Explorer / split の pointer lifecycle 分離（設計 §12.3） | ✓ 整合。`SplitResizeState` と `splitResizeRef` を Explorer と独立に持ち、`setPointerCapture` / `lostpointercapture` / cancel を対称に処理。`.split-resizing` が cursor と user-select を固定し、`toggleSplitView` で single へ戻る際に resize state を解除 |
| 既存 CSS 契約の維持（Phase 2 指摘 3.4） | ✓ 整合。`.markdown-body` の `calc(100% - 48px)` と viewport 760px の gutter media query、`.tab-item { width: min(220px, 32vw) }`、`.html-preview-frame` の全幅、Explorer separator の挙動はいずれも無改変 |
| pane-scoped DOM ID と IDREF（Phase 2 指摘 3.1） | ✓ 整合。`tab-${paneId}-${id}` / `document-preview-${paneId}` / `document-pane-${paneId}` を実装し、旧 `document-preview` は残っていない。Explorer separator は `explorer-pane preview-workspace`、split separator は `document-pane-primary document-pane-secondary` を参照し、いずれの ID も実在する |
| 非対象範囲の遵守 | ✓ 整合。3 pane 以上 / 上下分割 / drag and drop / reorder / pin / layout 永続化 / scroll 復元は未実装。`src-tauri`、`tauri.conf.json`、`capabilities/`、settings schema に差分なし |
| 型安全性 | ✓ 整合。`PaneId` / `ViewMode` / `SplitViewAction` の discriminated union、`SplitPaneWidthBounds \| null`、`PanePreviewPhase` の網羅 switch、`React.RefCallback<HTMLElement>` への型変更を含め `any` / 非 null assertion / 型 cast の追加はない。`npm run build` の TypeScript compile も成功 |
| 恒久ドキュメントと実装の一致 | ✓ 整合。`interface_spec.md` の StatusBar 文言・Split View 節の幅式・separator 描画条件・split off 規則、`detail_design.md` の state 表と再描画方針、`basic_design.md` の `SplitViewState` field 表、`code_patterns.md` / `common_pitfalls.md` の追記、README 2 種、`project_overview.md`、`development_workflow.md` の手動確認追加は、Round 1 fix 後の実装とも一致する |
| 実装記録・meta | ✓ 整合。実装記録は設計対応表・具体化 2 点・変更ファイル・自動検証・Phase 4 観点に加え、§7 で Round 1 の 4 指摘と再検証（71 tests / build）を記録している。meta の `impl_status: draft` / Phase 3「review pending」は本レビュー承認をもって更新する対象である |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 | ブロッキング | Round 1 結果 |
| --- | --- | --- | --- | --- |
| 高 | 1.1 preview 要素登録の stale により pointer 起点 image viewer の focus 復帰が働かない | 新規に開いた tab という通常導線で発生し、`interface_spec.md` / `detail_design.md` / 設計 §10.3 と不一致 | 是 | 解決済み（`c8f5272`、callback ref + pane region fallback） |
| 低 | 3.1 選択非変更の経路と他 pane の Reload で pane status を clear し error 表示が消える | 表示が実態より良く見える方向の欠落で、effect が再実行されないため回復もしない | 否 | 解決済み（`c8f5272`、明示 clear の縮小と Reload の pane 限定） |
| 低 | 3.2 極小幅で ratio 0 / 1 を生成し event handler から throw する | bounds 生成条件と ratio 受理条件が矛盾し、失敗形が no-op ではなく throw になる | 否 | 解決済み（`c8f5272`、`available < 2` で bounds `null` + 境界 test） |
| 低 | 3.3 HTML bridge context の 2 フィールドが同一述語へ縮退 | 現時点で security 緩和はないが、将来 guard を変更した際に 2 項が同時に緩む | 否 | 解決済み（`c8f5272`、pure 判定の分離と個別配線 + test） |

---

## 7. 検証評価

本レビュー（Round 1 fix 反映後）で次を再実行し、実装記録 §5 / §7 の記載と一致することを確認した。

| コマンド | 結果 |
| --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | 成功。5 files / **71 tests passed**（初回 70 → 境界 test と独立判定 test の追加で +1、実装記録の記載と一致） |
| `cd markdown-viewer-tauri && npm run build` | 成功。TypeScript compile と Vite build 完了。警告は既存の large chunk のみ |
| `git show c8f5272 --stat` / `git show 810f0c3 --stat -- markdown-viewer-tauri/src-tauri` | `src-tauri` に差分なし。`cargo check` / `cargo test`（22 tests）の結果は Phase 2 時点から不変であり、再実行の必要がないことを確認 |

test 内容の評価:

- `splitView.test.ts`（17 case）は初期 state、隣接 tab 選択（右 / 左 / 1 tab / primary 未選択）、pane-local selection と pending navigation、consume guard の同一参照返却、split off の 3 分岐、close の全 pane 更新、root reset の mode / ratio 維持、ratio validation、width bounds（未計測 / NaN / separator 幅 / **available 1px**、通常幅、狭幅 min=max、clamp 非書き戻し）、keyboard 4 種と無関係 key を検証しており、設計 §18.1 の列挙を網羅する。Round 1 で追加された `splitSeparatorWidth + 1` の 3 assertion が指摘 3.2 の境界を固定した。
- `paneRuntime.test.ts` は pane 選択 / tab revision の**独立判定**（Round 1 追加）、合成 guard の pane / tab / revision 一致、split off 後の secondary result 拒否、tab close・選択変更後の status 拒否、shared 優先、pane phase の写像 4 種、同一 tab 両 pane での error 非混線、非選択 tab / stale revision の無視を検証しており、Phase 2 指摘 1.3 の要求と一致する。
- 既存 `documentPolicy.test.ts` / `imageViewer.test.ts` / `explorerPane.test.ts` は無改変で通過し、security / image / Explorer の回帰契約が保たれている。指摘 3.3 の修正は `documentPolicy.ts` を変更していないため、既存 security 回帰 test の意味も変わっていない。

自動化されていない範囲は妥当に明示されている。React DOM lifecycle（callback ref の登録追従を含む）、Mermaid 実描画と SVG ID の実衝突、iframe handshake、pointer capture、focus 復帰、CSS layout は Vitest（DOM 非依存の pure policy 構成）では検証できず、実装記録 §6 と `development_workflow.md` の追加項目、設計 §19 の 11 シナリオへ委ねられている。指摘 1.1 / 3.1 の修正効果はいずれもこの手動確認で最終確認する必要がある（第 8 節）。

---

## 8. 残リスク / Phase 4 での注意点

- **指摘 1.1 の修正効果を実機で確認する**: `development_workflow.md` の image viewer 項目（pointer 起点 close で pill / outline が出ないこと、keyboard 起点だけ button へ戻ること）と追加項目「secondary の画像 viewer を開いた状態で tab close または split off し、viewer が閉じて接続済み起点または primary pane へ focus が戻ること」を、**新規に開いた直後の tab**（登録追従が効く経路）と**theme 切替直後**の両方で実施する。
- **指摘 3.1 の修正効果を確認する**: HTML handshake を timeout させた tab を再 click しても `Error` 表示が残ること、片方の pane に error がある状態で他方の pane を Reload しても無関係な pane の表示が消えないこと、同一 tab を両 pane で表示した状態の Reload で両 pane が再描画されることを確認する。
- `mermaid.render` への移行は本 Phase で初めて導入した描画経路である。Mermaid の error 時に container へ error graphic が残る可能性、`bindFunctions` の再適用、PlantUML 併存 document での順序を Phase 4 の実描画で確認する。`sample_docs/plantuml.md` に加え、同一 Mermaid document を両 pane へ表示する手動項目を必ず実行する。
- image viewer 表示中に Theme を切り替えると `MarkdownPreview` の key が変わり発生元 visual が DOM から切断されるが、close 判定 effect の依存（`splitViewState` / `tabs` / `imageViewerRequest`）に theme が含まれないため viewer は開いたままになる。表示は clone なので破綻せず、focus 復帰先も pane region へ落ちるため安全側だが、Phase 4 で挙動を観察し違和感があれば別 TODO 化を判断する。
- `.app-shell { min-width: 680px }` は viewport 760px 以下の media query で解除される。極端に狭い window で split を有効にした場合の縮退（等幅 → `available < 2` で bounds `null` → 50/50 fallback → separator 非表示）を一度確認しておく。
- 任意の整理として、`registerMarkdownPreview` は毎 render で identity が変わるため React が ref を detach / attach し直す。挙動上の問題はないが、気になる場合は `useCallback` で安定化できる。Phase 4 のブロッカーではない。
- meta の `impl_status` と Phase 3 行は本レビュー承認をもって更新する（Phase 2 で `f98dfed` が担った完了処理と同じ扱い）。

---

## 9. 結論

Phase 3 実装は、承認済み設計の中核構造を忠実に実装している。global tab data と pane-local selection / runtime の分離、`splitView.ts` / `paneRuntime.ts` への純粋 policy 集約、App 所有 Mermaid queue と pane-scoped render ID、iframe ごとの handshake 分離と security 境界の非緩和、pane-scoped DOM ID と IDREF、計測後のみ separator を描画する ARIA 対応、旧 global state を残さない単一路線化は、いずれも設計・Phase 2 レビューの合意事項と一致する。恒久ドキュメント 11 件と実装記録・meta も実装内容と整合しており、Rust / protocol / capability / CSP / settings schema は不要に変更されていない。

初回レビューでは Medium 1 件・Low 3 件を指摘した。

### 再確認結果 (2026-07-26, commit `c8f5272`)

Round 1 fix の差分を `git show c8f5272` で確認し、更新後の `App.tsx` / `paneRuntime.ts` / `splitView.ts` / 両 test / 実装記録を読み直して 4 件すべての反映を検証した。

- **1.1 (Medium) — 解決済み**: Markdown preview を callback ref (`registerMarkdownPreview`) で live 登録し、登録 effect の依存へ `hasMarkdownPreview` を追加。fallback は `.preview-pane` div から `tabIndex={-1}` を持つ pane region (`document-pane-${paneId}`) へ変更され、`previewPaneRef` は削除された。loading 完了・theme remount・非 Markdown・unmount の 4 経路すべてで、登録先が live かつ focus 可能な要素または `null` になることを確認した。
- **3.1 (Low) — 解決済み**: `activateTab` と `openOrActivateTab` 既存 tab 分岐の無条件 clear を削除し、`reload()` は revision を更新する tab を選択している pane だけを clear する（同一 tab 両 pane 表示では両方）。残る明示 clear は選択やライフサイクルが実際に変わる経路のみで、選択切替直後の 1 render でも旧 status が新 tab へ適用されないことを表示合成側の照合で確認した。
- **3.2 (Low) — 解決済み**: `getSplitPaneWidthBounds` へ `available < 2` の `null` 返却を追加し、`min >= 1` / `max >= 1` を保証。keyboard / pointer policy が返す ratio が常に開区間 `(0, 1)` に収まり、reducer の `assertSplitRatio` へ 0 / 1 が渡らない。境界 test 3 assertion を追加。
- **3.3 (Low) — 解決済み**: `isPaneSelectionCurrent` / `isTabRevisionCurrent` を独立 pure function として公開し、`isPaneResultCurrent` を両者の合成へ変更。HTML bridge context へは `tabMatches` / `revisionMatches` を個別配線し、`documentPolicy.ts` は無改変で security 挙動も不変。独立判定 test を追加。

対応による新たな齟齬・退行・契約逸脱は検出しなかった。受け入れ条件トレース（第 4 節）は初回 △ だった 2 行を含め **全 11 行が ✓** となり、`npm test -- --run`（5 files / 71 tests）と `npm run build` の成功も本レビューで再現した。

以上より本 Phase 3 実装および恒久ドキュメント更新を **承認 (Approved)** とし、**Phase 4（検証・完了処理）への進行を可**とする。**未解決指摘は 0 件**。Phase 4 では第 8 節の注意点（指摘 1.1 / 3.1 の修正効果の実機確認、`mermaid.render` 経路の実描画、同一 Mermaid document の両 pane 表示、狭幅縮退、meta 更新）に留意すること。

---

## 10. 指摘対応 Round 1

初回レビュー4件をすべてPhase 3実装へ反映した。設計変更はなく、実装記録へ対応内容と再検証結果を追記した。

| 指摘 | severity / 工程 | 対応 | status |
| --- | --- | --- | --- |
| 1.1 preview要素登録とfocus復帰 | Medium / impl | `DocumentPane`のMarkdown previewをcallback refでlive登録し、非Markdown時は`tabIndex={-1}`を持つpane regionへfallback。loading完了・theme remount・unmountに追従する | 解決済み（再確認済み、`c8f5272`） |
| 3.1 pane status過剰clear | Low / impl | 既存tab再選択と`activateTab`の無条件clearを削除。Reloadは対象tabを選択中のpaneだけをclearし、同一tab両pane表示は両方clearする | 解決済み（再確認済み、`c8f5272`） |
| 3.2 極小幅ratio境界 | Low / impl + test | available幅2px未満でboundsを`null`に縮退。workspace 7pxでbounds / Home / pointer policyがno-opとなるtestを追加 | 解決済み（再確認済み、`c8f5272`） |
| 3.3 HTML bridge判定の縮退 | Low / impl + test | pane選択とtab revisionを独立pure functionへ分離し、stale guardは両者を合成、bridge contextは個別に配線。独立判定testを追加 | 解決済み（再確認済み、`c8f5272`） |

Round 1 の 4 件について、実装 (`c8f5272`) への反映内容が推奨対応と整合し、新たな齟齬を生じさせていないことを確認した。未解決指摘は 0 件であり、総合判定は **承認 (Approved)**。Phase 4（検証・完了処理）へ進行してよい。
