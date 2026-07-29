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

---

## 9. Phase 4-a feedback / Round 2 再確認（レビュー担当、2026-07-29、対象 `76daecf`）

**対象**: `76daecf` Phase 3 fix TabStrip scrollbar focus modality（9 files: `App.css` 1 行、設計 6 箇所、実装記録、meta、Phase 4-a 検証記録 新規、恒久docs 4 ファイル）
**契機**: 実 Tauri WebView での Phase 4-a 動作確認 NG（overflow 時の scrollbar thumb が pointer click 後に残る）
**判定**: **Phase 3 承認を維持。Phase 4-a 再実施へ進行可。新規指摘 0 件、未解決 0 件（実 WebView での確定は再実施時の確認事項として残る）。**

### 9.1 Phase 4-a feedback の扱い

| # | 内容 | severity | blocking | 状態 |
| --- | --- | --- | --- | --- |
| 4a-1 | overflow した TabStrip で tab を pointer click した後、pointer を preview へ移しても horizontal scrollbar thumb が表示され続ける | Low（表示条件の誤りであり、geometry / 操作 / state には影響しない） | **Phase 4-a に対して blocking**（受け入れ条件「hover / focus 時だけ視認可能」を満たさないため）。Phase 3 の他項目には非 blocking | **実装上は解決済み**（`76daecf`）。実 WebView での確定は Phase 4-a 再実施 |

Phase 4-a で期待どおりと確認された 4 項目（40px 固定高、ready / loading / error indicator、左右 pane 間 drag and drop、右端 tab の close button まで含む item 全体 reveal）は、Phase 2 設計 §6 / §7.1 / §7.2 / §8 と Phase 3 実装レビュー §4 の確認内容と一致しており、今回の修正でも触れられていない。

### 9.2 原因分析の妥当性

**結論: 妥当。focus lifecycle と一致する。**

- `.tab-strip:focus-within` は「自身または子孫に focus がある」で一致する。`.tab-strip` の focusable な子孫は `.tab-activate` / `.tab-move` / `.tab-close` の 3 button だけであり（`App.tsx` TabStrip）、`.document-pane`（`tabIndex={-1}`）は TabStrip の外にあるため `:focus-within` の対象にならない。したがって thumb が残る条件は「TabStrip 内 button が focus を保持していること」に限られる。
- tab の pointer click 経路は `onClick` → `onActivate` だけで、`focusTab` のような programmatic focus を呼ばない（`focusTab` は roving navigation と close 後 fallback 専用）。つまり残っていた focus は button の native click focus であり、pointer が離れても解除されない。ユーザ報告の「scrollbar を操作して focus 状態が変わると非表示になった」という観察とも一致する。
- 対抗仮説である「pointer capture により `:hover` が保持され続けた」は成立しない。`handleTabPointerDown` の capture は pointerup で暗黙 / 明示に解放され、以後 hover は通常判定へ戻る。focus 状態の変化で消えたという事実も hover 説と矛盾する。
- したがって「pointer click 後に残る button focus に `:focus-within` が一致し続ける」という分析は、実装の focus 経路と報告事象の双方に整合する。

### 9.3 修正の妥当性

**結論: 妥当。要求文言への適合はむしろ改善している。**

- 変更は `.tab-strip:focus-within::-webkit-scrollbar-thumb` → `.tab-strip:has(:focus-visible)::-webkit-scrollbar-thumb` の 1 行のみ（`App.css:893`）。`:hover` 側の rule、`::-webkit-scrollbar { height: 6px }`、track / thumb の transparent 既定、`border-radius` は不変。
- **pointer click 後に pointer が TabStrip 外へ出た場合**: `:hover` は外れ、click focus は UA の focus-visible heuristic 上 button では `:focus-visible` を成立させないため、`:has(:focus-visible)` も外れて thumb は隠れる。報告事象の解消経路として正しい。
- **keyboard focus 時**: ArrowLeft / ArrowRight / Home / End の roving navigation は `activateAndFocus` → `focus({ preventScroll: true })` で、直前の入力が keyboard であるため focus-visible が成立する。Tab 移動も同様。pointer が領域外にあっても `:has(:focus-visible)` で thumb が維持される。focus が TabStrip 外へ移れば `:has()` の対象が消えて隠れる。
- **要求との整合**: `docs/todo/todo.md` TODO-2026-026 scope は「horizontal scrollbar は pointer hover または keyboard focus 時だけ視認可能にし」と明記している。`:focus-within` は pointer click 由来の focus も拾うため、この文言に対しては元実装が過剰だった。今回の条件はむしろ scope 文言に近づいており、退行ではなく適合である。
- **代替案との比較**: React 側で focus modality を state 管理する案（`:focus-visible` 相当を JS で再実装）や、click 後に `blur()` する案は、いずれも focus 契約（roving tabindex、item 全体 reveal、`preventScroll`）へ副作用を持ち込む。CSS 選択子 1 行で閉じる今回の方法が最小である。

### 9.4 対象 WebView 互換性

**結論: blocking risk なし。既存 CSS が要求する下限を上げていない。**

- `:has()` は Safari 15.4+ / Chromium 105+ 系、`:focus-visible` は Safari 15.4+ / Chromium 86+ 系で利用できる。本 project の対象は WKWebView（macOS）、WebView2（Chromium）、WebKitGTK であり、いずれも該当世代以降を前提としている。
- 本 CSS は既に `color-mix(in srgb, ...)` を 5 箇所（`App.css:533`, `571`, `1034`, `1276`, `1283`）で使用しており、これは `:has()` より新しい機能である。したがって `:has()` の追加で実行環境の下限は上がらない。`:focus-visible` も既に 11 箇所で使用済みで、新規依存ではない。
- `::-webkit-scrollbar-thumb` を originating element の擬似クラスで切り替える形（`:hover::-webkit-scrollbar-thumb`）は、Phase 4-a で実際に動作した実績がある（`:focus-within` 版が適用・非適用とも観測された）。`:has()` を originating element 側に置く今回の形も同じ構造であり、構文的な無効化要因は無い。ただし `:has()` の動的 invalidation が scrollbar pseudo-element の再描画へ確実に伝播するかは engine 実装依存であり、**実 WebView での確認は Phase 4-a 再実施の必須項目**とする（9.6 の残リスク R2）。

### 9.5 非退行の確認

