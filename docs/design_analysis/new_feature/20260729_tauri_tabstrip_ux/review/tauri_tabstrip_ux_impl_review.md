# TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善 実装レビュー

**レビュー日**: 2026-07-29
**レビュー対象コミット**: `031c06a` (Phase 3 implement Tauri TabStrip UX improvements)
**対象実装**: `markdown-viewer-tauri/src/App.tsx`、`App.css`、`tabStrip.ts`、`tabStrip.test.ts`、`paneRuntime.ts`、`paneRuntime.test.ts`
**対象設計**: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/design/tauri_tabstrip_ux_feature_design.md`
**対象実装記録**: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/impl/tauri_tabstrip_ux_feature_impl.md`
**対象恒久docs**: `docs/components/tauri_viewer/`（README / basic_design / detail_design / interface_spec）、`docs/architecture/code_patterns.md`、`docs/architecture/common_pitfalls.md`、`docs/rules/development_workflow.md`、`docs/tests/README.md`
**Phase 2 設計レビュー**: `./tauri_tabstrip_ux_design_review.md`（初回 17 件解決済み、持越し 3 件）

**Round 1 fix コミット**: `ddc7e86` (Phase 3 address Tauri TabStrip UX implementation review)
**Round 1 再確認日**: 2026-07-29

**初回判定**: 条件付き差し戻し (Changes Requested)。blocking Medium 1 件 / non-blocking Low 3 件 = 検出 4 件。
**最終判定**: **承認 (Approved)**。**Phase 4-a 進行可**。初回 4 件は Round 1 fix (`ddc7e86`) ですべて解決済みと再確認した。再確認で新規指摘は無く、**未解決 0 件**。自動検証 5 種と `git diff --check` もレビュー担当で再実行し記録と一致した。

---

## 概要

`git show 031c06a` の全差分（17 files、+806 / −74）、改訂後の実装全文、設計書、実装記録、恒久docs を突き合わせ、new-feature Phase 3 の review checkpoints（設計との一致、責務・重複経路、境界条件、既存機能回帰、test、docs 同期、検証記録）で検証した。自動検証は当方でも再実行し、記録どおりの結果を確認した。

実装の骨格は設計どおりである。

- `tabStrip.ts` は `getTabRevealDelta` / `hasExceededTabDragThreshold` / `resolveTabDropPane` の 3 関数だけを持ち、DOM・React・`document` に触れない。module-global mutable state も無く、既存 5 policy module と同じ pattern に収まっている（`tabStrip.ts:1-63`）。
- reveal delta は「item 幅が viewport 超過」または「左欠け」を左端優先、「右欠け」を右端合わせで返し、完全表示は 0（`tabStrip.ts:23-33`）。設計 §7.2 の 4 規則と一致し、非 finite / 逆転 geometry は throw する（同 5-21）。silent fallback は無い。
- drag は `pointerType === "mouse"`、`isPrimary`、`button === 0`、split mode、未開始 session、activate button 本体からの pointerdown だけを受理する（`App.tsx:handleTabPointerDown`）。touch / pen は session を作らないため、TabStrip の horizontal pan と tap activate が従来どおり残る。
- drop 判定は capture 中の target を使わず `document.elementFromPoint` → `closest("[data-tab-drop-pane]")` → `dataset` の `string | null` を `resolveTabDropPane` で narrowing し（`App.tsx:getTabDropPaneAtPoint`）、pointerup でも同じ関数で再判定してから `moveTab` を 1 回だけ呼ぶ（`handleTabPointerUp`）。session の `dropPaneId` は feedback 専用で drop 確定に使っていない。
- `moveTab(sourcePaneId, destinationPaneId, tabId)` は drag と move button の唯一の integration point で、`splitView.ts` は 1 行も変更されていない。move 前に `splitViewRef.current` で split mode と source membership を再確認し、不整合時は reducer の throw に委ねている。
- pointermove では React state を更新せず、preview の座標は DOM `transform` へ直接反映する。`setTabDragPresentation` / `setTabDragStatus` は drag 開始・drop target 変更・終了だけで走る（`handleTabPointerMove`）。
- programmatic focus は TabStrip 経路 4 箇所すべてが `focus({ preventScroll: true })` で、水平位置は `revealTab`（strip rect + item rect + `scrollBy`）だけが動かす。`App.tsx` に残る `scrollIntoView` は preview 内 anchor 遷移の 1 箇所（`App.tsx:3379`）のみで、TabStrip 経路からは完全に除去されている。
- CSS は `--tab-strip-height: 40px`、`overflow-x: scroll` + WebKit pseudo-element の 6px transparent track、`.tab-item::before` による上端 indicator、reduced motion の static pattern、`.app-shell.tab-dragging` の cursor、fixed sibling layer と visually hidden live region を、設計 §6 / §7 / §9.6 の記述どおりに実装している。

