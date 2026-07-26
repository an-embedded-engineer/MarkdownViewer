# TODO-2026-006 Tauri Split view 導入 実装・恒久ドキュメントレビュー

**レビュー日**: 2026-07-26
**対象ドキュメント**: `docs/design_analysis/new_feature/20260726_tauri_split_view/impl/tauri_split_view_feature_impl.md`
**対象設計書**: `docs/design_analysis/new_feature/20260726_tauri_split_view/design/tauri_split_view_feature_design.md`
**対象設計レビュー**: `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_design_review.md`（承認済み、未解決 0 件）
**対象 meta**: `docs/design_analysis/new_feature/20260726_tauri_split_view/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-006
**レビュー対象コミット**: `810f0c3` (Phase 3 implement Tauri split view)
**判定**: **要修正 (Changes Requested)**。ブロッキング指摘 **Medium 1 件**、非ブロッキングの改善提案 **Low 3 件**。**未解決指摘 4 件**。Medium 1 件を修正後、Phase 4 へ進行可。

---

## 概要

TODO-2026-006 Phase 3 の実装・恒久ドキュメントレビュー。`810f0c3` の差分（frontend 6 ファイル、恒久 docs 11 ファイル、実装記録・meta）と更新後ファイル全体を、承認済み設計書第 7〜19 節、`docs/todo/todo.md` の受け入れ条件、`ai-review-response-workflow` の review checkpoints に照らして検証した。

実装の骨格は設計どおりである。旧 global `activeTabId` / `pendingNavigation` は完全に除去され（`App.tsx` 内の該当識別子はすべて `PaneState.activeTabId` / `pane.pendingNavigation` への参照）、single / split とも `SplitViewState` + `DocumentPane` の単一経路へ収束している。`splitView.ts`（254 行 / 純粋 policy）と `paneRuntime.ts`（87 行 / guard と表示 state 合成）は React・DOM・Tauri・Mermaid へ依存せず、設計 §9.4 / §9.5 の責務どおりに分離されている。Mermaid は App instance 所有 queue で直列化され、`mermaid.render` に `paneId + tabId + revision + index` を含む一意 ID を渡すことで、設計 §10.1 が要求した「同一 document 内での生成 ID 一意性」を実装レベルで確定させている（`securityLevel: "strict"` は維持）。HTML bridge は pane ごとの `event.source` 照合・pane-local duplicate guard・pane runtime への ready / timeout 反映で分離され、active pane 条件は security 判定へ入っていない。Rust command、custom protocol、capability、CSP、settings schema は一切変更されていない（`810f0c3` に `src-tauri/` の差分なし）。

恒久ドキュメントは README 2 種、`project_overview.md`、architecture 3 種、component docs 4 種、`development_workflow.md` の 11 ファイルが更新され、記載内容と実装の対応を個別に照合した範囲で不整合は検出しなかった。

一方、次の 1 点はブロッキングとして修正が必要である。

- pane の preview 要素登録 effect の依存配列が `[paneId, selectedTab?.id, selectedTab?.revision]` のみで、Markdown 本文が到着して `MarkdownPreview` が mount しても再登録されない。新規に開いた tab では `panePreviewElementsRef` が focusable でない `.preview-pane` div を指したままになり、pointer 起点の image viewer を閉じた時に focus が preview へ戻らない（本コミットで更新した `interface_spec.md` の契約と不一致）。

Low 指摘は、pane preview status を必要以上に clear する 3 経路、極小幅における width policy の throw、HTML bridge context の 2 フィールドが同一述語へ縮退している点である。

---

## 1. 齟齬・不整合

### 1.1 preview 要素の登録が document 読み込み前で固定され、pointer 起点 image viewer の focus 復帰が働かない

**severity**: Medium（ブロッキング）
**工程**: Phase 3（実装修正）
**status**: open

**根拠**:

`DocumentPane` は preview 要素を effect で App へ登録する。

```tsx
// App.tsx:2173-2176
useEffect(() => {
  onPreviewElement(paneId, previewRef.current ?? previewPaneRef.current);
  return () => onPreviewElement(paneId, null);
}, [paneId, selectedTab?.id, selectedTab?.revision]);
```

新規 tab を開く経路では、この effect が最初に走る時点で tab は `loadState: "loading"` かつ `sourceText === null` である（`App.tsx:654-669`）。このとき `DocumentPane` は `preview-empty` を描画しており `previewRef.current` は `null` なので、fallback の `previewPaneRef.current`（`.preview-pane` div、`App.tsx:2311-2317`）が登録される。

その後 `loadTab` が `sourceText` を設定して `MarkdownPreview` が mount しても、この effect の依存値（`paneId` / `selectedTab.id` / `selectedTab.revision`）は変化しないため**再登録されない**。同じ `DocumentPane` 内の Mermaid effect は依存に `selectedTab?.plantUmlDiagrams` を含む（`App.tsx:2255-2261`）ため読み込み完了時に再実行されるのに対し、登録 effect だけが取り残されている。

結果として `panePreviewElementsRef.current[paneId]` は `.markdown-body`（`tabIndex={-1}`、`App.tsx:2634-2640`）ではなく `.preview-pane` div を指し続ける。この div は `tabIndex` を持たない非 focusable 要素であるため、

- `closeImageViewer` が pointer 起点で選ぶ復帰先（`App.tsx:788-796`）、
- focus 復帰 effect の `focusReturn.focus()`（`App.tsx:1154-1155`）、
- 起点が切断済みの場合の fallback `panePreviewElementsRef.current.primary?.focus()`（`App.tsx:1157`）

がいずれも no-op となり、image viewer を閉じた後の focus が preview へ戻らず body へ落ちる。keyboard 起点（`focusOrigin` = 起点 button）は影響を受けないが、pointer 起点は新規 open 直後の tab で常にこの状態になる。いったん別 tab へ切り替えて戻すと id が変わって再登録されるため、再現条件は「その tab を開いてから一度も pane の選択 tab を切り替えていない」場合である（通常の利用導線そのもの）。

**影響する契約**:

- 本コミットで更新した `docs/components/tauri_viewer/interface_spec.md`「keyboard 起点では発生元 pane の起点 button、**pointer 起点では発生元 preview へ focus を戻す**。…接続済み起点がなければ primary pane へ focus を戻す」。
- 同 `detail_design.md`「close 後は keyboard 起点なら button、pointer 起点なら発生元 Markdown preview へ focus を戻し、復帰先が detach 済みなら primary pane へ fallback する」。
- 設計書 §10.3 / §19-8、`docs/rules/development_workflow.md` の image viewer focus 手動確認項目。

**推奨対応**: 登録 effect が preview 要素の実体変化に追従するようにする。最小修正は依存配列へ描画実体の切り替わりを表す値を加えることで、Mermaid effect と同じ `selectedTab?.plantUmlDiagrams` を足すか、より意図が明確な `selectedTab?.documentType` と `selectedTab?.sourceText !== null`（または `previewRef.current` を設定する ref callback 方式）を用いる。あるいは登録 ref を廃し、`closeImageViewer` 側で発生元 pane の live な preview 要素を取得する形にしてもよい。いずれの場合も、`.preview-pane` へ fallback するときは focus 可能な要素（pane region `document-pane-${paneId}` は `tabIndex={-1}` を持つ）を選ぶか、fallback 先が focusable であることを保証すること。修正後は §19-8 の手動確認（pointer 起点 close で発生元 preview へ復帰、secondary unmount 時は primary へ fallback）で実挙動を確認する。

---

## 2. ドキュメント不足

恒久ドキュメントの不足は検出しなかった。設計 §17 が予定した更新先 11 件はすべて更新され、記載と実装を個別に照合した範囲で齟齬はない（第 5 節の確認表を参照）。実装記録 `impl/tauri_split_view_feature_impl.md` も、設計からの具体化 2 点（`mermaid.run` → `mermaid.render` + pane-scoped ID、separator を計測後だけ描画）と非変更範囲（Rust / protocol / capability / CSP / settings schema）を明示しており、Phase 2 レビュー第 7 節の注意点に対する回答になっている。meta の `impl_status: draft` / Phase 3「Draft implementation complete; review pending」も現状と一致する。

---

## 3. 改善提案

### 3.1 pane preview status を選択変更のない経路でも clear しており、pane の error 表示が消える

**severity**: Low
**工程**: Phase 3（実装修正）
**status**: open

**根拠**: `PanePreviewStatus` を `null` にする経路が 3 つある。

- `activateTab`（`App.tsx:760-763`）と `openOrActivateTab` の既存 tab 分岐（`App.tsx:645-651`）は、選択が変わらない場合でも無条件に clear する。すでに選択中の tab を再度 click する、あるいは Explorer で表示中の file を再選択すると、pane status が `null` になる。
- `reload()`（`App.tsx:634-635`）は active pane の tab だけを再読込するにもかかわらず、primary / secondary 両方の status を clear する。

いずれの場合も、`DocumentPane` の Mermaid effect（依存: `paneId` / tab id / revision / `plantUmlDiagrams` / `theme`）と `HtmlPreview` の effect（依存: pane / tab / revision / URL）は依存値が変わらないため**再実行されず**、status が再設定されない。したがって、

- HTML handshake timeout 後にその tab を再 click すると、TabStrip の `Error` label（`App.tsx:2453-2463`）と ErrorBanner（`App.tsx:212-217`）が消える一方、iframe は失敗したままになる。
- 一方の pane で Mermaid error が出ている状態で他方の pane を Reload すると、無関係な pane の error 表示だけが消える。

設計 §8.4 は「同一 tab が両 pane に表示されている場合は…pane runtime は両方 clear し」と限定しており、異なる tab を表示する pane まで clear することは求めていない。また `App.tsx:1163-1173` の stale status clear effect が identity 不一致の status を既に落とすため、これらの明示 clear は本来不要である。

**推奨対応**: `activateTab` / `openOrActivateTab` の clear を「pane の選択 tab が実際に変わった場合」に限定するか、`App.tsx:1163-1173` の identity ベース clear に委ねて明示 clear を削除する。`reload()` は、revision を更新した tab を選択している pane（同一 tab を両 pane が表示している場合は両方）だけを clear する。

### 3.2 極小幅で width policy が ratio 0 / 1 を生成し、event handler から throw しうる

**severity**: Low
**工程**: Phase 3（実装修正）または Phase 4（境界 test 追加）
**status**: open

**根拠**: `getSplitPaneWidthBounds` は `workspaceWidth > splitSeparatorWidth`（6px）であれば bounds を返し、`min = Math.min(240, Math.floor(available / 2))` を用いる（`splitView.ts:164-177`）。`available = workspaceWidth - 6 ≤ 1` の場合、`min = 0` / `max = available` となる。この状態では `min !== max` のため `getSplitRatioForKey`（`splitView.ts:204-238`）が keyboard 操作を受け付け、`Home` は `0 / available = 0`、`End` は `available / available = 1` を返す。返り値は `applySplitView({ type: "set-requested-ratio", ratio })`（`App.tsx:388-399`）へ渡り、`assertSplitRatio` が `0 < ratio < 1` を要求して throw する（`splitView.ts:246-250`）。同様に pointer drag も `getRequestedRatioForPrimaryWidth` 経由で 0 / 1 を返しうる（`splitView.ts:191-202`）。

throw は React の keydown / pointermove handler 内で発生するため、graceful な no-op ではなくアプリ全体のクラッシュになる。発生条件は preview workspace の実幅が 6px 超 8px 未満という極端な帯域で、`.app-shell { min-width: 680px }`（viewport 760px 以下では解除）と Explorer の最小 180px を踏まえると実運用ではほぼ到達しない。ただし同一 module 内で「bounds を作る条件」と「ratio として受理する条件」が境界で食い違っており、設計 §7.3 / §9.4 が意図した「正当な UI state は throw させない / programming error だけ throw する」という切り分けから外れる。`splitView.test.ts` の width test（`splitView.test.ts:176-205`）も `available ≤ 1` を扱っていない。

**推奨対応**: `getSplitPaneWidthBounds` の返却条件を「両 pane に 1px 以上を割り当てられる幅（例: `available >= 2` かつ `min >= 1`）」へ狭めて `null` を返し、計測前と同じ 50/50 CSS fallback へ倒す。あるいは `getSplitRatioForKey` / `getRequestedRatioForPrimaryWidth` の返り値を `(0, 1)` の開区間へ clamp する。いずれの場合も `splitView.test.ts` へ `getSplitPaneWidthBounds(7)` 相当の境界 case と、その幅での `Home` / `End` / drag が throw せず no-op になることを追加する。

### 3.3 HTML bridge context の `tabMatches` と `revisionMatches` が同一述語へ縮退している

**severity**: Low
**工程**: Phase 3（実装修正）
**status**: open

**根拠**: `HtmlPreview` は `evaluateHtmlBridgeMessage` の context へ次を渡す（`App.tsx:2702-2710`）。

```ts
tabMatches: isCurrent(paneId, tabId, revision),
revisionMatches: isCurrent(paneId, tabId, revision),
```

`isPaneResultCurrent`（`paneRuntime.ts:33-48`）は「pane が split mode 上で有効」「pane の選択 tab が一致」「その id と revision を持つ tab が存在」をまとめて判定するため、現時点の判定強度は従来（`activeTabId === tabId` と `activeRevision === revision` の 2 条件、旧 `App.tsx:2199-2200`）と同等以上であり、**security 上の緩和はない**。`documentPolicy.ts:84-87` は両者の論理積しか見ないため挙動も同じである。

問題は契約の可読性と将来の安全余裕である。`HtmlBridgeContext` は tab 同一性と revision 同一性を独立した入力として定義しており（`documentPolicy.ts:16-24`）、同じ値を 2 度渡すとこの分離が実質失われる。`isPaneResultCurrent` は本来 pane runtime の stale guard 用 API であり、そこから pane 選択条件が外れるような将来変更があった場合、security 判定 2 項が同時に緩む。

**推奨対応**: security context には意味どおりの述語を渡す。例えば `tabMatches: pane.activeTabId === tabId`、`revisionMatches: tabs.some((t) => t.id === tabId && t.revision === revision)` を `paneRuntime.ts` の小さな pure 関数として公開し（`isPaneResultCurrent` はその論理積として実装）、`HtmlPreview` からは分けて渡す。これにより `documentPolicy.test.ts` が持つ tab / revision 個別の回帰契約が App 側の配線でも保たれる。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` TODO-2026-006 完了条件 | 実装・test・docs | 結果 |
| --- | --- | --- |
| View メニューから single / 左右 2 pane split を切り替えられ、切替後も有効な表示対象と active pane が保たれる | `MenuBar` の `role="menuitemcheckbox"` + `aria-checked`（`App.tsx:1865-1873`）、`toggleSplitView`（`App.tsx:864-876`）、`enable-split` / `disable-split`（`splitView.ts:81-112`）、test「selects the right adjacent tab」「does not erase primary when an empty secondary is active」「falls back to the first tab only when both panes are empty」 | ✓ 整合 |
| primary / secondary pane に同一 root 内の異なる open tab を選択して同時表示できる | `preview-grid` と 2 つの `DocumentPane`（`App.tsx:1261-1345`）、pane-local `TabStrip`（`App.tsx:2302-2310`）、tab data は複製しない（`tabs` は single source） | ✓ 整合 |
| Explorer 選択、tab activate、Reload、relative Markdown link は active pane を対象とし、他方の pane selection を意図せず変更しない | Explorer は `splitViewState.activePaneId` へ open（`App.tsx:1227-1229`）、`reload` は active pane の tab のみ revision 更新（`App.tsx:623-637`）、link / anchor は発生元 pane（`App.tsx:798-862`, `2263-2289`）、`select-tab` は当該 pane だけ更新（`splitView.ts:62-77`） | ✓ 整合 |
| tab close、最後の tab close、root 変更、split off / on 後も各 pane が残存 tab または未選択状態へ一貫して復旧する | `closeTab`（`App.tsx:765-786`）+ `remove-tab`（`splitView.ts:113-127`）、`reset-root`（`splitView.ts:128-134`）、最後の tab close で pane region へ focus（`App.tsx:2430-2437`）、test「updates every pane that references a closed tab」「keeps mode and ratio while resetting root selection」 | ✓ 整合 |
| 各 pane で Markdown preview、相対画像、Mermaid、PlantUML、trusted HTML、anchor、独立 scroll、loading / error 表示が破綻せず、非同期結果が他 pane / tab へ混線しない | pane 固有 ref / key（`App.tsx:2318-2348`）、App 所有 Mermaid queue と pane-scoped render ID（`App.tsx:325-329, 2197-2249`）、`isPaneResultCurrent` guard、TabStrip 合成（`paneRuntime.ts:59-87` / `App.tsx:2447-2463`）、`paneRuntime.test.ts` の混線 test | △ 条件付き。混線防止と表示合成は成立するが、指摘 3.1 により pane error 表示が選択非変更の再 click / 他 pane の Reload で消える |
| split 表示でも HTML iframe の sandbox / CSP / root boundary / external link policy と Markdown の raw HTML 禁止を維持する | `sandbox="allow-scripts"` と `referrerPolicy` 維持（`App.tsx:2733-2742`）、`event.source` 一致・opaque origin・ready・activation・duplicate・scheme は `documentPolicy.ts` 不変、`renderMarkdown` の `html: false` 不変、`src-tauri` 差分なし | ✓ 整合（context 配線の明瞭さのみ指摘 3.3） |
| pane 幅変更または window / Explorer resize 後も preview が幅へ追従し、Mermaid が source 表示へ戻らず、PlantUML と HTML iframe が不必要に再読み込みされない | `preview-grid` の CSS 変数幅、`MarkdownPreview` の memo 維持（`App.tsx:2624-2631`）、iframe key = `paneId + tabId + revision`（`App.tsx:2331`）で theme / ratio / Explorer 幅では不変、PlantUML は tab 単位 cache のまま | ✓ 整合 |
| keyboard だけで split toggle、pane / tab 選択、pane 間移動、separator 操作へ到達でき、focus indicator と accessible name / role / state が確認できる | `menuitemcheckbox`、pane-scoped ID（`tab-${paneId}-${id}` / `document-preview-${paneId}` / `document-pane-${paneId}`）、split separator の `aria-controls` と min / max / now（`App.tsx:1297-1314`）、roving tabindex（`App.tsx:2480`）、`.document-pane[data-active="true"]` と `:focus-visible`（App.css） | ✓ 整合 |
| single view の既存 Multi-tab、Markdown / HTML、image viewer、MenuBar / StatusBar、Settings、Recent Folders の操作が退行しない | single も primary `DocumentPane` の同一経路、Explorer separator の `aria-controls` を `preview-workspace` へ更新、既存 test 3 種（documentPolicy / imageViewer / explorerPane）は無改変で通過 | △ 条件付き。指摘 1.1 により pointer 起点 image viewer の focus 復帰が退行 |
| `npm test` / `npm run build` / `cargo check` が成功する（success_metrics） | 本レビューで `npm test -- --run`（5 files / 70 tests passed）と `npm run build`（成功）を再実行して確認。`src-tauri` に差分がないため `cargo check` / `cargo test` の結果は Phase 2 時点から不変 | ✓ 整合 |
| 手動確認項目が定義されている（success_metrics 3〜5 行目） | `development_workflow.md` へ split 切替 / pane 別 tab 選択 / separator 操作 / close・root 復旧 / 同一 Mermaid 両 pane / HTML split / secondary image viewer の 8 項目を追加、実装記録 §6 に Phase 4 観点 | ✓ 整合 |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| 旧 global state の除去（設計 §15） | ✓ 整合。`App.tsx` に残る `activeTabId` / `pendingNavigation` の識別子はすべて `PaneState` 経由（`App.tsx:194, 769, 785, 1138, 2169, 2264-2305` ほか）で、single 専用 state / handler は存在しない。single も `DocumentPane` primary を通る |
| `splitView.ts` の遷移契約（設計 §7.3, §8.1, §8.2） | ✓ 整合。`enable-split` は primary 維持 + 右隣→左隣→`null`（`findAdjacentTabId`）、primary 未選択なら secondary も `null`。`disable-split` は「active pane が選択済みの時だけ引き継ぎ / 未選択なら primary 維持 / 両方未選択かつ tab ありで先頭 fallback」を実装（`splitView.ts:95-112`）し、Phase 2 指摘 1.1 の修正内容と一致 |
| `remove-tab` / `reset-root` / `consume-navigation`（設計 §7.3, §8.6, §8.7） | ✓ 整合。closed ID を参照する pane だけ fallback へ移し、他 pane の pending navigation も closed ID の時だけ落とす。`reset-root` は mode / ratio を維持。`consume-navigation` は pane + tab + anchor 一致時だけ state を変え、不一致では同一 object を返して再 render を誘発しない |
| width policy（設計 §12.2, §9.4） | ✓ 概ね整合。`number \| null` 契約、未計測 / 非 finite / separator 幅以下は `null`、`min = min(240, floor(available / 2))`、`max = available - min`、自動 clamp を ratio へ書き戻さない、`min === max` で keyboard / drag を no-op とする挙動を実装・test 済み（極小幅の境界のみ指摘 3.2） |
| 計測前 50/50 と separator の ARIA（Phase 2 残リスク 1 点目） | ✓ 解決。`.preview-grid.split:not(.measured)` が `repeat(2, minmax(0,1fr))`、separator は `splitWidthBounds && primaryPaneWidth !== null` の時だけ描画（`App.tsx:1297`）。値を持たない focusable `role="separator"` が生じない |
| Mermaid 直列 queue と生成 ID（設計 §5.4, §10.1 / Phase 2 残リスク 2 点目） | ✓ 解決。`mermaidQueueRef` の Promise chain で直列化し（`App.tsx:325-329`）、`mermaid-${paneId}-${tabId}-${revision}-${index}` を `mermaid.render` へ渡す。task 前後で `isCurrent` と `node.isConnected` を確認し、`securityLevel: "strict"` を毎回指定。`deterministicIds` は未使用。実装記録 §3 に具体化理由を明記 |
| Mermaid effect の lifecycle | ✓ 整合。cleanup で `cancelled = true` と `adapter.cleanup()`。React StrictMode の二重実行では 1 回目の task が `cancelled` で即 return し、2 回目だけが描画する。描画後に `adapter.decorate()` と `data-processed="true"` を付与し image viewer decoration 契約を維持 |
| pane runtime guard（設計 §9.5） | ✓ 整合。`isPaneResultCurrent` が split mode / pane 選択 / tab id / revision を判定し、`updatePanePreviewPhase`（`App.tsx:306-323`）と Mermaid / HTML callback がすべて経由する。`App.tsx:1163-1173` の effect が identity 不一致の status を落とす |
| TabStrip の shared / pane-local 合成（設計 §7.2） | ✓ 整合。`resolvePaneTabPresentationState` が shared `loading` / `rendering` / `error` を優先し、shared `ready` かつ当該 pane で選択中・identity 一致の時だけ pane phase を写像する。非選択 tab や identity 不一致では shared 値のみ。`paneRuntime.test.ts` が両 pane 同一 tab の片 pane error 非混線まで検証 |
| HTML tab の `loadState` 前倒し（設計 §11） | ✓ 整合。`loadTab` は previewUrl 受領時点で `ready`（`App.tsx:678-687`）とし、旧 `markHtmlReady` / `markHtmlError` は削除済み。handshake 中の Loading と timeout Error は pane runtime 経由で TabStrip / StatusBar / ErrorBanner に出る |
| HTML security 境界（設計 §11） | ✓ 整合。iframe ごとの ref / ready flag / timeout / duplicate guard、`event.source === iframeRef.current?.contentWindow`、`origin` / shape / activation / scheme は `documentPolicy.ts` 不変。active pane 条件は判定へ入っておらず、非 active pane からの正当な click も許可される。pane 活性化は `onFocus` と external-open 受信時の `onActivity` で行い security とは分離 |
| image viewer の pane identity（設計 §10.3） | ✓ 整合（focus 復帰先の実体は指摘 1.1）。`PaneImageViewerRequest` は交差型で `paneId` を付与し `imageViewer.ts` は無改変。close 条件に split off（secondary + `mode !== "split"`）、pane 選択変更、tab / revision 変更、`visual.isConnected` を含む（`App.tsx:1130-1145`） |
| Explorer / split の pointer lifecycle 分離（設計 §12.3） | ✓ 整合。`SplitResizeState` と `splitResizeRef` を Explorer と独立に持ち、`setPointerCapture` / `lostpointercapture` / cancel を対称に処理。`.split-resizing` が cursor と user-select を固定し、`toggleSplitView` で single へ戻る際に resize state を解除 |
| 既存 CSS 契約の維持（Phase 2 指摘 3.4） | ✓ 整合。`.markdown-body` の `calc(100% - 48px)` と viewport 760px の gutter media query、`.tab-item { width: min(220px, 32vw) }`、`.html-preview-frame` の全幅、Explorer separator の挙動はいずれも無改変。`interface_spec.md` / `detail_design.md` にも pane 基準と viewport 基準の分離が明記されている |
| pane-scoped DOM ID と IDREF（Phase 2 指摘 3.1） | ✓ 整合。`tab-${paneId}-${id}` / `document-preview-${paneId}` / `document-pane-${paneId}` を実装し、旧 `document-preview` は残っていない。Explorer separator は `explorer-pane preview-workspace`、split separator は `document-pane-primary document-pane-secondary` を参照し、いずれの ID も実在する |
| 非対象範囲の遵守 | ✓ 整合。3 pane 以上 / 上下分割 / drag and drop / reorder / pin / layout 永続化 / scroll 復元は未実装。`src-tauri`、`tauri.conf.json`、`capabilities/`、settings schema に差分なし |
| 型安全性 | ✓ 整合。`PaneId` / `ViewMode` / `SplitViewAction` の discriminated union、`SplitPaneWidthBounds \| null`、`PanePreviewPhase` の網羅 switch（`paneRuntime.ts:76-86`）を使い、`any` / 非 null assertion / 型 cast の追加はない。`npm run build` の TypeScript compile も成功 |
| 恒久ドキュメントと実装の一致 | ✓ 整合。`interface_spec.md` の StatusBar 文言（`Loading HTML preview...` / `Rendering Mermaid diagrams...`）は `App.tsx:228-231` と一致、Split View 節の幅式・separator 描画条件・split off 規則も実装と一致。`detail_design.md` の state 表（`splitViewState` / `panePreviewStatuses` / `splitWorkspaceWidth` / `isSplitResizing`）、`basic_design.md` の `SplitViewState` field 表、`code_patterns.md` / `common_pitfalls.md` の追記、`README` 2 種、`project_overview.md`、`development_workflow.md` の手動確認追加も実装範囲と対応する |
| 実装記録・meta | ✓ 整合。設計との対応表、設計からの具体化 2 点、変更ファイル一覧、自動検証結果、Phase 4 手動確認事項が実際の差分と一致。meta の `impl_status: draft` と Phase 3「review pending」も現状に一致 |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 | ブロッキング |
| --- | --- | --- | --- |
| 高 | 1.1 preview 要素登録の stale により pointer 起点 image viewer の focus 復帰が働かない | 新規に開いた tab という通常導線で発生し、本コミットで更新した `interface_spec.md` / `detail_design.md` の契約および設計 §10.3 と不一致。修正は依存配列または取得方法の変更で完結する | 是 |
| 低 | 3.1 選択非変更の経路と他 pane の Reload で pane status を clear し error 表示が消える | 表示が実態より良く見える方向の欠落で、effect が再実行されないため回復もしない。identity ベースの clear が既にあるため明示 clear は縮小できる | 否 |
| 低 | 3.2 極小幅で ratio 0 / 1 を生成し event handler から throw する | 実運用でほぼ到達しない帯域だが、同一 module 内で bounds 生成条件と ratio 受理条件が矛盾し、失敗形が no-op ではなく throw になる。境界 test も無い | 否 |
| 低 | 3.3 HTML bridge context の 2 フィールドが同一述語へ縮退 | 現時点で security 緩和はないが、`documentPolicy.ts` が分離している 2 条件が App 側の配線で 1 つになり、将来 `isPaneResultCurrent` を変更した際に両方が同時に緩む | 否 |