| 観点 | 確認内容 | 結果 |
| --- | --- | --- |
| 6px track | `::-webkit-scrollbar { height: 6px }` と track transparent の rule は無変更。thumb の `background` 切替条件だけを変更 | 非退行 |
| 40px 外寸 | `--tab-strip-height: 40px`、`overflow-x: scroll`、`.document-pane` grid row いずれも無変更。今回の差分に layout property は 1 つも含まれない | 非退行 |
| overflow 挙動 | `overflow-x: scroll` 維持のため、overflow 有無で内寸は変わらない。thumb は overflow 時のみ生成される既存挙動のまま | 非退行 |
| focus reveal | reveal は JS（`revealTab` + `getTabRevealDelta` + `scrollBy`）であり CSS 選択子とは独立。`focus({ preventScroll: true })` も無変更 | 非退行 |
| drag lifecycle | `App.tsx` に差分なし。session、click 抑止 identity、`elementFromPoint`、pointerup 再判定、`moveTab` は Round 1 承認時のまま | 非退行 |
| indicator / theme | `.tab-item::before`（`z-index: 2`）、`--tab-indicator-*`、reduced motion rule は無変更 | 非退行 |
| 自動検証 | レビュー担当でも再実行し実装側記録と一致（下表） | 一致 |

| 検証 | 実装側の記録 | レビュー担当の再実行 |
| --- | --- | --- |
| `npm test -- --run` | 6 files / 97 tests passed | 成功。6 files / 97 tests |
| `npm run build` | success（既存 chunk size warning のみ） | 成功（同 warning のみ） |
| `cargo fmt -- --check` | success | 成功 |
| `cargo check` | success | 成功 |
| `cargo test` | 22 tests passed | 成功。22 passed |
| `git diff --check` | success | 成功 |

なお CSS のみの差分であるため、自動 test 群は本件の合否判定材料にならない。判定は Phase 4-a 再実施の実 WebView 確認に依存する（この境界は `docs/tests/README.md` と実装記録 §6 に記載済み）。

### 9.6 残リスク（いずれも Phase 4-a 再実施で確認、新規指摘としては起票しない）

| # | 残リスク | severity | 確認手段 |
| --- | --- | --- | --- |
| R1 | `:focus-visible` の成立判定は UA heuristic であり、macOS の Full Keyboard Access 有効時などに click focus でも成立する可能性がある。その場合 pointer click 後に thumb が残る事象が再現しうる | Low | 再確認条件 1（pointer click → preview へ pointer 移動 → 非表示） |
| R2 | `:has()` の状態変化が `::-webkit-scrollbar-thumb` の再描画へ伝播するかは engine 実装依存 | Low | 再確認条件 1 / 2（表示・非表示が pointer と keyboard の双方で切り替わること） |
| R3 | drag 中は pointer capture により source TabStrip の `:hover` が保持されるため、pointer が destination 上にあっても source 側 thumb が見えうる。修正前後で挙動は同じで、geometry / 操作へ影響しない | Low（cosmetic、既存挙動） | 再確認条件 3 の drag move 非退行確認に含まれる |
| R4 | drag move 完了後の destination focus は programmatic focus であり、mouse 起点では focus-visible が成立しない想定。thumb は出ないが、これは pointer 操作として期待どおり。keyboard 起点の move button では成立する | Low（設計意図どおり） | 再確認条件 2 と手動 matrix 8 |

### 9.7 文書の一貫性

NG 内容・原因・修正・再確認条件が 6 文書で一貫していることを確認した。

| 文書 | 記載 | 判定 |
| --- | --- | --- |
| 設計 §2.2-4 / §3.1 / §4.5 / §5（Before/After）/ §14-4 / §18 / 新設 §19 | 表示条件を「pointer hover または keyboard `:focus-visible`」へ統一し、`:focus-within` を使わない理由、NG 事実、原因、修正方針、geometry / reveal / drag を変えない旨を明記。traceability 表の該当行も §19 参照を追加 | 一貫 |
| 実装記録 §3.2 / 新設 §9 | 実装上の表示条件と、NG 内容・原因・修正・再確認 3 観点を記載 | 一貫 |
| `verification/phase4a_user_verification.md`（新規） | OK 4 項目、NG 事象、focus 状態変化で消えた観察、差し戻し判断、再確認条件 3 項目を記録 | 一貫 |
| `docs/components/tauri_viewer/interface_spec.md` / `detail_design.md` | 恒久仕様として「pointer hover または keyboard `:focus-visible` の時だけ thumb を見せ、pointer click 由来の focus だけでは維持しない」「6px track は維持」を記載 | 一貫 |
| `docs/architecture/common_pitfalls.md` §12 | `:focus-within` が pointer click 後の focus を拾う落とし穴と、`:hover` + `:has(:focus-visible)` での区別を追加 | 一貫 |
| `docs/rules/development_workflow.md` / `docs/tests/README.md` | 手動確認へ pointer hover・click 後 mouse leave・keyboard focus 中の mouse leave・TabStrip 外への focus 移動を追加し、focus modality が手動 matrix 対象であることを明記 | 一貫 |
| `meta.md` | `status: in_progress`、`impl_status: in_review`、`verification_status: in_progress`、Phase 3 を「Reopened after Phase 4-a scrollbar focus-modality feedback」、Phase 4-a を「NG；4 項目は受理、再確認待ち」へ更新 | 一貫 |

実装コードに `:focus-within` の残存は無く（`markdown-viewer-tauri/src` を全文検索）、docs 側の言及はいずれも「使わない理由」の説明として意図的に残されている。

### 9.8 集計と結論（Round 2）

| 分類 | 件数 |
| --- | --- |
| Phase 4-a feedback 由来（4a-1） | 1（実装上 解決済み、実 WebView 確定は再実施時） |
| Round 2 新規指摘 | **0** |
| 未解決指摘 | **0** |
| 残リスク（再確認で潰す観察事項） | 4（R1〜R4、いずれも Low） |

**結論**: **Phase 3 の承認を維持し、Phase 4-a 再実施へ進行可。**

原因分析は実装の focus 経路と報告事象の双方に整合し、修正は CSS 選択子 1 行で TODO scope の文言（pointer hover または keyboard focus）へより正確に適合する。geometry、reveal、drag lifecycle、indicator、theme への差分は無く、自動検証もレビュー担当の再実行で一致した。互換性面でも既存 `color-mix` より下限が低い機能しか使っておらず、blocking risk は無い。

Phase 4-a 再実施では、`verification/phase4a_user_verification.md` の再確認条件 3 項目に加えて、R1〜R4 を次の形で確認すること。