指摘は 4 件で、うち blocking は 1 件である。いずれも drag lifecycle と CSS の局所修正で閉じ、設計の骨格や責務分割には影響しない。

---

## 1. 齟齬・不整合（blocking）

### 1.1 Escape cancel が click 抑止 identity を消すため、その後の button release で source tab が activate される

**severity**: Medium（blocking）
**工程**: Phase 3（実装修正 + 設計 §8.4 の 1 文修正）
**status**: 未解決

**該当箇所**: `markdown-viewer-tauri/src/App.tsx` `cancelTabDrag`（`suppressedTabClickRef.current = null;`）、`handleTabPointerUp`（session 不在時の early return）、`suppressTabClick`、Escape 用 `useEffect`。設計 §8.4「解除経路を…clickを生成しないEscape / pointercancel / unexpected lost captureの同期clearへ限定する」。

**根拠 / 差異**: Escape は drag session を終了させるが、**物理的な mouse button は押されたままである**。したがって Escape 後にも pointerup と click は必ず発生しうる。現行実装では次の順で state が変わる。

1. Escape → `cancelTabDrag()` → `tabDragSessionRef.current = null`、**`suppressedTabClickRef.current = null`**、capture release。
2. 利用者が button を release → `handleTabPointerUp` は `session` が null のため即 return。identity は再武装されない。
3. pointer が source tab item の上にあれば、mousedown / mouseup の共通祖先が source activate button になり **click が発火**する。
4. `suppressTabClick` は `suppressedTabClickRef.current` が null のため何もせず、`onClick` の `!event.defaultPrevented` を通って `onActivate(paneId, tab.id)` が走る。

結果、**非 active tab を drag → Escape で cancel → 手を離す**という操作で source pane の選択が dragged tab へ変わる。TODO-2026-026 の完了条件「cancel 時は state を変更しない」、設計 §2.3-5、§12「split解除中のpending / dragging → session cancel、state変更なし」に反する。tab の所属・順序は変わらないため破壊的ではないが、cancel したのに選択が動くのは利用者意図と逆であり、Phase 4-a matrix 7「Escape cancel」は pointer が destination strip 上にある状態で試すと再現しないため、この経路が検証をすり抜ける可能性が高い。

なお本件は Phase 2 Round 1 の指摘 8.2 で「時間依存 clear をやめ、解除経路を matching click / 次 pointerdown / **click を生成しない** unexpected lost capture の 3 つに限定する」と推奨した内容の適用時に、Escape と pointercancel が「click を生成しない」側へ分類されたことで生じている。Escape は click を生成しうる点が両者と異なる。

**推奨対応**: `cancelTabDrag` から無条件の identity clear を外し、click が発生し得ない経路（`pointercancel`、source unmount などの unexpected lost capture）だけで clear する。Escape cancel では identity を残し、後続 click で `suppressTabClick` に消費させる（消費されなければ次の pointerdown で clear される）。設計 §8.4 の該当文も「Escape では identity を維持し、後続 click が消費するか次 pointerdown で clear する」へ改める。修正後は §14-7 / §14-13 に「Escape cancel 後に手を離しても選択が変わらないこと」を確認手順として含めること。

---

## 2. 改善提案（non-blocking）

### 2.1 drag 中に 2 つ目の pointerdown が来ると click 抑止 identity が消える

**severity**: Low（non-blocking）
**工程**: Phase 3（実装修正）
**status**: 未解決

**該当箇所**: `App.tsx` `handleTabPointerDown` 冒頭の `suppressedTabClickRef.current = null;`（guard 判定より前）、`SuppressedTabClick` 型。

**根拠 / 差異**: identity の clear が全 guard より前にあるため、**drag 中に source tab 上で副ボタン（右クリック等）を押す**と `button !== 0` で early return する前に identity が消える。その後 primary button を release すると、1.1 と同じ経路で source tab が activate される。発生頻度は低いが、1.1 と同じ修正箇所であり同時に閉じられる。