---

## 7. 検証評価

本レビューで次を再実行し、実装記録 §5 の記載と一致することを確認した。

| コマンド | 結果 |
| --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | 成功。5 files / 70 tests passed（実装記録と一致） |
| `cd markdown-viewer-tauri && npm run build` | 成功。TypeScript compile と Vite build 完了。警告は既存の large chunk のみ |
| `git show 810f0c3 --stat -- markdown-viewer-tauri/src-tauri` | 差分なし。`cargo check` / `cargo test`（22 tests）の結果は Phase 2 時点から不変であり、再実行の必要がないことを確認 |

test 内容の評価:

- `splitView.test.ts`（16 case）は初期 state、隣接 tab 選択（右 / 左 / 1 tab / primary 未選択）、pane-local selection と pending navigation、consume guard の同一参照返却、split off の 3 分岐（選択済み引き継ぎ / 空 active で primary 維持 / 両 pane 空で先頭 fallback）、close の全 pane 更新、root reset の mode / ratio 維持、ratio validation、width bounds（未計測 / NaN / separator 幅、通常幅、狭幅 min=max、clamp 非書き戻し）、keyboard 4 種と無関係 key を検証しており、設計 §18.1 の列挙をほぼ網羅する。
- `paneRuntime.test.ts` は pane / tab / revision 一致、split off 後の secondary result 拒否、tab close・選択変更後の status 拒否、shared 優先、pane phase の写像 4 種、同一 tab 両 pane での error 非混線、非選択 tab / stale revision の無視を検証しており、Phase 2 指摘 1.3 の要求と一致する。
- 既存 `documentPolicy.test.ts` / `imageViewer.test.ts` / `explorerPane.test.ts` は無改変で通過し、security / image / Explorer の回帰契約が保たれている。