1. overflow した TabStrip へ pointer を置くと thumb が出る。tab を pointer click し、focus を残したまま preview へ pointer を移すと thumb が隠れる（R1 / R2）。
2. keyboard で tab control へ focus した状態では pointer が領域外でも thumb が見え、focus を TabStrip 外へ移すと隠れる（R2）。keyboard で move button から移動した直後の destination でも同様に確認する（R4）。
3. 6px track、40px 固定高、indicator、item 全体 reveal、drag move と cancel 経路に退行が無い。drag 中に source 側 thumb が見えても許容とする（R3）。

---

## 10. Phase 4-a feedback / Round 3 再確認（レビュー担当、2026-07-30、対象 `db2f066`）

**対象**: `db2f066` Phase 3 stabilize TabStrip scrollbar pointer boundary（15 files: `App.tsx` +56 / `App.css` 1 行 / `tabStrip.ts` +15 / `tabStrip.test.ts` +21、設計 2 箇所 + 新設 §20、実装記録、meta、Phase 4-a 検証記録、恒久docs 6 ファイル）
**契機**: Phase 4-a Round 2 の再確認 NG（`:hover` + `:has(:focus-visible)` 修正後も、TabStrip と preview を pointer で上下往復すると thumb の残留が非決定的に発生）
**判定**: **Phase 3 承認を維持。Phase 4-a Round 3 再実施へ進行可。新規指摘 0 件、未解決 0 件。**

### 10.1 Phase 4-a feedback（Round 2 NG）の扱い

| # | 内容 | severity | blocking | 状態 |
| --- | --- | --- | --- | --- |
| 4a-2 | `:hover` を pointer 表示の source of truth にしていたため、TabStrip ↔ preview の往復で thumb の表示・非表示が非決定的になる（高速移動で残りやすい、scrollbar 上で停止すると消えやすい） | Low（表示条件の安定性の問題。geometry / 操作 / state・data には影響しない） | **Phase 4-a に対して blocking**（受け入れ条件「hover / focus 時だけ視認可能」を安定して満たさない）。Phase 3 の他項目には非 blocking | **実装上は解決済み**（`db2f066`）。確定は Round 3 実 WebView 再確認 |

Phase 4-a で受理済みの 4 項目（40px 固定高、状態 indicator、pane 間 drag and drop、右端 tab の item 全体 reveal）は今回も変更されていない（10.4 参照）。

### 10.2 原因分析の妥当性

**結論: 妥当。報告された症状の傾向と、採った対策が同じ機序を指している。**

- Round 2 の実装は pointer 表示を UA の `:hover` 状態に委ねていた。custom scrollbar（`::-webkit-scrollbar-*`）を持つ scroller では、pointer が **element 自身の scrollbar 領域**にある間は page へ pointer / mouse move が届かない実装が一般的であり、hover 状態と実際の pointer 位置の同期が最後の hit test 結果に依存する。ユーザ報告の「素早い移動ほど残りやすい」「scrollbar 位置で一旦停止してから preview へ移すと消えやすい」という**方向性のある傾向**は、UA 側 hover state と scrollbar 再描画のタイミング依存という説明と整合する。React state は当該表示に一切関与していなかったため、実装差分ではなく表示条件そのものが原因という切り分けも妥当である。
- Round 1（`:focus-within` → `:has(:focus-visible)`）が解消した「pointer click 由来 focus の残留」とは独立の第 2 の経路であり、Round 2 の症状が「軽減したが解消しない」であったことと一致する。
- 対策として `:hover` を表示条件から外し、pointer 位置を JS が保持する class へ移すのは、原因（UA state の非同期性）を回避する最短経路である。keyboard 表示だけを `:has(:focus-visible)` に残した切り分けも、Round 2 で確認済みの経路を温存する点で妥当。

### 10.3 修正の妥当性（レビュー観点 1〜5）

#### (1) 高速 enter → leave の race

**問題なし。** window listener は `useEffect(..., [])` で **mount 時に常設**され、enter を契機に登録していない（`App.tsx:2806-2841`）。したがって「enter 直後の move が listener 未登録で取りこぼされる」構造が存在しない。`onPointerEnter` は `updatePointerInside(true)` で **ref を同期更新**してから state を更新するため（同 `2767-2773`）、React の再描画完了を待たずに直後の pointermove が判定対象になる。DOM commit 後 passive effect 実行前という理論上の窓は残るが、その区間でも React の `onPointerLeave` は既に張られており、さらに次の pointermove で backstop が働く。

#### (2) stale class が残らないか

解除経路は 5 つで、いずれも ref と state を同時に落とす。

| 経路 | 実装 | 効果 |
| --- | --- | --- |
| `onPointerLeave` | `updatePointerInside(false)` | 通常の離脱 |
| window capture `pointermove`（領域外） | `isPointInsideTabStrip` false → `clearPointerInside()` | leave を取りこぼしても次の move で確実に解除（今回の主対策） |
| window `blur` | `clearPointerInside()` | app 非アクティブ化・window 外への離脱 |
| `stripRef.current` が null / touch pointer | 同上 | DOM 未接続時と touch 混在時の防御 |
| unmount | effect cleanup で listener 除去、DOM ごと class 消滅 | secondary pane の split off 等 |

`pointermove` を **capture phase** で登録している点も妥当で、下位で `stopPropagation` されても届く。`blur` は capture なしの window 登録であり、element の blur（bubble しない）で誤 clear されない点も正しい。`clearPointerInside` は ref チェック後にしか到達せず、無駄な `setState` も発生しない。

#### (3) pane 間移動 / native scrollbar / pointer capture / iframe 境界

- **primary ↔ secondary**: TabStrip は pane ごとの instance で、ref と state も instance ローカル。移動時は片方が leave、他方が enter となり、leave を取りこぼしても各 instance の tracker が自分の rect で判定するため、両方が同時に active のまま残る状態にならない。
- **native scrollbar 上の通過・停止**: strip の `getBoundingClientRect()` は scrollbar 領域（下端 6px）を含むため、thumb 操作中や scrollbar 上の滞在では inside 判定が維持され thumb は表示され続ける（操作中に消えないことが正しい）。scrollbar 上で page への move が途切れても ref は true のまま保持され、preview へ抜けた**最初の page 上の move** で解除される。Round 2 の症状に対する直接の修復経路になっている。
- **pointer capture 中（tab drag）**: capture 中も window capture phase の `pointermove` は届くため、source strip の inside 判定は pointer が rect 外へ出た時点で解除される。Round 2 レビューで残リスク R3 とした「capture により source strip の `:hover` が保持され thumb が残る」挙動は、本修正で解消した。destination strip は capture 中 boundary event を受け取らないため enter せず、drag 中に destination の pointer thumb は出ないが、これは drop feedback（`tab-drop-target`）と役割が分かれており矛盾しない。
- **preview iframe 境界**: trusted HTML preview は iframe であり、pointer が iframe 内へ入ると親 document へ `pointermove` が届かない。この経路だけは window backstop が効かず、解除は `onPointerLeave`（および blur / 再入）に依存する。boundary event は hit test に基づく DOM event であり、`:hover` の再描画タイミング問題とは別系統のため成立見込みは高いが、**報告された往復ジェスチャを HTML 文書表示中にも実施して確認する**必要がある（残リスク R5）。