あわせて `SuppressedTabClick` は `pointerId` を保持するが、`suppressTabClick` は `sourcePaneId` と `tabId` しか比較していない（click event は pointerId を持たないため比較しようが無い）。実質 dead field である。

**推奨対応**: clear を `if (!tabDragSessionRef.current) { suppressedTabClickRef.current = null; }` のように「進行中 session が無い時だけ」へ限定する。guard の後ろへ移す案は、single view へ切り替えた後の stale identity を消せなくなるため採らない。`pointerId` は比較に使わないなら型から外すか、保持理由を 1 行コメントで残す。

### 2.2 focus-visible の outline が上端 state indicator を覆う

**severity**: Low（non-blocking）
**工程**: Phase 3（CSS 修正）
**status**: 未解決

**該当箇所**: `App.css` `.tab-item::before { z-index: 1 }`、`.tab-activate:focus-visible { z-index: 1; outline: 2px solid var(--accent); outline-offset: -2px }`。

**根拠 / 差異**: `.tab-item` は grid container であり、`.tab-activate` は grid item なので `z-index` が効く。`::before` と button がともに `z-index: 1` の場合、painting order は tree order で決まり **後続の button が上に描かれる**。`outline-offset: -2px` の outline は border box の上端 0〜2px を占めるため、同じ帯にある indicator（loading / rendering / active-ready は 2px、error は 3px）を覆う。すなわち **error tab の activate button に keyboard focus がある間、赤い indicator がほぼ見えない**。

accessible name の suffix と `aria-busy` は維持されるため支援技術上の情報欠落は無く、視覚的にも focus outline 自体は明確なので影響は限定的だが、設計 §6.1 が「indicator は active 上端線より優先」と定めた意図（状態表示を他の装飾で潰さない）とは合わない。

**推奨対応**: `.tab-item::before` を `z-index: 2` にする（または focus outline の offset / 位置を調整する）。Phase 4-a の matrix 1 / 5 で、error / loading tab に focus した状態でも indicator が判別できることを確認する。

### 2.3 `pointercancel` と `lostpointercapture` の handler が完全重複している

**severity**: Low（non-blocking）
**工程**: Phase 3（任意の簡素化）
**status**: 未解決

**該当箇所**: `App.tsx` `handleTabPointerCancel` と `handleTabLostPointerCapture`（本体が同一）。

**根拠 / 差異**: 現状は同じ 3 行が 2 関数に分かれ、TabStrip / DocumentPane の props にもそれぞれ流れている。1.1 の修正で「Escape は identity を残す / pointercancel と unexpected lost capture は clear する」と分岐が入るなら、両者は同じ扱いのままなので 1 関数へまとめられる。責務上の意味が異なるという理由で分けたい場合は、その旨を短いコメントで残すと重複ではなく意図として読める。

**推奨対応**: 1 handler へ統合するか、分離理由を 1 行で明示する。挙動変更は不要。

---

## 3. Phase 2 Round 1 持越し（8.1〜8.3）の確認

| 指摘 | 実装・設計での確定内容 | 判定 |
| --- | --- | --- |
| 8.1 scrollbar API 併記による track 寸法の不確定 | `.tab-strip` から `scrollbar-width: thin` を削除し、`scrollbar-color` も設定せず、`::-webkit-scrollbar { height: 6px }` + track / thumb transparent + `:hover` / `:focus-within` で thumb を `--muted` にする WebKit pseudo-element 一本化（`App.css`）。設計 §4.5 / §7.1 / §14-4 / §16 と `common_pitfalls.md` にも一本化理由を明記。§7.1 は「外寸 40px から border と実測 scrollbar 寸法を差し引く」へ改め、固定 33px という断定をやめている。実 track 寸法の確認は実装記録 §6 で Phase 4-a へ明示的に残した | **解決済み**（実寸確認は Phase 4-a へ正しく委譲） |
| 8.2 click 抑止の scheduled clear | `requestAnimationFrame` clear を廃止し、解除経路を matching click 消費 / 次 pointerdown / cancel 系の同期 clear へ限定（設計 §8.4、`App.tsx`）。§12 の該当行も更新済み | **設計上は解決済み**。ただし Escape を「click を生成しない」側へ分類したことで新たな穴が生じている（→ 1.1） |
| 8.3 fixed drag layer への token 供給 | Light は `.app-shell, .tab-drag-layer`、Dark は `:root[data-theme="dark"] .app-shell, :root[data-theme="dark"] .tab-drag-layer` の共通 selector へ **token block 全体**を移し、`--panel-bg` / `--text` / `--border` / `--muted` / `--accent` と新規 `--tab-indicator-*` が両方へ供給される。`--tab-strip-height` だけは `.app-shell` 専用のまま。設計 §9.6 も参照 token を列挙する形へ更新済み | **解決済み** |