自動化されていない範囲は妥当に明示されている。React DOM lifecycle、Mermaid 実描画と SVG ID の実衝突、iframe handshake、pointer capture、focus 復帰、CSS layout は Vitest（DOM 非依存の pure policy 構成）では検証できず、実装記録 §6 と `development_workflow.md` の追加項目、設計 §19 の 11 シナリオへ委ねられている。ただし指摘 1.1 の focus 復帰は、まさにこの手動確認に委ねられた領域で発生する欠陥であり、Phase 4 の手動確認前に修正しておく必要がある。

未カバーで Phase 4 の観察に委ねられる pure policy の境界は、`available ≤ 1` の width bounds（指摘 3.2）、`getPaneState` の不正 pane ID throw、`select-tab` の `tabId: null` 経路である。いずれも実装上の主要導線ではない。

---

## 8. 残リスク / Phase 4 での注意点

- 指摘 1.1 を修正後、`development_workflow.md` の image viewer 手動確認（pointer 起点 close で pill / outline が出ないこと、keyboard 起点だけ button へ戻ること）と、新規追加項目「secondary の画像 viewer を開いた状態で tab close または split off し、viewer が閉じて接続済み起点または primary pane へ focus が戻ること」を、**新規に開いた直後の tab**でも実施する。
- `mermaid.render` への移行は本 Phase で初めて導入した描画経路である。Mermaid の error 時に container へ error graphic が残る可能性、`bindFunctions` の再適用、PlantUML 併存 document での順序を Phase 4 の実描画で確認する。`sample_docs/plantuml.md` に加え、同一 Mermaid document を両 pane へ表示する新規手動項目を必ず実行する。
- image viewer 表示中に Theme を切り替えると `MarkdownPreview` の key が変わり発生元 visual が DOM から切断されるが、close 判定 effect の依存（`splitViewState` / `tabs` / `imageViewerRequest`）に theme が含まれないため viewer は開いたままになる。表示は clone なので破綻しないが、Phase 4 で挙動を観察し、違和感があれば別 TODO 化を判断する。
- `.app-shell { min-width: 680px }` は viewport 760px 以下の media query で解除される。極端に狭い window で split を有効にした場合の縮退（等幅 → bounds `null` → 50/50 fallback → separator 非表示）を Phase 4 で一度確認しておくと、指摘 3.2 の実到達可能性も併せて判断できる。
- pane preview status は `App.tsx:1163-1173` の identity guard で回収されるが、指摘 3.1 の明示 clear を縮小する場合は、Reload 直後に同一 tab を両 pane で表示しているケースで両 pane が再描画されることを手動で確認する。