#### (4) listener 常設の性能

**妥当。** handler の先頭が `if (!pointerInsideRef.current) return;` であり、pointer が TabStrip 外にある通常時は **layout を一切読まない**（`getBoundingClientRect` に到達しない）。layout read が走るのは「pointer が 40px の strip 内にある間」だけで、その間は 1 move あたり 1 rect 読み取り。TabStrip は最大 2 instance のため常設 listener は 2 個で、いずれも早期 return する。drag 中は App 側の `elementFromPoint` と重なるが、source strip を出た時点で ref が false になり読み取りは止まる。throttle / rAF を挟む必要はない規模である。

#### (5) pure geometry policy

`isPointInsideTabStrip(left, right, top, bottom, clientX, clientY)`（`tabStrip.ts:48-60`）は、finite 検査と `right < left || bottom < top` の throw を先に行い、`x >= left && x < right && y >= top && y < bottom` の **半開区間**で判定する。

- 半開区間は隣接要素との二重判定を避ける矩形判定の標準形であり、strip 下端 = preview 上端という本 UI の隣接関係に対して正しい（下端ちょうどは outside）。
- fail-fast は `getTabRevealDelta` と同じ方針で、silent fallback を作らない既存 policy と一貫する。
- 幅・高さ 0（非表示時の全 0 rect 等）は throw ではなく false を返し、安全側（解除）に倒れる。
- test は inside、右下端手前（109.99 / 59.99）、右端・下端ちょうど、左端・上端手前、invalid geometry の 6 + 1 ケースを網羅（`tabStrip.test.ts`）。境界規則が仕様として固定されている。

### 10.4 非退行（レビュー観点 6）

| 観点 | 確認内容 | 結果 |
| --- | --- | --- |
| keyboard `:focus-visible` | `.tab-strip:has(:focus-visible)::-webkit-scrollbar-thumb` は無変更で残存。pointer 側 class と OR 条件 | 非退行 |
| 6px track / 40px 外寸 | `::-webkit-scrollbar { height: 6px }`、track transparent、`--tab-strip-height: 40px`、`overflow-x: scroll` いずれも無変更。CSS 差分は thumb 着色の selector 1 行のみ | 非退行 |
| item 全体 reveal | `revealTab` / `getTabRevealDelta` / `focus({ preventScroll: true })` に差分なし | 非退行 |
| drag lifecycle | App 側の session、click 抑止 identity、`elementFromPoint`、pointerup 再判定、`moveTab`、cancel 経路に差分なし。新規 listener は capture phase の受動監視のみで `preventDefault` / `stopPropagation` を行わず、drag の pointer 経路に干渉しない | 非退行 |
| indicator / theme | `.tab-item::before`、`--tab-indicator-*`、reduced motion に差分なし | 非退行 |
| rerender 範囲 | 新 state は TabStrip ローカルで、境界を跨いだ時だけ 1 回再描画する（`updatePointerInside` の等値 guard あり）。App / preview / iframe は再描画されない | 非退行 |
| touch | enter は `pointerType !== "touch"` のみ受理し、tracker も touch move で即解除。touch の pan / tap 契約は不変 | 非退行 |
| 自動検証 | レビュー担当でも再実行し実装側記録と一致（下表）。test は 97 → 104（+7 = 境界 6 + invalid 1） | 一致 |

| 検証 | 実装側の記録 | レビュー担当の再実行 |
| --- | --- | --- |
| `npm test -- --run` | 6 files / 104 tests passed | 成功。6 files / 104 tests |
| `npm run build` | success（既存 chunk size warning のみ） | 成功（同 warning のみ） |
| `cargo fmt -- --check` | success | 成功 |
| `cargo check` | success | 成功 |
| `cargo test` | 22 tests passed | 成功。22 passed |
| `git diff --check` | success | 成功 |

CSS / DOM event の挙動は自動 test の対象外であり、判定は Round 3 の実 WebView 確認に依存する。この境界は `docs/tests/README.md`、`development_workflow.md`、実装記録 §6 に記載済みで、今回「native scrollbar 再描画」「低速・高速の pointer 往復」が明示的に追加されている。

### 10.5 残リスク

| # | 残リスク | severity | 状態 |
| --- | --- | --- | --- |
| R1 | `:focus-visible` の成立判定は UA heuristic（macOS Full Keyboard Access 等の影響） | Low | 継続（keyboard 経路のみ） |
| R2 | scrollbar pseudo-element の再描画が originating element の state 変化へ追従するか。pointer 側は `:hover` から **class 属性変更**へ移り、より確実な invalidation 経路になった。keyboard 側は `:has(:focus-visible)` のまま | Low | 継続（影響縮小） |
| R3 | drag 中に source strip の `:hover` が保持され thumb が残る | — | **解消**（10.3(3)） |
| R4 | mouse 起点 move 後の destination programmatic focus は focus-visible にならず thumb が出ない（意図どおり） | Low | 継続 |
| R5 | HTML preview iframe 内へ pointer が入ると親 document に `pointermove` が届かず、解除が `onPointerLeave` / blur / 再入依存になる | Low | **新規**。Round 3 で HTML 文書表示中の往復を確認 |
| R6 | pointer 静止中に layout が変わる場合（split separator 操作、Explorer resize、tab 増減による strip 出現・消失）、次の move まで class が実態と一致しない可能性 | Low（cosmetic、次の move で自己修復） | **新規** |
| R7 | drag（pointer capture）中は destination strip が enter を受け取らず pointer thumb が出ない | Low（仕様として妥当） | **新規・許容** |
| R8 | `isPointInsideTabStrip` は invalid geometry で throw する。実 rect では到達しないが、window listener 内の例外は React が捕捉しない | Low（fail-fast 方針どおり） | **新規・許容** |

### 10.6 Round 3 再確認観点

`verification/phase4a_user_verification.md` の Round 3 再確認条件（低速・高速の往復、scrollbar 上での停止 / 通過 / click focus 残存、keyboard 表示と各種非退行）に加えて、次を実施すること。