---

## 4. 確認済み観点（指摘なし）

| 観点 | 確認内容 | 結果 |
| --- | --- | --- |
| 40px 固定高 | `--tab-strip-height: 40px`、`.document-pane` の grid row と `.tab-strip` の height が同一変数を参照。state / hover / focus / drag のどの class も height・grid row を触らない。`58px` は src・恒久docs から完全に消えている | 一致 |
| state indicator | `.tab-item::before` は既定で背景なし。`active.tab-ready` = accent 2px、`tab-loading` = `--tab-indicator-loading` 2px、`tab-rendering` = 38% 幅 + `translateX(163%)` の indeterminate animation、`tab-error` = 3px。旧 `box-shadow` 方式（active 上端線と error 下端線の競合）は削除。active 背景は `.tab-item.active` が独立して維持 | 設計 §6.1 と一致 |
| 色以外の識別軸 | 太さ（error 3px）、motion / pattern（rendering）、背景（active）、accessible name suffix の 4 重化。ready 非 active は indicator 無し | 一致 |
| reduced motion | `@media (prefers-reduced-motion: reduce)` で rendering を `repeating-linear-gradient` の static pattern + `animation: none` へ退避。loading（solid 2px）/ error（solid 3px）と区別が残る | 一致 |
| accessible name / `aria-busy` | `resolveTabAccessibilityState` が presentation state から suffix / busy を一意に返し（`paneRuntime.ts`）、activate button は `aria-label={displayName[, suffix]}`、`aria-busy={busy || undefined}`。visible `.tab-name` は accessible name の先頭一致を保ち、`title` は full path のまま。`.tab-state` DOM と旧 stateLabel は削除済み | 一致（name-in-name 要件を満たす） |
| reveal policy | `revealTab` が strip rect / item rect / padding 4 を `getTabRevealDelta` へ渡し、`delta !== 0` のときだけ `strip.scrollBy({ left, behavior: "auto" })`。対象は `.tab-item` 外枠（move / close を含む）で、activate button ではない | 設計 §4.4 / §7.2 と一致 |
| reveal trigger | activeTabId / tabs.length 変更後の rAF、`.tab-item` の `onFocusCapture`、move 後は destination focus → focus capture 経由。3 経路とも同じ policy を通る | 一致 |
| programmatic focus | TabStrip 経路 4 箇所（roving `focusTab`、close 後、`moveTab` destination、pane fallback）がすべて `focus({ preventScroll: true })`。TabStrip 経路の `scrollIntoView` は残存ゼロ | 一致 |
| mouse 限定 drag | `pointerType === "mouse"` 判定あり。`.tab-activate` に `touch-action` 指定なし。touch / pen は session を作らず strip の horizontal pan と tap activate が残る | 一致 |
| 6px threshold | `hasExceededTabDragThreshold` は二乗距離で `>= 6*6`。pending 中は feedback も `preventDefault` も出さない | 一致 |
| capture 中の drop 判定 | `elementFromPoint` + `closest("[data-tab-drop-pane]")` + `resolveTabDropPane`。`.tab-strip` に `data-tab-drop-pane` を付与し、single / same pane / unknown / null をすべて invalid target 化 | 一致 |
| pointerup 再判定 / explicit destination | pointerup 座標で再判定し、`sourceIsCurrent`（split mode + source membership）を満たす時だけ `moveTab(source, destination, tabId)` を 1 回呼ぶ | 一致 |
| 既存 `move-tab` 1 回適用 | `splitView.ts` は無変更（diff なし）。drag 専用 action、destination index、compatibility 経路はいずれも追加されていない。move button も同じ `moveTab` を通る | 一致（review checkpoint「重複 transition なし」） |
| session / cleanup の event 順 | 成功 drop: session finalize → presentation reset → capture release → `moveTab`。明示 release で発火する implicit `lostpointercapture` は session が null のため no-op。invalid drop: 同経路で move を呼ばず identity を残し、後続 click を `onClickCapture` が消費。source unmount / split 解除 / root reset は `[splitViewState, tabs]` effect が membership と `captureElement.isConnected` を見て cancel。二重 cleanup は pointerId 不一致で no-op | Escape 経路（→ 1.1）を除き一致 |
| click 抑止の実装形 | React `onClickCapture` + `preventDefault` / `stopPropagation` + `onClick` 側の `!event.defaultPrevented` 二重防御。identity は source pane / tab に限定され、他 tab の click を飲まない | 一致（解除条件のみ 1.1 / 2.1） |
| Escape の listener | `tabDragPresentation` が非 null の間だけ `document` へ capture phase の `keydown` を登録し、cleanup で解除。`preventDefault` + `stopPropagation` により menu / dialog の document bubble handler（`App.tsx:1138` / `1557` / `1978`）は同一 event で走らない | 一致 |
| pointermove の性能 | pointermove で呼ぶのは `elementFromPoint` と preview の `transform` 更新のみ。React state は drag 開始・target 変更・終了だけ。pending 中の pointerup は `null` / `""` への setState となり React が bail out するため、通常 click で余分な rerender は起きない | 設計 §4.6 / §8.1 と一致 |
| fixed preview と hit test | `.tab-drag-layer` は `.app-shell` の sibling、`position: fixed; inset: 0; z-index: 40; pointer-events: none`（子の preview も継承）。`elementFromPoint` に混入せず、pane / shell の `overflow: hidden` にも clip されない。初期 transform を画面外に置き、最初の rAF まで原点に一瞬出ない工夫もある。z-index は settings 100 / image viewer 110 より下で競合しない | 一致 |
| live region | `.tab-drag-live` は常時 mount の visually hidden span（`aria-live="polite"`）。drag 開始・valid target 変更・完了 / cancel の短文だけを更新。drag preview は `aria-hidden="true"` | 一致（後付け挿入による未通知の懸念なし） |
| drag feedback | destination strip に `tab-drop-target`（outline + `--accent-soft`）、source item に `tab-drag-source`（opacity）、`.app-shell.tab-dragging` に `cursor: grabbing`。`document.body.classList` は未使用で、既存 `explorer-resizing` / `split-resizing` と同じ React state 由来 | 一致 |
| theme token | 新規 `--tab-indicator-loading` / `-rendering` / `-error` を Light / Dark 双方で定義し、component rule に固定 RGB を書いていない。error は `--error-text` を参照。`color-mix` は既存 4 箇所と同じ書式 | 一致（実視認性は Phase 4-a matrix 2） |
| 境界条件 | tabs empty（空 strip でも `data-tab-drop-pane` 付きで drop 可）、完全表示（delta 0）、左右欠け、item 幅超過（左端優先）、非 finite（throw）、destination 同一 ID（reducer が dedupe）、source 非 active、source 最後の 1 件、invalid release、pointercancel、split 解除、root reset、focus target 欠落（pane focus + `console.error`）を実装で確認 | Escape 経路を除き設計 §12 と一致 |
| pure policy test | `tabStrip.test.ts` は完全表示 / 左欠け / 右欠け / exact edge / padding 0、item 幅超過、NaN・±Infinity、threshold 5・6・(4,4)・(5,4)、drop 6 組（primary↔secondary / same / unknown / null / single）を網羅。`paneRuntime.test.ts` は 4 状態の suffix / busy mapping を追加し、既存の shared 優先・pane 混線防止 test を維持 | 設計 §13.1 / §13.2 と一致 |
| 既存機能回帰 | `splitView.ts` / `splitView.test.ts` / `documentPolicy` / `explorerPane` / `imageViewer` は無変更。roving tabindex、Arrow / Home / End、close fallback、move button の accessible name、`tab-${paneId}-${tabId}` などの DOM ID、`aria-controls` / `aria-labelledby`、StatusBar / ErrorBanner routing はいずれも維持 | 回帰なし |
| security 境界 | Rust command、custom protocol、capability、CSP、iframe sandbox は無変更。iframe は drop target ではなく、preview layer も `pointer-events: none` | 影響なし |
| 恒久docs 同期 | 設計 §15 の置換対象表 11 行のうち Phase 3 対象の 10 行を反映済み（`docs/history/` のみ Phase 4-b 予定）。`58px`・state 2 行目の記述は全 docs から消え、`tabStrip.ts` は README file map / module 表 / basic_design の policy 一覧へ登録。`common_pitfalls.md` に §12 として capture hit test / click identity / focus scroll / fixed layer / scrollbar API の 5 項目を追加 | 新旧仕様の不整合なし |
| 実装記録 | `impl/tauri_tabstrip_ux_feature_impl.md` が持越し 3 件の確定内容、実装差分、docs 反映、検証結果、手動確認境界、既知制約を記載。Vite 単体 smoke が Tauri host 依存で使えない旨も明記 | 妥当 |
| meta | `impl_status: draft`、Phase Status 更新済み。`design_status: done` と Phase 2 承認コミット参照も整合 | 妥当 |