---

## 9. 結論

Phase 3 実装は、承認済み設計の中核構造をほぼ忠実に実装している。global tab data と pane-local selection / runtime の分離、`splitView.ts` / `paneRuntime.ts` への純粋 policy 集約、App 所有 Mermaid queue と pane-scoped render ID、iframe ごとの handshake 分離と security 境界の非緩和、pane-scoped DOM ID と IDREF、計測後のみ separator を描画する ARIA 対応、旧 global state を残さない単一路線化は、いずれも設計・Phase 2 レビューの合意事項と一致する。恒久ドキュメント 11 件と実装記録・meta も実装内容と整合しており、Rust / protocol / capability / CSP / settings schema は不要に変更されていない。frontend 70 tests と production build は本レビューでも再現できた。

一方、次の 1 件はブロッキングとして Phase 3 で修正が必要である。

- **1.1 (Medium)**: preview 要素の登録 effect が読み込み完了時に再実行されず、新規に開いた tab では非 focusable な `.preview-pane` が登録される。pointer 起点 image viewer の focus 復帰と primary fallback が no-op になり、本コミットで更新した `interface_spec.md` / `detail_design.md` および設計 §10.3 の契約を満たさない。

加えて、pane status の過剰 clear による error 表示の消失（3.1）、極小幅での ratio 0 / 1 生成による throw（3.2）、HTML bridge context の 2 フィールド縮退（3.3）を Low として指摘した。いずれも Phase 3 で併せて対応するか、対応方針を実装記録へ記録すれば足りる。