1. **Markdown 文書表示中**と**trusted HTML 文書表示中**の両方で TabStrip ↔ preview の往復を行う（R5）。HTML 表示中だけ残留する場合は、`onPointerLeave` 依存部分の補強（例: `.preview-pane` 側 enter での解除）が追加課題となる。
2. split 表示で primary ↔ secondary の TabStrip 間を直接往復し、両 strip の thumb が同時に表示され続けないこと（10.3(3)）。
3. tab drag 中に source strip から pointer を外し、source 側 thumb が消えること。drag 中に destination 側 thumb が出ないことは許容とする（R3 / R7）。
4. pointer を strip 上で静止させたまま split separator を keyboard 操作するなどで layout を変化させ、次に pointer を動かした時点で表示が実態へ復帰すること（R6）。
5. keyboard focus 表示、6px track、40px 固定高、indicator、item 全体 reveal、drag move と cancel 経路の非退行（R1 / R2 / R4）。

### 10.7 文書の一貫性（レビュー観点 7）

| 文書 | 記載 | 判定 |
| --- | --- | --- |
| 設計 §4.5 / §18 / 新設 §20 | pointer 表示の source of truth を enter / leave + window 座標監視の明示 class へ移した理由、`:hover` と `:focus-within` を使わない理由、ref 同期による race 回避、ref 無効時に geometry を読まない方針、keyboard 経路と geometry / reveal / drag を変えない旨を記載。traceability 行も §19–20 参照へ更新 | 一貫 |
| 実装記録 §9 追記 | Round 2 NG の内容、原因、方式変更、`tabStrip.ts` への policy / test 追加を記載 | 一貫 |
| `verification/phase4a_user_verification.md` | Round 2 再確認結果（残る場合と消える場合、速度依存、停止時の傾向）、NG 判断、Round 3 再確認条件 3 項目を追記 | 一貫 |
| `interface_spec.md` / `detail_design.md` / `basic_design.md` / `README.md` | 恒久仕様として enter / leave + window 座標監視 class、領域外では geometry を読まない、keyboard `:focus-visible` は独立、6px track 維持、`tabStrip.ts` の責務へ境界判定を追加 | 一貫 |
| `common_pitfalls.md` §12 | `:focus-within` の残留に加え、`:hover` + native scrollbar pseudo-element の再描画タイミング依存と、明示 class 管理という回避策を記載 | 一貫 |
| `development_workflow.md` / `docs/tests/README.md` | 手動確認へ「低速・高速の往復で領域外では確実に隠れる」「click focus 残存時・scrollbar 通過時も同じ」を追加。`tabStrip.test.ts` の自動 test 対象へ境界判定を追加し、native scrollbar 再描画が手動 matrix 対象であることを明記 | 一貫 |
| `meta.md` | `status: in_progress` / `impl_status: in_review` / `verification_status: in_progress`、Phase 3 を「Reopened again after Phase 4-a Round 2」、Phase 4-a を「NG after Round 2、Round 3 再確認待ち」へ更新 | 一貫 |

実装側に `:hover` を pointer 表示条件として使う記述は残っていない（CSS の thumb 着色は明示 class と `:has(:focus-visible)` のみ）。

### 10.8 集計と結論（Round 3）

| 分類 | 件数 |
| --- | --- |
| Phase 4-a feedback 由来（4a-2） | 1（実装上 解決済み、確定は Round 3 実 WebView 再確認） |
| Round 3 新規指摘 | **0**（blocking 0 / non-blocking 0） |
| 未解決指摘 | **0** |
| 残リスク | 7（R1・R2・R4 継続、R5〜R8 新規、いずれも Low。R3 は解消） |

**結論**: **Phase 3 の承認を維持し、Phase 4-a Round 3 再実施へ進行可。**

原因分析は報告された症状の傾向（速度依存、scrollbar 上での停止で消えやすい）と機序が整合し、修正は「UA の hover state に依存しない明示的な pointer 境界 state」という原因直撃の方式である。listener 常設 + ref 同期更新により enter / leave の race を構造的に排除し、ref 無効時は layout を読まないため常設による性能負荷も無い。境界判定は pure policy へ切り出して単体 test 済みで、DOM 側には rect 取得と class 適用だけが残る責務分割になっている。keyboard 表示、6px track、40px 外寸、reveal、drag、indicator への差分は無く、自動検証もレビュー担当の再実行で一致した。Round 2 の残リスク R3 は本修正で解消し、新たに R5〜R8 を再確認観点として登録した。

Round 3 の実 WebView 確認で 10.6 の 5 項目が期待どおりであれば、Phase 4-a を OK として Phase 4-b へ進めてよい。R5（HTML preview iframe）で残留が再現した場合のみ、`onPointerLeave` 依存部分の補強を Phase 3 の追加修正として扱うこと。

---

## 11. Phase 3 follow-up / Round 4（レビュー担当、2026-07-30、対象 `55bd8b9..d0d45bf`）

**対象コミット**: `8c91e10` → `d0d45bf`（7 commits）
**最終実装**: `d0d45bf` Phase 3 reveal adjacent tab context
**差分規模**: 15 files、+614 / −75（`App.tsx` +344、`tabStrip.ts` +63、`tabStrip.test.ts` +61、`App.css` +79、docs 8 ファイル）
**判定**: **Phase 3 承認 (Approved)**。**新規指摘 6 件（すべて Low / non-blocking）、未解決 6 件、blocking 0 件。** Phase 4-a は報告どおり scrollbar・peek reveal とも実 WebView で期待どおりのため、**11.5 の記録反映を Phase 4-b 完了処理に含めることを条件に Phase 4-b へ進行可**。

### 11.1 変更の骨子と評価

| 変更 | 評価 |
| --- | --- |
| `.tab-strip-shell`（40px）で scroll element を包み、native scrollbar を含む shell 矩形を pointer 境界にした | 妥当。scrollbar 上の擬似 `pointerleave` と hit-test の穴を境界定義そのもので閉じている |
| 表示条件から `:hover` / `:focus-within` / `:has(:focus-visible)` を全廃し、`shouldShowTabScrollbar(pointerInside, keyboardFocusInside)` の単一 class へ集約 | 妥当。UA 依存の判定を論理から完全に除去し、pure policy + unit test で固定した |
| keyboard modality を window `keydown` / `pointerdown` capture と shell `onFocusCapture` / `onBlurCapture` で自前管理 | 妥当。pointer click focus で表示しないという確定仕様を UA heuristic 抜きで満たす |
| window `pointermove` で shell 矩形から inside を**双方向**に再導出 | 妥当（enter 取りこぼしの回復に必須）。ただし性能特性が変わった（→ 11.2 の指摘 1） |
| 一時 StatusBar 診断 → 診断除去 build → `View > Debug Information` の汎用 DebugPanel、という切り分け手順 | 妥当。診断有無を変数として分離し、「診断 ON で正常化・OFF へ戻しても継続」という観測から native scrollbar の初回 paint invalidation 不足へ到達しており、推測での重ね当てを避けている |
| 通常経路の style flush（`isScrollbarVisible` / `tabs.length` 変化時、overflow 時だけ次 frame に layout + `::-webkit-scrollbar-thumb` computed style を 1 回読む） | 妥当かつ最小。setState を持たないため再 render を誘発せず、scroll 位置も変えない |
| `getTabRevealDelta` への optional peek geometry と隣接 50% peek reveal | 妥当。選択 item 全体を常に優先する clamp 付きで、先頭 / 末尾 / 幅不足 / oversized が決定的 |