---

## 5. 自動検証の再実行

レビュー担当としても同一環境で再実行し、実装記録 §5 と一致することを確認した。

| 検証 | 記録 | 再実行結果 |
| --- | --- | --- |
| `npm test -- --run` | 成功。6 files / 97 tests | 成功。6 files / 97 tests |
| `npm run build` | 成功（既存 chunk size warning のみ） | 成功。`tsc` + Vite build、warning は既存の 500kB chunk 警告のみ |
| `cargo fmt -- --check` | 成功 | 成功 |
| `cargo check` | 成功 | 成功 |
| `cargo test` | 成功。22 tests | 成功。22 passed |

DOM lifecycle（pointer capture、click 順、focus scroll）と CSS 実寸は jsdom 非採用のため自動化できず、`docs/tests/README.md` と `docs/rules/development_workflow.md`、実装記録 §6 で Phase 4-a の実 WebView 確認へ明示的に委譲されている。委譲先の項目（track 実寸 6px、40px 外寸、indicator 視認性、item 全体 reveal、drag 各経路、touch / pen 非 drag、keyboard 導線）は設計 §14 の 14 項目と対応が取れており、境界の引き方は妥当である。

---

## 6. 集計と結論

| 分類 | 件数 | 内訳 |
| --- | --- | --- |
| blocking Medium | 1 | 1.1 |
| non-blocking Low | 3 | 2.1 / 2.2 / 2.3 |
| **合計** | **4** | **未解決 4 件** |