受け入れ条件トレース（第 4 節）は 11 行中 9 行が ✓、2 行が指摘 1.1 / 3.1 に起因する △（条件付き）である。

以上より本 Phase 3 実装を **要修正 (Changes Requested)** とし、指摘 1.1 の修正後に再レビューを行うこととする。**未解決指摘は 4 件（Medium 1 / Low 3）**。

---

## 10. 指摘対応 Round 1

初回レビュー4件をすべてPhase 3実装へ反映した。設計変更はなく、実装記録へ対応内容と再検証結果を追記した。以下のstatusは実装担当による対応状態であり、最終判定はfollow-up reviewで確定する。

| 指摘 | severity / 工程 | 対応 | status |
| --- | --- | --- | --- |
| 1.1 preview要素登録とfocus復帰 | Medium / impl | `DocumentPane`のMarkdown previewをcallback refでlive登録し、非Markdown時は`tabIndex={-1}`を持つpane regionへfallback。loading完了・theme remount・unmountに追従する | 対応済み（再レビュー待ち） |
| 3.1 pane status過剰clear | Low / impl | 既存tab再選択と`activateTab`の無条件clearを削除。Reloadは対象tabを選択中のpaneだけをclearし、同一tab両pane表示は両方clearする | 対応済み（再レビュー待ち） |
| 3.2 極小幅ratio境界 | Low / impl + test | available幅2px未満でboundsを`null`に縮退。workspace 7pxでbounds / Home / pointer policyがno-opとなるtestを追加 | 対応済み（再レビュー待ち） |
| 3.3 HTML bridge判定の縮退 | Low / impl + test | pane選択とtab revisionを独立pure functionへ分離し、stale guardは両者を合成、bridge contextは個別に配線。独立判定testを追加 | 対応済み（再レビュー待ち） |

対応後の確認は`npm test -- --run`が5 files / 71 tests成功、`npm run build`が成功（既存large chunk warningのみ）。実装担当側の未分類・未対応項目は0件。