### 11.2 重点観点の確認結果

**(1) visibility state の event 順・stale closure・pane 間干渉・touch / capture / iframe / split lifecycle**

- 解除・設定経路は shell `pointerenter` / `pointerleave`（矩形内 leave は無視）、window capture `pointermove`（双方向）、window `pointerdown`（keyboard state 解除）、window `keydown`（modality のみ）、shell `focus` / `blur` capture、window `blur`、unmount cleanup の 8 経路。いずれも ref と state を同一関数で更新し、`updatePointerInside` / `updateKeyboardFocusInside` に等値 guard があるため余分な setState は出ない。
- listener effect の deps は `[debugEnabled]`。閉じ込めているのは ref、`paneId`、`debugEnabled` だけで、`tabs` や `activeTabId` に依存しないため stale closure による誤判定は発生しない。`debugEnabled` は再購読時に更新される。
- primary / secondary は別 instance で ref / state / shell rect が独立し、共有するのは pane ID を key にした debug event だけ。相互干渉は無い。
- touch は `pointerenter` で除外し、window move でも `pointerType === "touch"` を即 clear するため、touch pan / tap 契約は不変。
- drag（pointer capture）中も window capture の `pointermove` は届くため source は矩形外で解除され、destination は矩形内で表示になる。Round 3 の残リスク R7（drag 中 destination に出ない）も解消した。
- iframe 内へ pointer が入ると親へ `pointermove` が届かないのは変わらず、解除は `pointerleave` / `blur` に依存する（残リスク R5 として継続）。
- split off で secondary が unmount すると listener と DOM class が同時に消える。`.tab-strip-shell` は `.document-pane` の grid row（`var(--tab-strip-height)`）を占め、`data-tab-drop-pane` と `role="tablist"` は内側 `.tab-strip` に残るため、drop 判定と ARIA 構造は不変。`.tab-strip` が shell を 100% 満たすため `elementFromPoint` が shell だけを返す領域も無い。

**(2) Debug OFF の停止性・ON/OFF 切替・cleanup・stale entry・menu・grid row**

- `queueScrollbarDebug` は先頭で `if (!debugEnabled) return;`。OFF 時は rAF 予約、`getBoundingClientRect`、`getComputedStyle`、`CustomEvent` 発行、`lastEvent` / 座標 ref の書き込みまで一切行わない。App 側も listener を張らず、`DebugPanel` を描画しない。
- 切替時は listener effect が `[debugEnabled]` で再購読され、直前 epoch の pending rAF は cleanup の `cancelAnimationFrame` で破棄される。unmount 時も同じ経路。
- ON 時の採取は rAF 1 本に coalesce され（`scrollbarDebugFrameRef` を毎回 cancel して再予約）、pointermove 連打でも 1 frame 1 回に収束する。
- menu item は `role="menuitemcheckbox"` + `aria-checked` で Split View と同形。panel は `<section aria-label="Debug information">`、entry も `aria-label={title}` を持つ。
- grid row は `.app-shell` を 6 行へ拡張し、`.debug-panel { grid-row: 5 }` / `.status-bar { grid-row: 6 }` と明示。OFF 時は行が `auto` で高さ 0 となり、既存の「chrome 要素は明示 grid-row」という detail_design の規約とも一致する。狭幅 media query で 1 列へ落とす対応もある。
- stale entry は `tab-strip-secondary` を split off 時に除外する filter で扱っている（→ 指摘 11.2-2）。

**(3) style flush の最小性・副作用**

- 実行条件は「`isScrollbarVisible` か `tabs.length` が変化した次の frame」かつ「overflow 時」のみ。読み取りは `getBoundingClientRect` 1 回と `getComputedStyle(strip, "::-webkit-scrollbar-thumb")` 1 回で、書き込みも setState も無いため infinite render は構造的に起こらない。`scrollLeft` を触らないため scroll 位置も動かない。
- pointermove ごとには実行されない。cleanup で frame を cancel するため unmount 後の実行も無い。
- pseudo-element 名を解さない engine では `getComputedStyle` が要素自身の宣言を返すだけで例外にならず、非 WebKit 回帰は生じない。副作用が「読むこと」自体である以上 engine 依存の workaround だが、その旨は設計 §23 と `common_pitfalls.md` に記録済み。

**(4) `getTabRevealDelta` の peek geometry**

- 追加引数は既定値が `itemStart` / `itemEnd` のため、既存呼び出しと後方互換。`leadingPeekStart > itemStart` / `trailingPeekEnd < itemEnd` を invalid として throw し、peek が item の内側を指す誤用を型ではなく契約で塞いでいる。非 finite も全 7 引数を検査。
- 左欠け時は `max(leadingPeekStart - visibleStart, itemEnd - visibleEnd)`、右欠け時は `min(trailingPeekEnd - visibleEnd, itemStart - visibleStart)`。前者は「item 右端が視界外へ出ない下限」、後者は「item 左端が視界外へ出ない上限」であり、**選択 item 全体の可視性が常に優先**される。clamp 後も delta は有効域内に収まる。
- `itemWidth > visibleWidth`（oversized）は peek より先に左端優先へ分岐し、往復を起こさない。padding 過大で `visibleWidth = 0` になる極端な狭幅でも throw せず左端優先へ倒れる。先頭 / 末尾は既定値により従来挙動。
- test は左右 peek、clamp 2 方向、peek 逆転 2 種の throw を追加し、既存の完全表示 / 端一致 / oversized / 非 finite と合わせて境界が固定されている。

**(5) DOM integration（rect / midpoint / 振動）**