**結論**: **現時点では Phase 4-a へ進めない（条件付き差し戻し）。**

実装・test・恒久docs の水準は高く、Phase 2 で確定した契約（`preventScroll` + manual reveal、mouse 限定 drag、pointerup 再判定、explicit destination、単一 `move-tab`、pure policy 分離、fixed sibling layer、scrollbar 一本化、token 供給）はいずれもコードで確認できた。Phase 2 持越し 8.1〜8.3 も閉じている。

差し戻す理由は 1.1 の 1 件のみである。Escape cancel が click 抑止 identity を先に消すため、「cancel 時は state を変更しない」という TODO の完了条件が非 active tab の drag → Escape → release という経路で崩れる。修正は `cancelTabDrag` の identity clear 条件を分けるだけで済み、設計 §8.4 の 1 文と §14 の確認手順を合わせて更新すること。2.1 は同じ箇所、2.2 は CSS 1 行、2.3 は任意の簡素化であり、同じ修正コミットへまとめることを推奨する。

修正後は、`npm test -- --run` / `npm run build` / `cargo fmt -- --check` / `cargo check` / `cargo test` の再実行結果を添えて再確認レビューを依頼すること。1.1 と 2.2 の確認手順（Escape cancel 後の release で選択が変わらないこと、error / loading tab に focus しても indicator が判別できること）を §14 手動 matrix へ追加したうえで Phase 4-a へ進むこと。

---

## 7. 指摘対応 Round 1（実装担当、再確認待ち）

| 指摘 | 対応 | 状態 |
| --- | --- | --- |
| 1.1 Escape後releaseでsource activate | `cancelTabDrag`へ`preserveClickSuppression`を追加し、Escapeだけidentityをmatching clickまたは次pointerdownまで維持。設計§8.4 / §14、開発手動matrix、実装記録も同期 | 対応済み・再確認待ち |
| 2.1 drag中の追加pointerdown | session進行中はidentityをclearしないguardへ変更し、未使用`pointerId`を`SuppressedTabClick`から削除 | 対応済み・再確認待ち |
| 2.2 focus outlineがindicatorを覆う | `.tab-item::before`を`z-index: 2`へ上げ、focus controlよりindicatorを前面化。手動matrixへerror / loading focus確認を追加 | 対応済み・再確認待ち |
| 2.3 cancel handler重複 | pointercancel / lostpointercaptureを共通`handleTabPointerAbort`へ統合 | 対応済み・再確認待ち |

未解決はレビュー担当のfollow-up判定待ち4件。新規の別issue化は不要。

---

## 8. Round 1 再確認（レビュー担当、2026-07-29、対象 `ddc7e86`）