- `revealTab` は `tabs` の index から前後 item ref を引き、`rect.left + rect.width / 2` で中点を渡す。flex 行で item は重ならないため `previousMid <= itemRect.left`、`nextMid >= itemRect.right` が常に成立し、policy の contract 違反（throw）は起きない。ref 未登録時は `?? null` で peek 無しへ縮退する。
- 呼び出し経路は activeTabId / tabs.length 変化の rAF、`focusTab` の rAF、`.tab-item` の `onFocusCapture` の 3 つ。peek 適用後は選択 item が完全表示になるため、後続呼び出しは delta 0 を返して停止する。pointer click（focus capture → 直後に effect rAF）でも 2 回目は 0 になり、二重 scroll や frame 往復は発生しない。
- move / close 後の focus 経路（`focus({ preventScroll: true })` + reveal）も同じ関数を通り、ancestor scroll は起きない。

**(6) 既存機能の回帰**

40px 外寸（shell 40px + strip 100%）、6px track、`::-webkit-scrollbar` の transparent 化、上端 indicator、reduced motion、drag session / click 抑止 identity / `elementFromPoint` / pointerup 再判定 / `moveTab` / cancel 経路、`preventScroll` + item 全体 reveal、preview / Explorer / app shell を動かさない性質のいずれにも差分は無い。`splitView.ts` / `paneRuntime.ts` も無変更。自動検証はレビュー担当でも再実行し、113 tests / build / `git diff --check` / fmt / check / 22 Rust tests がすべて記録どおりだった。

**(7) 文書の一貫性**

設計 §2.2 / §3.1 / §4.3 / §4.5 / §5 / §7.2 / §14 / §18 と新設 §21〜§23、実装記録 §3.2 / §9、`verification/phase4a_user_verification.md` の Round 3 / Round 4 記録、`interface_spec.md`（Debug Information 表示節を新設）、`detail_design.md`、`basic_design.md`、`README.md`、`common_pitfalls.md`、`development_workflow.md`、`docs/tests/README.md`、`meta.md` が、試行履歴（`:focus-within` → `:hover` → 明示 class → shell 境界 → 診断 → style flush → peek reveal）と最終仕様を矛盾なく記録している。設計 §22 の「診断 UI は除去する」は StatusBar 一時診断を指し、同節末尾で汎用パネルへ移行する旨を明記しているため §23 と矛盾しない。ただし test 件数と Phase 4-a 結果の記録に不足がある（→ 指摘 11.2-4 / 11.2-5）。

**(8) 新規 API の責務・型・拡張性**

`shouldShowTabScrollbar` は OR policy を 1 箇所に固定し、`formatTabStripDebugLines` / `TabStripDebugSnapshot` は false と unavailable を欠落させない整形規約を型と test で固定している。DebugPanel は provider ID / title / lines の汎用 entry だけを扱い、TabStrip 固有の書式を解さない。`debugPanelEventName` の CustomEvent は同一 window 内部専用で、opaque origin の trusted HTML iframe からは dispatch できないため security 面の新規面は無い。

### 11.3 新規指摘

#### 11.3-1 window `pointermove` が常時 shell 矩形を読むようになり、Round 3 で確認した「領域外では layout を読まない」性質が後退した

**severity**: Low / **blocking**: 非 blocking / **status**: 未解決

**根拠**: Round 3 の handler は `if (!pointerInsideRef.current) return;` を先頭に置き、pointer が TabStrip 外にある通常時は `getBoundingClientRect` に到達しなかった（本レビュー §10.3(4) で性能上の妥当性の根拠にした点）。Round 4 の双方向同期はこの early return を外し、**window 上のすべての `pointermove` で shell 矩形を 1 回読む**（split 時は instance 数ぶんで 2 回）。preview の Mermaid / PlantUML 描画中や drag 中など layout が dirty な瞬間には forced synchronous layout になり得る。実機確認では問題が出ておらず、rAF 採取は debug 時のみのため実害は小さい。

**推奨対応**: 双方向同期自体は enter 取りこぼしの回復に必要なので維持する。負荷が問題になる場合のみ、(a) 判定を rAF 単位へ coalesce する、(b) shell 矩形を cache し `resize` / split 変更 / strip の `scroll` で invalidate する、のいずれかを検討する。Phase 4-b の必須条件とはしない。

#### 11.3-2 汎用 DebugPanel に provider 固有 ID の知識が残り、停止した provider の entry が残留する

**severity**: Low / **blocking**: 非 blocking / **status**: 未解決

**根拠**: App の描画側で `entries.filter((entry) => splitViewState.mode === "split" || entry.id !== "tab-strip-secondary")` と、pane 固有 ID を直接判定している。汎用 entry を掲げる設計に対して表示器が provider を知っており、provider が増えるたびに条件が積み上がる。また provider が発行を止めた場合（unmount 以外の停止）、entry は最後の値のまま残り、診断中に古い値を現在値と誤読する余地がある。

**推奨対応**: provider が unmount / 停止時に「削除」を意味する entry（例: `lines: []`）を発行して App 側で除去する、または entry に `scope` / 更新時刻を持たせて汎用に扱う。今回は診断専用機能であり影響は限定的なので、次に provider を追加する時点での対応で足りる。

#### 11.3-3 Debug OFF 経路の `setDebugPanelEntries({})` が毎回新しい object を作り、余分な App 再 render を 1 回発生させる

**severity**: Low / **blocking**: 非 blocking / **status**: 未解決

**根拠**: `useEffect` の `!isDebugPanelVisible` 分岐が無条件に `setDebugPanelEntries({})` を呼ぶ。初期 mount 時は既に `{}` だが参照が変わるため bail out されず、App が 1 回追加で render する。ON→OFF 遷移でも同様。deps は `[isDebugPanelVisible]` のみで再入しないため無限ループにはならない。

**推奨対応**: `setDebugPanelEntries((current) => (Object.keys(current).length === 0 ? current : {}))` のように空なら同一参照を返す。

#### 11.3-4 実装記録の test 件数が現状と一致しない

**severity**: Low / **blocking**: 非 blocking / **status**: 未解決

**根拠**: 実装記録 §5「検証結果」表は `npm test -- --run` を「6 files / 97 tests」と記載したままで、現在の 113 tests と一致しない（§5 は round 名を持たない現行結果の表として読める）。また §9 末尾の「unit test を 108 件から 113 件へ拡張した」は、`d0d45bf` が追加した test が 4 件であることから実際には 109 → 113 であり、1 件ずれている（104 → +4 `shouldShowTabScrollbar` → +1 formatter = 109）。

**推奨対応**: §5 の表を最新値（113 tests / 22 Rust tests）へ更新するか「Phase 3 初回時点」と明示し、§9 の件数を 109 → 113 へ訂正する。Phase 4-b の完了記録作成時にまとめて反映すればよい。

#### 11.3-5 Phase 4-a の合格結果（scrollbar / peek reveal）が検証記録と meta に未記載

**severity**: Low / **blocking**: 非 blocking（ただし **Phase 4-b の前提**） / **status**: 未解決

**根拠**: 依頼では実 WebView で「起動直後 Debug OFF / ON とも scrollbar が期待どおり」「隣接 tab 50% peek が期待どおり」と確認済みだが、`verification/phase4a_user_verification.md` は style flush build の合格までで、peek reveal については「次回はこうする」という要望記録で終わっている。`meta.md` も Phase 4-a 行が「adjacent-tab peek reveal verification pending」、`verification_status: in_progress` のままである。このままでは Phase 4-b の完了処理が「Phase 4-a 合格」の根拠文書を欠く。

**推奨対応**: Phase 4-b の完了処理で、検証記録へ Round 5 の合格結果（scrollbar は Debug OFF / ON / 再 OFF、peek reveal は左右見切れ・先頭 / 末尾・幅不足）を追記し、`meta.md` の Phase 4-a 行と `verification_status` を合格へ更新する。

#### 11.3-6 `View > Debug Information` が TODO-2026-026 の scope / completion に未記載で、追跡項目と成果物が対応しない

**severity**: Low / **blocking**: 非 blocking / **status**: 未解決

**根拠**: DebugPanel は恒久 docs（`interface_spec.md` の新設節、`README.md`、`detail_design.md`、`development_workflow.md`）に利用者向け機能として記録されたが、`docs/todo/todo.md` の TODO-2026-026 は scope / non_scope / completion のいずれにも診断 UI を挙げていない。原因調査の副産物として妥当な追加ではあるが、追跡項目と成果物の traceability が切れている。

**推奨対応**: TODO-2026-026 の scope へ 1 行追加するか、Phase 4-b 完了記録で「原因調査から派生した追加機能」として明示的に受理を記録する。どちらでも良いが、どこにも書かない状態は避けること。

### 11.4 残リスク

| # | 内容 | severity | 状態 |
| --- | --- | --- | --- |
| R1 | UA の `:focus-visible` heuristic 依存 | — | **解消**。表示条件から UA selector を全廃し、window `keydown` / `pointerdown` と shell focus による明示 modality へ置換 |
| R2 | native scrollbar pseudo-element の style / paint invalidation 不足 | Low | **workaround 済み**。表示 class 変化と tab 数変化の次 frame に overflow 時だけ layout + computed style を 1 回読む。engine 依存の対処であることは設計 §23 と `common_pitfalls.md` に明記済み。将来 WebView 更新で不要になった際に外せるよう、削除条件を Phase 4-b の記録へ残すことが望ましい |
| R4 | mouse 起点 programmatic focus で thumb を出さない（意図どおり） | Low | 継続 |
| R5 | trusted HTML iframe 内へ pointer が入ると親へ `pointermove` が届かず、解除が `pointerleave` / `blur` 依存 | Low | 継続。Phase 4-a の追加確認で HTML 文書表示中の往復を 1 度確認しておくと良い |
| R6 | pointer 静止中の layout 変化は次の move まで反映されない | Low（自己修復） | 継続 |
| R7 | drag 中に destination へ thumb が出ない | — | **解消**（双方向同期により表示される） |
| R8 | pure policy の invalid geometry throw が window listener 内で発生し得る | Low | 継続（実 rect では到達しない。peek 契約違反も DOM 実装上発生しない） |
| R9 | 表示 modality を自前管理したため、UA の focus ring（`:focus-visible`）と thumb 表示条件が理論上ずれ得る（例: 一部の programmatic focus） | Low（新規、cosmetic） | Phase 4-a の keyboard 確認で ring と thumb の同時観察を推奨 |

### 11.5 自動検証（レビュー担当による再実行）

| 検証 | 実装側の記録 | レビュー担当の再実行 |
| --- | --- | --- |
| `npm test -- --run` | 6 files / 113 tests passed | 成功。6 files / 113 tests |
| `npm run build` | success（既存 chunk size warning のみ） | 成功（同 warning のみ） |
| `cargo fmt -- --check` | success | 成功 |
| `cargo check` | success | 成功 |
| `cargo test` | 22 passed | 成功。22 passed |
| `git diff --check` | success | 成功 |

### 11.6 集計と結論（Round 4）

| 分類 | 件数 |
| --- | --- |
| 新規指摘 | **6**（blocking 0 / non-blocking Low 6: 11.3-1〜11.3-6） |
| 未解決指摘 | **6**（すべて Low） |
| 過去 round からの未解決 | 0 |
| 残リスク | 6 件継続（R2 / R4 / R5 / R6 / R8 / R9）、R1 / R3 / R7 は解消 |

**Phase 3 判定**: **承認 (Approved)**。

`:focus-within` → `:hover` → 明示 class → outer shell 境界 → 実機診断 → style flush という 4 round の追跡は、各段階で仮説・観測・棄却理由を検証記録へ残しており、最終的に「表示条件を UA selector から完全に切り離す」「native scrollbar の初回 paint を明示 flush する」という原因対応へ到達している。推測での重ね当てではなく、診断 ON/OFF を変数として分離した切り分けは妥当である。実装面では pure policy への切り出し（`shouldShowTabScrollbar`、`isPointInsideTabStrip`、peek 付き `getTabRevealDelta`、`formatTabStripDebugLines`）と DOM 側の責務分離が保たれ、既存の 40px / 6px track / indicator / reveal / drag lifecycle に回帰は無い。検出した 6 件はいずれも性能特性、debug 機能の拡張性、記録の正確性に関する Low であり、機能の受け入れ判定を左右しない。

**Phase 4-b 進行可否**: **進行可**。Phase 4-a は実 WebView で scrollbar（起動直後 Debug OFF / ON）と隣接 tab 50% peek reveal の双方が期待どおりと確認されており、Phase 3 側に blocking は残っていない。ただし Phase 4-b の完了処理で次を必ず実施すること。

1. `verification/phase4a_user_verification.md` へ Phase 4-a 合格結果（scrollbar と peek reveal）を追記し、`meta.md` の Phase 4-a 行と `verification_status` を合格へ更新する（11.3-5）。
2. 実装記録 §5 / §9 の test 件数を実測値へ整合させる（11.3-4）。
3. `View > Debug Information` の受理を TODO-2026-026 または完了記録へ明示する（11.3-6）。
4. 11.3-1 / 11.3-2 / 11.3-3 は任意対応とし、対応しない場合は既知の改善余地として完了記録へ残す。