`git show ddc7e86`（9 files、実装 2 / 設計 1 / 実装記録 1 / meta 1 / 恒久docs 2 / review 1 / 開発workflow 1）、改訂後の `App.tsx` / `App.css` 全文、設計 §8.4 / §14、実装記録、`meta.md`、恒久docs を突き合わせて再確認した。**初回 4 件はすべて解決済み**である。

### 8.1 初回指摘の解決状況

| 指摘 | severity（初回） | 再確認した実装・文書 | 判定 |
| --- | --- | --- | --- |
| 1.1 Escape cancel 後の release で source tab が activate される | Medium（blocking） | `cancelTabDrag` が options 引数（`preserveClickSuppression` / `status`）を取り、`preserveClickSuppression` が false の時だけ identity を clear する（`App.tsx:859-878`）。Escape handler だけが `cancelTabDrag({ preserveClickSuppression: true })` を呼ぶ（同 `1414`）。event 順を再検算した結果、Escape → session null（identity は保持）→ capture release → 物理 release → `handleTabPointerUp` は session null で早期 return → source activate button の click → `suppressTabClick` が pane / tab 一致で `preventDefault` + `stopPropagation` して identity を消費 → `onClick` の `!event.defaultPrevented` で activate しない、と閉じている。click が発生しない位置で release した場合は identity が残るが、session 不在のため次の pointerdown が clear する（同 `885-887`）。`cancelTabDrag` は identity 判定より前に `tabDragSessionRef.current = null` を置いてから capture を release するため、明示 release で発火する implicit `lostpointercapture` は `handleTabPointerAbort` の pointerId 判定に掛からず、保持した identity を消さない。設計 §8.4、§14-7 / §14-13、`common_pitfalls.md` §12、`development_workflow.md` の手動確認、実装記録 §3.3 / §6 も同じ規則へ更新済み | **解決済み** |
| 2.1 drag 中の追加 pointerdown で identity が消える | Low | `handleTabPointerDown` 冒頭の clear が `if (!tabDragSessionRef.current)` で守られ、pending / dragging の進行中 session がある間は clear されない（`App.tsx:885-887`）。副ボタン press は従来どおり `button !== 0` guard で session を作らない。single view へ切り替えた後などの stale identity は、session 不在時の pointerdown で従来どおり clear される（推奨した guard 位置と一致）。`SuppressedTabClick` は `Pick<TabDragSession, "sourcePaneId" \| "tabId">` へ縮小され、未使用の `pointerId` は型・生成箇所（同 `930-933`）とも削除済み | **解決済み** |
| 2.2 focus outline が上端 indicator を覆う | Low | `.tab-item::before` が `z-index: 2` へ変更され（`App.css`）、`z-index: 1` の `.tab-activate:focus-visible` より前面になった。`pointer-events: none` は維持されているため hit test / drop 判定への影響は無い。`development_workflow.md` と設計 §14 経由の手動確認（error / loading tab に focus した状態で outline と indicator を同時に判別）も追加済み | **解決済み** |
| 2.3 cancel handler の重複 | Low | `handleTabPointerCancel` / `handleTabLostPointerCapture` が `handleTabPointerAbort` 1 関数へ統合され（`App.tsx:998-1002`）、両 pane の `onTabPointerCancel` / `onTabLostPointerCapture` が同じ関数を受け取る（同 `1546-1547`, `1609-1610`）。中身は `pointerId` 一致時の `cancelTabDrag()`（identity を clear する側）のままで、cancel semantics は変わっていない。`pointercancel` 後は click が生成されないため、Escape と扱いを分けた現在の設計と整合する | **解決済み** |

**初回 4 件: 解決済み 4 / 未解決 0。新規指摘なし。**

### 8.2 設計・恒久docs・手動確認境界の再確認

| 観点 | 確認内容 | 結果 |
| --- | --- | --- |
| 設計との整合 | 設計 §8.4 が「Escape は identity を維持し matching click か session 終了後の次 primary pointerdown で clear、pointercancel / source unmount を伴う unexpected lost capture だけ同期 clear、drag 中の追加 pointerdown では clear しない」へ改訂され、実装の分岐と 1 対 1 で対応する。§12 の該当行、§14-7 / §14-13 の確認手順も同じ規則を指す | 一致 |
| 実装と設計の乖離 | Phase 2 で確定した他の契約（`preventScroll` + manual reveal、mouse 限定 drag、6px threshold、`elementFromPoint` + pointerup 再判定、explicit destination、単一 `move-tab`、pure policy 分離、fixed sibling layer、scrollbar 一本化、token 供給、pointermove で state 更新しない）は今回の差分で変更されておらず、初回レビュー §4 の確認結果がそのまま有効 | 維持 |
| 恒久docs | `common_pitfalls.md` §12 の click 抑止 bullet が Escape / pointercancel / 追加 pointerdown の区別まで含む形へ更新。`development_workflow.md` に「Escape 後 release で selection が変わらない」「drag 中の追加 pointerdown でも抑止が失われない」「error / loading tab focus 時に outline と indicator を同時に判別できる」の 3 観点が追加された。40px / indicator / scrollbar / reveal / drag の既存記述と矛盾は無く、`58px` や state 2 行目の旧記述も残っていない | 整合 |
| 実装記録 | §3.3 が Escape と他 cancel 経路の identity 扱いの差、追加 pointerdown で clear しない旨へ更新。§6 の Phase 4-a 手動確認境界へ「非 active source の Escape 後 release」「drag 中の追加 pointerdown」「error / loading tab focus 時の indicator / outline 併存」が追加され、今回の修正で新たに実 WebView 確認が要る点を過不足なく列挙している | 妥当 |
| meta | `impl_status: in_review`、`related_commits` へ `031c06a` / `ca88c4b` を追加、Phase Status を「Claude findings 1 blocking Medium + 3 Low addressed, follow-up pending」へ更新。本 follow-up の承認後に Phase 4-a へ進む状態として整合する | 妥当 |
| Phase 4-a 境界 | DOM pointer lifecycle、click 順、CSS 実寸、WebKit scrollbar track、theme / reduced motion の視認性は jsdom 非採用のため自動化せず、設計 §14（14 項目）、`development_workflow.md`、`docs/tests/README.md`、実装記録 §6 の 4 箇所で同じ範囲を手動確認へ委譲している。今回追加された 3 観点もこの 4 箇所のうち該当箇所へ反映済みで、境界の記述は正確 | 妥当 |
| 残存 edge（指摘化しない観察） | split 解除 / source eviction を検知する effect と `handleTabPointerAbort` は非保持 cancel を使う。理論上は「button を押したまま split 解除」で Escape と同種の click が起こりうるが、mouse 1 本では drag 中に menu を操作できず、source item も unmount するため到達しない。現在の分岐で妥当と判断する | 指摘なし |

### 8.3 自動検証の再実行

| 検証 | 実装側の記録 | レビュー担当の再実行 |
| --- | --- | --- |
| `npm test -- --run` | 成功。97 tests | 成功。6 files / 97 tests |
| `npm run build` | 成功 | 成功（既存 chunk size warning のみ） |
| `cargo fmt -- --check` | 成功 | 成功 |
| `cargo check` | 成功 | 成功 |
| `cargo test` | 成功。22 tests | 成功。22 passed |
| `git diff --check` | 成功 | 成功（whitespace error なし） |

### 8.4 集計と結論（Round 1 再確認）

| 分類 | 初回 | Round 1 で解決 | Round 1 新規 | 未解決 |
| --- | --- | --- | --- | --- |
| blocking Medium | 1 | 1 | 0 | 0 |
| non-blocking Low | 3 | 3 | 0 | 0 |
| **合計** | **4** | **4** | **0** | **0** |

**結論**: **Phase 3 を承認 (Approved)。Phase 4-a へ進行可。**

blocking だった 1.1 は、`cancelTabDrag` の identity clear を経路ごとに分けるという最小限の修正で閉じており、Escape・pointercancel・unexpected lost capture・成功 drop・invalid drop・追加 pointerdown の 6 経路すべてで「cancel 時は state を変更しない」と「無関係な click を飲まない」が同時に成立することを event 順で確認した。2.1〜2.3 も推奨どおりの形で反映され、cancel semantics の変更や新たな重複経路は生じていない。設計・実装記録・meta・恒久docs・手動確認手順の同期も取れている。

Phase 4-a では、実装記録 §6 と `development_workflow.md` に列挙された実 WebView 依存項目（WebKit scrollbar track 実寸 6px と 40px 外寸、Light / Dark / reduced motion の indicator 視認性、item 全体 reveal と ancestor 非 scroll、drag 各経路と Escape 後 release、drag 中の追加 pointerdown、error / loading tab focus 時の indicator 併存、touch / pen の非 drag 契約、keyboard 導線）を確認すること。
