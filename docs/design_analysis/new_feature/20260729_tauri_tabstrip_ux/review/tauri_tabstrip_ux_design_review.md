# TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善 設計レビュー

**レビュー日**: 2026-07-29
**対象ドキュメント**: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/design/tauri_tabstrip_ux_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-026
**初回レビュー対象コミット**: `affc977` (Phase 2 prepare Tauri TabStrip UX design)
**Round 1 fix コミット**: `1bc136e` (Phase 2 address Tauri TabStrip UX design review)
**Round 1 再確認日**: 2026-07-29
**初回判定**: 条件付き差し戻し (Changes Requested)。blocking Medium 4 件 / non-blocking Medium 3 件 / Low 10 件 = 検出 17 件。
**最終判定**: **承認 (Approved)**。Phase 3 進行可。初回 17 件は Round 1 fix (`1bc136e`) ですべて設計上解決済みと再確認した。Round 1 再確認で新規検出した **non-blocking Medium 1 件 / Low 2 件 = 3 件**は、いずれも Phase 3 の実装差分と同じ改訂で閉じられるため進行を妨げない。**未解決 3 件（すべて non-blocking、Phase 3 実装レビューで確認）。**

---

## 概要

TODO-2026-026 の Phase 2 設計レビュー（初回）。現行実ソース（`markdown-viewer-tauri/src/App.tsx`、`App.css`、`splitView.ts`、`paneRuntime.ts`、`splitView.test.ts`、`paneRuntime.test.ts`、`package.json`）、TODO-2026-023 の確定設計・レビュー（`docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/`）、恒久 docs（`docs/components/tauri_viewer/`、`docs/architecture/`、`docs/rules/development_workflow.md`、`docs/tests/`）、`docs/adr/README.md` の起票条件を根拠に検証した。

設計の骨格は妥当である。

- §4.1 の Pointer Events + explicit pointer capture は、Explorer resize（`App.tsx:248-295`）、split separator（`App.tsx:362`）、image viewer pan（`App.tsx:1697`）が既に確立した project pattern と一致する。`pointerdown` で即 `preventDefault` せず閾値到達まで待つ方針も、click / focus を壊さない点で正しい。
- §4.2 の native HTML Drag and Drop 不採用は、同一 React tree 内の typed ID 操作という本件の性質と、WebView 差の実務コストに照らして妥当である。
- §4.3 の `tabStrip.ts` pure policy 追加は、`splitView.ts` / `paneRuntime.ts` / `explorerPane.ts` / `documentPolicy.ts` / `imageViewer.ts` が確立した「React / DOM / Tauri 非依存の exported pure function」pattern と一貫し、`docs/architecture/code_patterns.md:23` の記述とも整合する。mutable module-global state を持たない旨、class wrapper を採らない旨も明記されている。
- §9.5 の「`splitView.ts` の `move-tab` を変更しない」は正しい。現行 reducer（`splitView.ts:145-180`）は source removal / fallback（`findAdjacentTabId`）、destination dedupe add、`activePaneId` 更新、`pendingNavigation` 規則、single / same-pane / non-member guard を既に atomic に閉じており、drag 専用 action を足す理由が無い。§12 の「destination に同じ tab ID あり」「source が非 active」「active source が最後の 1 件」は、いずれも現行 reducer の実挙動と一致する。
- §4.6 の不採用案表（state text 温存、状態別高さ、activate button だけの reveal、`container: "nearest"` 追加のみ、pane arrays 直接更新、preview pane 全体 drop、pointermove ごとの App state 更新、cancel 時の move fallback）は、review checkpoint 2 / 3 / 5（重複経路・不要 fallback・責務逸脱を増やさない）と一致する。
- §15 の ADR 追加不要判断は妥当である。`docs/adr/README.md:9-21` の起票条件は「既に採用済み」「複数案件で再利用」を要求し、「案件固有の詳細設計」を明示的に対象外としている。本件の Pointer Events drag と TabStrip policy は現時点で Tauri component 固有であり、Avalonia 展開時の再評価という保留も条件に沿う。
- 非対象（§3.2）の切り方も適切である。特に「`move-tab` へ曖昧な optional index を先行追加しない」（§3.3）は、TODO-2026-023 で確立した typed transition 方針を保っている。

一方で、**DOM / CSS / event lifecycle 側の契約に、実装者が推測で埋めるしかない穴が残っている**。blocking とした 4 件はいずれも「設計が自ら掲げた不変条件が、その設計のまま実装すると破れる」類であり、Phase 3 の差分を見てからでは戻りが大きい。

本プロジェクトの frontend test は `vitest` のみで jsdom / React Testing Library を持たない（`markdown-viewer-tauri/package.json`、既存 test は 5 本すべて pure module）。したがって §13 の自動 test は pure policy に閉じるという設計判断自体は正しいが、**pointer capture、click 抑止、cleanup、focus / scroll 調停は 100% 手動 matrix 依存**になる。この前提の下では、設計文書が DOM 契約をどこまで確定できているかが実装品質を直接左右する。

---

## 1. 齟齬・不整合（blocking）

### 1.1 `focus()` 自体の UA scroll を抑止する契約が無く、§4.4 の「TabStrip だけを scroll する」方針が focus 経路で破れる

**severity**: Medium（blocking）
**工程**: Phase 2（設計追記）
**status**: 未解決

**ドキュメント記載**: §4.4「変更後は…`strip.scrollBy({ left: delta, behavior: "auto" })`だけを実行する。…対象containerをコード上でTabStrip 1つに固定する。」§7.2「revealは次で呼ぶ。…`.tab-item`の`onFocusCapture`。…destination move後のfocus処理。focusより先にDOMを取得し、focus captureと同じrevealを通す。」§16「scrollがouter paneを動かす → manual strip-only delta、item外枠ref」。

**根拠 / 差異**: §4.4 が `scrollIntoView` を退ける理由は「既定で ancestor scroll container を順に処理するため、TabStrip 以外の scroll を巻き込む余地がある」ことだが、**同じ ancestor scroll は `HTMLElement.focus()` 自身が行う**。HTML 標準の focusing steps は、`preventScroll: true` を指定しない限り対象要素に対して scroll-into-view（block / inline とも `nearest`）を実行する。本設計の reveal trigger は 3 つのうち 2 つが focus 経路（`onFocusCapture`、destination move 後の focus）であり、現行実装の focus 呼び出しも `focusTab`（`App.tsx:2455-2461`）、`close`（同 2490-2497）、`moveTab`（同 789-801）とすべて素の `focus()` である。

`scrollIntoView` 呼び出しだけを manual delta へ置き換えても、その直前の `focus()` が UA scroll を起こすため、次が残る。

- ancestor には `.document-pane { overflow: hidden }`（`App.css:802-811`）、`.app-shell { overflow: hidden }`（同 35-43）がある。`overflow: hidden` の box は scroll container であり、UA の scroll-into-view で `scrollLeft` / `scrollTop` が動きうる。§16 が「preview / shell 位置変化」として挙げたリスクが、置き換え後もそのまま残る。
- UA scroll は **activate button** を対象にするため、まず button だけが入る位置へ寄り、その後 policy delta が item 外枠へ寄せ直す。overflow 時に 2 段 scroll（視覚的な跳ね）が起きる。

これは実装者が気付かなければ「`scrollIntoView` を消したのに §4.4 の目的が達成されない」形で残り、しかも自動 test で検出できない（jsdom 非採用、手動 matrix の項目 5 も最終位置しか見ない）。

**推奨対応**: §7.2 と §9.2 へ「TabStrip / App が行う focus はすべて `focus({ preventScroll: true })` とし、水平位置の調整は `getTabRevealDelta` + `strip.scrollBy` だけが行う」を明記する。対象は roving navigation（`focusTab`）、close 後の focus、`moveTab` の destination focus、pane fallback focus（`document-pane-*`）である。あわせて §14 の手動 matrix 5 / 8 へ「focus 時に preview / Explorer / shell が縦横に動かないこと」を追加する。

### 1.2 drag 成立時の click 抑止 flag の解除条件が未定義で、drop 成功時は click が来ないため次の tab click を飲む

**severity**: Medium（blocking）
**工程**: Phase 2（設計追記）
**status**: 未解決

**ドキュメント記載**: §8.2「6px閾値到達時にdraggingへ遷移し、click抑止flag、source / preview feedback、body class、live statusを有効化する。」§8.4「cleanupはsession ref、presentation state、body class、preview transform、live statusを一つの関数で解除する。」§16「clickとdragの競合 → 6px thresholdとdrag成立時のone-shot click抑止」。

**根拠 / 差異**: §8.4 の cleanup 対象列挙に **click 抑止 flag が入っていない**。そして flag を消費するはずの click は、成功 drop では発生しない可能性が高い。

- drop 成功時、`moveTab` の `applySplitView` は pointerup handler 内で同期的に state を更新し、React 19 は event handler 内更新を同期 flush するため、**browser が click を dispatch する前に source の `.tab-item` が unmount される**（`App.tsx:2521-2571` の tab item は `orderedTabIds` から消える）。detached node に対する click は React root へ bubble せず、`onClick` は呼ばれない。
- 結果、閾値到達時に立てた one-shot flag が消費されないまま残る。次に利用者が任意の tab の activate button を click すると、その click が「drag 直後の抑止対象」として捨てられ、tab が切り替わらない。利用者からは「drag した直後だけ tab click が 1 回効かない」という再現性のある不具合になる。
- §12 の境界条件表にもこの経路（drop 成功 → click 未発火）が無く、「設計は境界を閉じている」という §12 の前提が成立しない。

**推奨対応**: 抑止 flag の生存期間を設計で確定する。最小案は「flag を cleanup 関数の解除対象に含め、drag 終了（drop / cancel いずれも）から次の `pointerdown` または `requestAnimationFrame` 1 フレーム後に必ず落とす」。あわせて §8.4 の cleanup 列挙へ flag を追加し、§12 へ「drop 成功で source item が unmount し click が発火しない」行を追加、§14 手動 matrix へ「drag 直後に別 tab を click して 1 回目で activate されること」を追加する。なお、click 抑止を DOM 要素側の `capture` phase click listener で行うか React `onClickCapture` で行うかも、source が unmount する前提では結論が変わるため §9.2 で明示すること。

### 1.3 §4.5 の「classic scrollbar では常に同じ内部寸法を確保」は `overflow-x: auto` では成立しない

**severity**: Medium（blocking）
**工程**: Phase 2（設計修正）
**status**: 未解決

**ドキュメント記載**: §4.5「`overflow-x: auto`と6pxのscrollbar寸法を維持し…scrollbar自体の追加・除去や`overflow-x: hidden`切替は行わない。classic scrollbarでは常に同じ内部寸法を確保し、overlay scrollbar環境でもTabStrip外寸40pxを維持する。overflowがない場合はthumbが生成されないため、不要なbarは見えない。」§7.1「scrollbarは6px。content control領域は最低33pxを確保し、indicator 2〜3pxをoverlayしてbutton layoutを押し下げない。」

**根拠 / 差異**: 同じ段落の中で相反する 2 つの主張が並んでいる。`overflow-x: auto` は **overflow が無ければ scrollbar box を生成せず、layout 上の 6px も確保しない**。したがって classic（non-overlay）scrollbar 環境では、

- overflow 無し: `.tab-strip` content box = 40px → `.tab-item` は 40px へ stretch
- overflow 有り: content box = 34px → `.tab-item` は 34px へ stretch

となり、tab を 1 つ増減して overflow 境界を跨いだ瞬間に **tab item の内寸が 6px（外寸の 15%）変化**する。外寸 40px と preview 上端は動かないので TODO の受け入れ条件（「preview上端に段差や高さ変動が生じない」）自体は守られるが、§4.5 が自ら宣言した「常に同じ内部寸法」は守られず、上端 indicator と text の垂直位置が状況で変わる。

さらに WebKit / Chromium 系では、`::-webkit-scrollbar` に寸法を定義すると overlay scrollbar ではなく styled classic scrollbar として扱われ、layout 上 6px を占める環境がある（macOS WKWebView / WebKitGTK）。現行 CSS には `::-webkit-scrollbar` 規則が無く `scrollbar-width: thin` だけ（`App.css:858-867`）なので、本件は**新規に持ち込む挙動変化**であり、58px の現状では顕在化していなかった。

**推奨対応**: どちらの不変条件を採るかを設計で決める。

- 案 A（推奨・設計意図に忠実）: `.tab-strip` を `overflow-x: scroll` にして 6px の track 領域を常時確保し、thumb / track を通常時 transparent、`:hover` / `:focus-within` で thumb だけ muted にする。内寸は常に 34px で固定でき、§4.5 の主張と §7.1 の 33px 見積もりが両立する。overlay scrollbar 環境では track を描かないため見た目も変わらない。
- 案 B: `auto` を維持し、§4.5 から「常に同じ内部寸法」を削除して「外寸 40px 固定、overflow 有無で内寸が 6px 変わることを許容する」と明記し、§7.1 の control 高さ見積もりを 34px 側で確定する。

いずれの案でも §14 手動 matrix 4 へ「tab を overflow 境界前後で増減しても item の見た目高さが破綻しないこと」を追加すること。

### 1.4 §15 が恒久 docs の置換対象行を特定しておらず、新仕様と真正面から矛盾する確定記述が残る

**severity**: Medium（blocking）
**工程**: Phase 2（設計追記）
**status**: 未解決

**ドキュメント記載**: §15「恒久ドキュメント更新予定」（ファイル名と概略トピックの列挙）。

**根拠 / 差異**: TODO-2026-023 の Phase 2 レビュー指摘 1.3 で同じ問題が指摘され、`e21fe5d` で「置換対象表」へ全面改稿されたことにより解決している（`docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/review/tauri_pane_local_tab_groups_design_review.md`）。本設計はその運用前に戻っている。現行 docs には、本設計と両立しない**確定記述**が最低 4 箇所ある。

- `docs/components/tauri_viewer/detail_design.md:474`「TabStrip rowはstate labelやhorizontal scrollbarの有無に左右されない58px固定高とし」— 40px へ置換必須。
- `docs/components/tauri_viewer/interface_spec.md:62`「TabStripはname 1行、Loading / Rendering / Errorのstate 2行目、empty、水平scrollbar有無にかかわらず58px固定高とし」— state 2 行目の廃止と 40px を反映必須。
- `docs/components/tauri_viewer/interface_spec.md:12`「Tab move: split時だけactive tabの`→` / `←` buttonで反対paneへ移動する」— pointer drag と**非 active tab からの移動**（§8.2）を反映必須。
- `docs/rules/development_workflow.md:177`「…TabStripが58px固定高を維持し、preview上端に段差が出ないこと」— これは Phase 4-a の合否基準そのものであり、放置すると手動確認が旧基準で行われる。

加えて `docs/components/tauri_viewer/interface_spec.md:59`「activate buttonとactive tabのmove / close buttonだけをTabキーのfocus順に含める。非active tabを操作する場合は、先に矢印キーでactivateする」は、本設計 §8.2 の「非 active tab の直接 drag を許可する」と操作モデルの前提が変わる箇所であり、更新要否の判断が設計に無い。

**推奨対応**: §15 を「file / 現行記述 / 置換後の要旨」の 3 列表へ改め、上記 4 行を最低限の置換対象として明示する。`interface_spec.md:59` については「keyboard 経路は現行契約を維持し、pointer drag だけが非 active tab を直接扱える」ことを追記対象として確定する。新規 module の登録先（`docs/components/tauri_viewer/README.md` の file map と `basic_design.md` の TypeScript policy 一覧）も表へ含めること（→ 3.8）。

---

## 2. 設計品質（non-blocking）

### 2.1 loading / rendering indicator に使える既存 theme token が無く、§9.6 の制約に従うと Light theme で不可視になりうる

**severity**: Medium（non-blocking）
**工程**: Phase 2（設計追記）または Phase 3（token 追加）
**status**: 未解決

**ドキュメント記載**: §6.1「`loading` → muted accent 2px full」「`rendering` → accent segmentのindeterminate animation」。§9.6「Light / Dark双方で既存theme tokenを使い、固定RGBを追加しない。」

**根拠 / 差異**: `.app-shell` が持つ token（`App.css:45-58` / dark は `61-75`）に「muted accent」に相当するものが無い。候補は `--accent-soft`（Light `#e8f0ff` / Dark `#1e314f`）だが、これは背景 tint 用であり、Light では TabStrip 背景 `--chrome-bg: #f9fafb` の上に 2px 線として置いてもほぼ判別できない。`--muted`（`#69717d`）は accent 系ではなく ready との差が「線の有無」だけになり、`--accent` を使うと active の accent 線と loading が同色になる。結果、§9.6 の字面に従うと「Light で loading indicator が見えない」実装に落ちる現実的な確率が高い。

**推奨対応**: §9.6 の制約を「component 内に固定 RGB を直接書かず、`.app-shell` と `:root[data-theme="dark"] .app-shell` の両方へ semantic token を追加して参照する」へ言い換え、`--tab-indicator-loading` / `--tab-indicator-rendering` / `--tab-indicator-error`（error は `--error-text` の別名でよい）を新設対象として §7.1 へ明記する。あわせて Light / Dark いずれでも `--chrome-bg` および `--panel-bg`（active 時の背景）双方に対して視認できる値を選ぶ、という受け入れ条件を §14 手動 matrix 2 へ具体化する。

### 2.2 非 finite geometry の契約が「scroll しない」と「silent fallback を返さない」で矛盾している

**severity**: Medium（non-blocking）
**工程**: Phase 2（設計修正）
**status**: 未解決

**ドキュメント記載**: §7.2-5「非finite geometryはprogramming / DOM integration errorとしてscrollせず、testで到達させない。silent fallback値は返さない。」

**根拠 / 差異**: 「scroll せず」は `0` を返す（= fallback 値を返す）挙動を、「silent fallback 値は返さない」は throw を、それぞれ示唆しており、実装者はどちらとも読める。project の pure module には両方の前例がある。`splitView.ts` は不正入力に対して `assertSplitRatio` / `assertPaneId` で throw する一方（`splitView.ts:369-379`）、`getSplitPaneWidthBounds` は非 finite width に対して `null` を返す（同 290-306）。したがって前例からも一意に決まらない。

さらに §13.1 の test 一覧に非 finite の case が無く、§12 の境界条件表にも行が無いため、決めた挙動が自動検証されない。

**推奨対応**: 「`getTabRevealDelta` は非 finite 入力に対して throw する（呼び出し側は DOM rect を渡すだけで、非 finite は integration bug）」か「`null` を返し呼び出し側が scroll を行わない」かを一方に確定する。`scrollBy` を呼ぶのは TabStrip 側であることを踏まえると、`splitView.ts` の assert pattern に合わせて throw を推奨する。§13.1 へ当該 case、§12 へ 1 行を追加すること。

### 2.3 touch / pen pointer と TabStrip の horizontal scroll の競合方針が未定義

**severity**: Medium（non-blocking）
**工程**: Phase 2（設計追記）
**status**: 未解決

**ドキュメント記載**: §8.2「split mode、primary pointer、button 0、未開始session、activate button本体からのpointerdownだけを受理する。」

**根拠 / 差異**: 受理条件に `pointerType` が無く、`touch` / `pen` も `isPrimary` かつ `button === 0` を満たすため、設計上は touch drag も開始しうる。しかし `.tab-strip` は `overflow-x: auto` の scroll container であり、`touch-action` を指定しない限り touch / pen の panning が UA に取られ、`pointercancel` が飛んで drag は成立しない（設計上は「cancel」として正しく no-op になるが、利用者からは「touch では drag が効かない」挙動になる）。既存の pointer 操作面は 3 箇所とも `touch-action: none` を明示している（`App.css:386` Explorer resize、`665` image viewer、`827` split separator）ので、TabStrip だけ方針が空白になっている。

**推奨対応**: どちらかを設計で選ぶ。(a) `.tab-activate` へ `touch-action: none` を付けて touch drag も成立させる（ただし tab 上からの touch scroll は不可になる）、(b) `pointerType === "mouse" | "pen"` に限定し、touch では従来どおり tap activate + 矢印 move button に閉じる。desktop 前提の application であることを踏まえると (b) を推奨する。いずれにせよ §8.2 の受理条件と §7.1 の CSS へ明記すること。

---

## 3. 改善提案（Low）

### 3.1 `resolveTabDropPane` の candidate 引数型が `PaneId` だが、実入力は dataset 由来の `string | null`

**severity**: Low / **status**: 未解決

§4.3 の signature は `resolveTabDropPane(sourcePaneId, candidatePaneId, mode): PaneId | null` で candidate も `PaneId` 型だが、§8.3 の入力は `elementFromPoint` → `closest("[data-tab-drop-pane]")` → `dataset.tabDropPane` であり実体は `string | undefined`、かつ §8.3 は「unknown value は invalid target」、§13.1 は「unknown candidate の drop target 判定」を test 対象に挙げている。`PaneId` 型のままでは unknown を渡す test が型検査を通らず、`as` cast を書かせることになる。→ candidate 引数を `string | null` とし、関数内で `"primary" | "secondary"` へ narrowing する契約を §4.3 に書くこと。あわせて `elementFromPoint` が viewport 外座標や pointer capture 中の対象なしで `null` を返す場合も同じ invalid 経路に入ることを §8.3 へ明記する。

### 3.2 drop pane を pointerup で再判定するか、直近 pointermove の結果を使うかが未定義

**severity**: Low / **status**: 未解決

§8.4「valid target上のpointerupだけ`moveTab`を1回呼ぶ」は、`TabDragSession.dropPaneId`（§8.1）を信頼するとも、pointerup 座標で再判定するとも読める。pointermove は coalesce されうるため、最後の移動と release の間に target 境界を跨ぐと stale な判定で move / no-move が決まる。→ 「pointerup の `clientX` / `clientY` で `elementFromPoint` を再実行し、その結果だけを drop 判定に使う（session の `dropPaneId` は feedback 表示専用）」と §8.4 に明記することを推奨する。

### 3.3 drag session の所有者が §8.1 と §9.1 で二重定義になっている

**severity**: Low / **status**: 未解決

§8.1 は「mutable current sessionとpointer座標は`App`またはTabStrip coordinatorのReact `useRef`に置く」と選択肢を残す一方、§9.1 は「`App.tsx` が cross-pane drag session、drag preview、live status、latest split state 照合を所有する」と確定している。§9.2 は TabStrip を「pointer event を coordinator へ渡すが pane membership を直接更新しない」としており、`App` 所有で一貫する。→ §8.1 の「または TabStrip coordinator」を削り、§9.1 と一致させる。TabStrip は現状 `App.tsx` 内の関数 component（`App.tsx:2432-2575`）であるため、別 module 化を行うか否かも併記すると Phase 3 の差分が読みやすい。

### 3.4 Escape cancel の listener scope と登録期間が未定義

**severity**: Low / **status**: 未解決

§8.4「Escapeはdefaultを抑止し、captureを安全にreleaseしてcancelする」は listener の置き場所を書いていない。pointer drag 中の focus 位置は source activate button とは限らず（drag 開始で focus が移らない環境もある）、React の要素 handler では取り逃す。既存 pattern は `document` level の `keydown` effect（menu: `App.tsx:1131-1143`、image viewer: `1530-1558`、settings dialog: `1948-1979`）であり、Explorer resize / separator drag には Escape cancel が無いので前例が無い。→ 「`dragging` 中だけ `document` へ `keydown` を登録し、cleanup 関数で必ず解除する」と明記する。あわせて menu 展開中など他の `document` level Escape handler と同時発火した場合の扱い（drag 側で `stopPropagation` するか、両方処理してよいか）を 1 行で決めること。

### 3.5 pointer 追従 preview の DOM 位置と positioning が未定義で、`overflow: hidden` に clip されうる

**severity**: Low / **status**: 未解決

§8.1 は「pointer追従previewのtransformは専用DOM refへ直接反映する」とだけ書き、要素をどこへ mount するかを決めていない。`.document-pane`（`App.css:802-811`）と `.app-shell`（同 35-43）は `overflow: hidden` であり、pane 配下に置くと反対 pane へ移動した瞬間に preview が消える。→ 「preview は App root 直下に `position: fixed` で 1 つだけ mount し、`transform: translate()` で追従する」と §8.1 / §9.6 へ明記する。§6.3 の `aria-hidden="true"` / `pointer-events: none` は妥当（`elementFromPoint` が preview を拾わないために必須）なので維持すること。

### 3.6 「body class」が既存の transient class 適用 pattern と一致しない

**severity**: Low / **status**: 未解決

§8.2 / §8.4 は cursor feedback を「body class」の有効化 / 解除としているが、既存の同種処理は React state から `.app-shell` の className へ付ける（`App.tsx:1203` の `explorer-resizing` / `split-resizing`、CSS は `App.css:852-856`）。`document.body.classList` を直接触ると React 外の DOM 変異が増え、cleanup 漏れ経路も別系統になる。→ 「drag 中は `.app-shell` へ `tab-dragging` class を付け、`cursor: grabbing` を既存 `.split-resizing` と同じ形式で定義する」へ揃えることを推奨する。

### 3.7 accessible name suffix の実装手段が未定義で、40px 制約と干渉しうる

**severity**: Low / **status**: 未解決

§6.3「activate buttonのaccessible nameはreadyならdisplay name、その他は`<display name>, Loading|Rendering|Error`とする」は、`aria-label` で置換するのか visually hidden な span を内包するのかを決めていない。前者なら `title={tab.path}`（`App.tsx:2541`）が description に降格し現行の full path 確認が維持される一方、後者は 1 行 40px の layout に隠し要素を入れることになり `position: absolute` 等の追加規定が要る。→ `aria-label` 方式を推奨として §6.3 に明記し、visible text（`.tab-name`）が accessible name の先頭一致を保つこと（音声操作の「name in name」要件）を条件として書くこと。

### 3.8 新規 module の登録先が meta / docs に反映されていない

**severity**: Low / **status**: 未解決

§4.3 が `markdown-viewer-tauri/src/tabStrip.ts` / `tabStrip.test.ts` を新設するが、`meta.md` の `components` 一覧に両ファイルが無い。恒久 docs 側でも、pure policy module を列挙している `docs/components/tauri_viewer/basic_design.md:15` と `docs/components/tauri_viewer/README.md:50,74`（file map / module 表）が §15 の更新対象に入っていない。→ `meta.md` の `components` へ 2 ファイルを追加し、§15 の更新対象表（→ 1.4）へ `basic_design.md` と `README.md` の該当行を含めること。

### 3.9 `moveTab(sourcePaneId, tabId)` が destination を暗黙導出しており、判定済みの drop pane を捨てている

**severity**: Low / **status**: 未解決

§2.3-4 は「既存`moveTab(sourcePaneId, tabId)`を1回だけ呼ぶ」としており、現行実装（`App.tsx:780-788`）は destination を「source の反対」で導出する。2 pane 前提では `resolveTabDropPane` の結果と必ず一致するため今回は実害が無いが、drop 判定で得た destination を捨てる構造は、TODO-2026-025（上下 split）や将来の 3 pane 化で「判定と適用がずれる」典型経路になる。→ §9.1 へ「`moveTab` は destination pane を明示引数で受ける形へ広げてよい（reducer 契約は不変）」を選択肢として書き添えるか、逆に「2 pane 前提を保つため導出のままとする」を明示的な判断として記録すること。

### 3.10 §14 手動 matrix 5 は現行 roving 契約では前提の記述が不足している

**severity**: Low / **status**: 未解決

§14-5「先頭・中間・末尾tabのactivate / move / closeへfocusし、item全体が見える」は、`interface_spec.md:59` の確定契約（active tab の controls だけが Tab focus 順に入る、非 active tab は先に矢印キーで activate）を前提にしないと実施できない。手順として「矢印キーで対象 tab を activate → Tab で move / close へ移動」と書かないと、確認者が非 active tab へ Tab で到達できないことを不具合と誤認する。→ 手順を明文化すること。あわせて §7.2 の `onFocusCapture` reveal は、この契約下では「active item 内で activate → move → close へ Tab 移動したとき」に効く経路であることを 1 行補足すると、実装意図が伝わりやすい。

---

## 4. 確認済み観点（指摘なし）

| 観点 | 確認内容 | 結果 |
| --- | --- | --- |
| ユーザ価値・操作導線 | §2.1-2.3 が対象利用者、状態確認導線、drag 導線を具体化し、TODO の `target_users` / `use_cases` と一致 | 問題なし |
| 最小提供範囲 / 非対象 | §3.1-3.3 が reorder、pin、複数選択、永続化、progress 実数、Avalonia 展開、security 境界変更を除外。TODO の `non_scope` を包含 | 問題なし |
| 既存 transition との統合 | §9.5 / §11 が `move-tab` reducer（`splitView.ts:145-180`）を唯一の transition として維持。drag 専用 action / optional index を足さない | 問題なし |
| 責務分割 | App（session / preview / live status）、TabStrip（DOM ref / class / event 中継）、`tabStrip.ts`（pure geometry / threshold / drop 判定）、`paneRuntime.ts`（状態合成）、`splitView.ts`（不変）の分割は既存 pattern に整合（3.3 の所有者記述の重複を除く） | 概ね問題なし |
| mutable module-global state | §4.3 / §9.3 が明示的に禁止。既存 5 module と同じ exported pure function 構成 | 問題なし |
| 重複 transition / 不要 fallback | §4.6 が「drag cancel 時に矢印 move へ fallback」「pane arrays 直接更新」を明確に不採用。§8.4 も「内部不整合は既存 reducer が throw し、drag 専用 fallback で吸収しない」 | 問題なし |
| 状態と active の組み合わせ | §6.1 の表が 4 状態 × active 併用 × accessible suffix × `aria-busy` を一意化し、上端 edge へ線を重ねない規則を持つ。現行の `.tab-item.active`（inset 上端）と `.tab-error`（inset 下端）が box-shadow で競合していた問題（`App.css:885-893`）も pseudo-element 化で解消される | 問題なし |
| 色依存の回避 | 太さ（error 3px）、motion / pattern（rendering）、背景（active）、accessible name の 4 重化。`prefers-reduced-motion` で static pattern へ退避（§6.2） | 問題なし（色値は 2.1 参照） |
| `aria-busy` の適用 | `aria-busy` は global attribute であり `role="tab"` へ付与可能。loading / rendering のみ `true`、error は付けない方針は WAI-ARIA の busy 定義と整合 | 問題なし |
| deprecated drag ARIA | §3.2 / §6.3 が `aria-grabbed` / `aria-dropeffect` を明示的に不採用とし、keyboard / 支援技術は矢印 move button へ一本化 | 問題なし |
| 矢印 move button の位置付け | §2.3 末尾が「fallback 扱いの別仕様にしない」と明記。TODO の `non_scope`（drag を唯一の導線にしない）と一致 | 問題なし |
| pointer capture の retarget 理解 | §4.1 の「capture 中は event.target が source 固定 → `elementFromPoint` で判定」は Pointer Events 標準の retarget 挙動と一致し、`lostpointercapture` と cleanup を分ける判断も正しい | 問題なし |
| drop target の限定 | §4.6 / §16 が preview pane 全体・iframe 上を drop 対象から除外。§11 が iframe sandbox / CSP 不変を確認 | 問題なし |
| performance | §4.6 / §8.1 / §16 が pointermove ごとの App state 更新を退け、座標は ref、React state は target 変更時のみ。preview key（`App.tsx:2370,2381`）は不変なので iframe / Mermaid 再初期化は起きない | 問題なし |
| 境界条件 | §12 の 13 行のうち destination 同一 ID、非 active source、最後の 1 件、split 解除、root reset、invalid release、pointercancel は現行 reducer / guard の実挙動と一致 | 概ね問題なし（1.2 の 1 行欠落を除く） |
| 永続化 / migration | §10 が `OpenDocumentTab` / `SplitViewState` / Rust command / settings schema 不変、drag と scroll 位置は非永続、互換 class / 二重 render 経路を残さない | 問題なし |
| test 設計 | §13.1-13.3 は pure module のみで自動化する構成。`package.json` が vitest のみで jsdom / RTL を持たない現状と整合し、既存 5 test の粒度とも揃う | 問題なし（DOM lifecycle は手動依存という前提を §16 へ 1 行書くとなお良い） |
| 自動検証 command | §13.4 の `npm test -- --run` / `npm run build` / `cargo fmt --check` / `cargo check` / `cargo test` は `docs/rules/development_workflow.md` および CLAUDE.md §3 の必須 command を満たす | 問題なし |
| 手動 matrix の網羅 | §14 の 12 項目が Light / Dark、reduced motion、overflow、狭幅、Markdown / HTML / Mermaid / PlantUML、split 解除 / close / root change を含み、TODO の `success_metrics` を包含 | 概ね問題なし（3.10 / 1.1 / 1.3 の追記提案あり） |
| ADR 判断 | `docs/adr/README.md:9-21` の 4 条件（採用済み / 複数案件で再利用 / 誤りやすい / coding_rules だけでは不足）を満たさず、「案件固有の詳細設計」に該当。将来 Avalonia 展開時の再評価という保留も適切 | 問題なし |
| 要求 traceability | §18 の 9 行が TODO-2026-026 の完了条件 8 項目すべてへ対応。個別に §6 / §7 / §8 / §11 / §12 / §13 を追跡でき、欠落する受け入れ条件は無い | 問題なし |

---

## 5. 集計と結論

| 分類 | 件数 | 内訳 |
| --- | --- | --- |
| blocking Medium | 4 | 1.1 / 1.2 / 1.3 / 1.4 |
| non-blocking Medium | 3 | 2.1 / 2.2 / 2.3 |
| Low | 10 | 3.1 – 3.10 |
| **合計** | **17** | **未解決 17 件 / 解決済み 0 件** |

**結論**: **現時点では Phase 3 へ進めない（条件付き差し戻し）。**

設計の方向性、採用 / 不採用の判断、既存 transition との統合方針、非対象境界、traceability は Phase 2 として十分な水準にある。差し戻す理由は、blocking 4 件がいずれも「設計自身が掲げた不変条件（TabStrip だけを scroll する / 境界条件は閉じている / 内部寸法は不変 / 恒久 docs を同期する）が、この設計のまま実装すると成立しない」点にあり、本プロジェクトの test 構成（jsdom 非採用、DOM lifecycle は手動 matrix のみ）では実装後に検出しづらいためである。

1.1 と 1.2 は設計へ各 1〜2 文の契約追記で閉じる。1.3 は `overflow-x` の値を A / B いずれかへ確定する判断のみ。1.4 は §15 を置換対象表へ改稿する（TODO-2026-023 で確立済みの形式へ戻す）。non-blocking Medium 3 件と Low 10 件は、同じ改訂機会でまとめて反映することを推奨する。

blocking 4 件の反映後に再確認レビューを行い、新たな穴が無ければ Phase 3 へ進行可とする。

---

## 6. 指摘対応 Round 1（実装担当、再確認待ち）

初回17件を設計書とmetaへ反映した。レビュー担当によるfollow-up確認前のため、最終解決判定は未確定とする。

| 指摘 | 対応 | 状態 |
| --- | --- | --- |
| 1.1 focusによるancestor scroll | §7.2 / §9.2 / §12 / §14へ全programmatic focusの`preventScroll:true`とmanual reveal単一路線を追記 | 対応済み・再確認待ち |
| 1.2 click抑止flag lifecycle | §8.1–8.4 / §9.2 / §12 / §14へgesture identity、matching click capture、次frame / 次pointerdown clear、unmount経路を確定 | 対応済み・再確認待ち |
| 1.3 scrollbar内部寸法 | §4.5 / §7.1で`overflow-x: scroll` + transparent 6px track常時確保へ確定し、§14へoverflow境界確認を追加 | 対応済み・再確認待ち |
| 1.4 恒久docs置換対象 | §15をfile / 現行記述 / 置換後要旨の表へ改稿し、既知の矛盾箇所を列挙 | 対応済み・再確認待ち |
| 2.1 indicator theme token | §7.1 / §9.6 / §14へtheme別semantic tokenと2背景上の視認条件を追記 | 対応済み・再確認待ち |
| 2.2 非finite geometry | §7.2 / §12 / §13.1でthrowへ確定しtest対象化 | 対応済み・再確認待ち |
| 2.3 touch / pen競合 | §7.1 / §8.2 / §14でmouseだけをdrag対象とし、touch / penのpan・tap・buttonを維持 | 対応済み・再確認待ち |
| 3.1 candidate型 | §4.3 / §8.3 / §13.1で`string | null`入力とnarrowingを確定 | 対応済み・再確認待ち |
| 3.2 pointerup再判定 | §8.4でpointerup座標を正本、session targetをfeedback専用へ確定 | 対応済み・再確認待ち |
| 3.3 session所有者 | §8.1 / §9.1でApp所有へ一本化し、TabStrip componentは`App.tsx`内維持と明記 | 対応済み・再確認待ち |
| 3.4 Escape listener | §8.4 / §9.1でdragging中だけdocument capture listener、drag cancel優先、cleanup解除を確定 | 対応済み・再確認待ち |
| 3.5 preview mount | §8.1 / §9.1 / §9.6でapp shell siblingのfixed要素へ確定 | 対応済み・再確認待ち |
| 3.6 body class不整合 | §8.2 / §8.4 / §9.1でReact state由来の`.app-shell.tab-dragging`へ統一 | 対応済み・再確認待ち |
| 3.7 accessible name実装 | §6.3で`aria-label`方式とname-in-name条件を確定 | 対応済み・再確認待ち |
| 3.8 module登録先 | meta componentsと§15へ`tabStrip.ts` / test、basic design、READMEを追加 | 対応済み・再確認待ち |
| 3.9 destination暗黙導出 | §2.3 / §8.4 / §9.1で`moveTab(source,destination,tabId)`へ明示化。reducerは不変 | 対応済み・再確認待ち |
| 3.10 roving前提 | §7.2 / §14で矢印activate後にTabでcontrolsへ進む手順を明記 | 対応済み・再確認待ち |

---

## 7. Round 1 再確認（レビュー担当、2026-07-29、対象 `1bc136e`）

`git show 1bc136e`（design 82 行、meta 9 行、review 26 行）、改訂後の設計書全文、`meta.md`、および現行実ソース（`App.tsx`、`App.css`、`main.tsx`、`splitView.ts`）を突き合わせて再確認した。**初回 17 件はすべて設計上解決済み**である。以下、依頼された 8 観点を軸に検算結果を示す。

### 7.1 初回指摘の解決状況

| 指摘 | severity（初回） | 再確認結果 | 判定 |
| --- | --- | --- | --- |
| 1.1 focus による ancestor scroll | Medium（blocking） | §7.2 へ「TabStrip / App が実行する roving navigation、close 後、move 後、pane fallback の programmatic focus はすべて `focus({ preventScroll: true })`」「水平位置は `getTabRevealDelta` + `strip.scrollBy` だけが変更する」を追加。§9.2 の TabStrip 責務、§12 の境界条件行、§14-5 / §14-8 の「focus 時に preview / Explorer / shell が動かない」確認まで一貫。現行の 4 経路（`App.tsx:2455-2461` `focusTab`、`2490-2497` close、`789-801` `moveTab`、`2495` pane fallback）が漏れなく列挙されている | **解決済み** |
| 1.2 click 抑止 flag lifecycle | Medium（blocking） | flag が `{ pointerId, sourcePaneId, tabId }` の scoped identity へ格上げされ（§8.1 / §8.2）、消費経路が source activate button の `onClickCapture`、clear 経路が「pointerup 後の次 frame」「新しい pointerdown による stale clear」「unexpected lost capture の同期 clear」へ確定した（§8.4）。成功 drop の source unmount で click が来ない経路、pointerup 後の implicit `lostpointercapture` を no-op とする順序、§12 の 1 行、§14-13 の手動確認まで揃っている。詳細は 7.2 参照 | **解決済み**（残る改善提案は 7.4 の 8.2） |
| 1.3 scrollbar 内部寸法 | Medium（blocking） | §4.5 / §7.1 が `overflow-x: scroll` + 常時 transparent track へ確定し、「overflow 境界を跨いでも tab item の内寸を 34px から変えない」と明記。§14-4 に overflow 境界前後の増減確認が入った。`auto` 由来の 6px 変動は消えている | **解決済み**（engine 依存の残課題は 7.4 の 8.1） |
| 1.4 恒久 docs 置換対象 | Medium（blocking） | §15 が「file / 現行記述 / 置換後の要旨」の 11 行表へ改稿。指摘した 4 行（`detail_design.md:474`、`interface_spec.md:12` / `:59` / `:62`、`development_workflow.md:177`）がすべて含まれ、`basic_design.md`、`README.md`、`code_patterns.md`、`common_pitfalls.md`、`docs/tests/README.md`、`docs/history/` も追加された。行番号を目安とし記述内容で照合する旨の但し書きもあり、TODO-2026-023 で確立した形式に戻っている | **解決済み** |
| 2.1 indicator theme token | Medium | §7.1 が `--tab-indicator-loading` / `--tab-indicator-rendering` / `--tab-indicator-error` を `.app-shell` と dark 側へ追加すると確定し、「Light / Dark の `--chrome-bg` と active 時 `--panel-bg` の双方で視認できる値」という受け入れ条件を明示。§9.6 が component rule への固定 RGB 追加を禁止したまま token 定義先を規定し、§14-2 が手動確認へ落ちている | **解決済み**（drag layer 側の token 供給範囲は 7.4 の 8.3） |
| 2.2 非 finite geometry | Medium | §7.2-5 が「`getTabRevealDelta` が throw する。呼び出し側は catch して 0 へ fallback しない」へ一意化。`splitView.ts:369-379` の assert pattern と整合。§12 に行、§13.1 に `NaN` / `Infinity` の test が追加された | **解決済み** |
| 2.3 touch / pen 競合 | Medium | §8.2 が `pointerType === "mouse"` を受理条件へ追加し、touch / pen は horizontal pan、tap activate、move button へ委ねると明記。§7.1 が `.tab-activate` へ `touch-action: none` を付けないことを裏返しで確定し、§14-14 が手動確認になった。scroll container と drag の競合が設計上発生しない | **解決済み** |
| 3.1 candidate 型 | Low | §4.3 の signature が `resolveTabDropPane(sourcePaneId: PaneId, candidatePaneId: string | null, mode: ViewMode): PaneId | null` へ変更され、§8.3 が dataset からの `string | null` 取得と `elementFromPoint` の `null`（viewport 外 / 対象なし）を invalid target へ含め、§13.1 の test も `string | null` 前提へ更新された | **解決済み** |
| 3.2 pointerup 再判定 | Low | §8.4 が「pointerup の `clientX` / `clientY` で `elementFromPoint` と `resolveTabDropPane` を再実行し、その結果が valid な時だけ move」「session の `dropPaneId` は feedback 表示専用」と確定。coalesce による stale target が drop 判定に入らない | **解決済み** |
| 3.3 session 所有者 | Low | §8.1 が「`App` の React `useRef`」へ一本化し、「`TabStrip` component は `App.tsx` 内に維持し、pure policy だけを `tabStrip.ts` へ分ける」と明記。§9.1 と矛盾しない | **解決済み** |
| 3.4 Escape listener | Low | §8.4 が「dragging 中だけ `document` へ capture phase の `keydown` を effect 登録」「`preventDefault` / `stopPropagation` で drag cancel を優先」「cleanup で必ず解除」へ確定。既存の document bubble listener（menu `App.tsx:1138`、image viewer `1557`、settings `1978`）は同一 event では起動しない。DOM の伝播アルゴリズム上、document の capture 段で伝播を止めれば同じ node の bubble listener も呼ばれないため、記述どおりに成立する | **解決済み** |
| 3.5 preview mount | Low | §8.1 / §9.1 / §9.6 が「`.app-shell` の sibling として React root 直下に 1 つだけ mount、`position: fixed` + `transform: translate()`」へ確定。既存の `.settings-backdrop` / `.image-viewer-backdrop`（`App.tsx:1400-1409`、`App.css:238`, `271`）と同じ配置 pattern であり、pane / shell の `overflow: hidden` に clip されない | **解決済み**（token 供給は 7.4 の 8.3） |
| 3.6 body class 不整合 | Low | §8.2 / §8.4 / §9.1 が `.app-shell.tab-dragging` を React state 由来で付ける形へ統一し、「`document.body.classList` は変更しない」と明記。`App.tsx:1203` の `explorer-resizing` / `split-resizing` と同じ pattern | **解決済み** |
| 3.7 accessible name 実装 | Low | §6.3 が `aria-label` 方式へ確定し、「visible `.tab-name` が accessible name の先頭と完全一致する順序を維持」して name-in-name 要件を満たす旨を追加。隠し要素を入れないため 40px layout と干渉しない | **解決済み** |
| 3.8 module 登録先 | Low | `meta.md` の `components` へ `markdown-viewer-tauri/src/tabStrip.ts` / `tabStrip.test.ts` が追加され、§15 表へ `basic_design.md` の policy 一覧と `README.md` の file map / module 表が入った。`related_commits` と Phase Status も更新されている | **解決済み** |
| 3.9 destination 暗黙導出 | Low | §2.3-4 / §8.4 / §9.1 が `moveTab(sourcePaneId, destinationPaneId, tabId)` へ明示化。move button は反対 pane を明示して渡し、drag は drop 再判定結果を渡す。`splitView.ts` の `move-tab` reducer 契約は不変（§9.5 のまま）で、判定と適用がずれる経路が無くなった | **解決済み** |
| 3.10 roving 前提 | Low | §7.2 に「非 active tab を矢印キーで activate した後、active item 内の activate → move → close へ Tab 移動した時に `onFocusCapture` reveal が働く」、§14-5 に同じ手順が入り、`interface_spec.md:59` の確定契約と一致した | **解決済み** |

**初回 17 件: 解決済み 17 / 未解決 0。**

### 7.2 click 抑止 identity の clear 順（重点確認）

§8.4 の記述順を、React 19 の同期 flush と DOM の event 順序へ当てて検算した。

- **成功 drop**: pointerup → session finalize → `moveTab` → source `.tab-item` unmount → click 未発火。identity は次 frame の scheduled clear、または次 pointerdown の stale clear で確実に落ちる。初回 1.2 で指摘した「次の tab click を 1 回飲む」経路は塞がっている。
- **invalid drop（同 pane 上 / drop target 外での release）**: source item は残るため click が source activate button で発火し、matching identity（同一 `pointerId` / `sourcePaneId` / `tabId`）で `onClickCapture` が消費する。cancel なのに source tab が activate される経路は塞がっている。
- **pointerup 後の implicit `lostpointercapture`**: 「session が既に finalize 済みなので no-op とし、scheduled clear を早めない」と明記されており、explicit release と implicit release の二重発火で identity が前倒しに消えない。
- **Escape / `pointercancel` / unexpected lost capture**: click が生成されない経路として同期 clear。ここで scheduled clear を待たない判断も正しい。

順序自体は閉じている。残る論点は「scheduled clear の trigger を `requestAnimationFrame` に置くこと」の頑健性だけであり、7.4 の 8.2 として非ブロッキングで記録する。

### 7.3 その他の重点観点

| 観点 | 確認内容 | 結果 |
| --- | --- | --- |
| preventScroll と manual reveal の単一路線 | §4.4（`scrollBy` だけ）、§7.2（全 programmatic focus に `preventScroll`）、§9.2（TabStrip 責務）、§12、§14-5 / 8 が同じ contract を指す。`scrollIntoView` を残す記述は設計書に無い | 一貫 |
| `overflow-x: scroll` + transparent track | §4.5 / §7.1 / §14-4 が同じ値で一致。overflow 有無で内寸が変わらないという主張が、選んだ値と整合する（`auto` 時の自己矛盾は解消） | 一貫（engine 差は 8.1） |
| semantic indicator token と fixed drag layer | §7.1（token 追加先）、§9.6（`.app-shell, .tab-drag-layer` / dark 側の共通 selector、sibling 継承に依存しない）、§14-2（2 背景での視認確認）。既存 `.settings-backdrop` / `.image-viewer-backdrop` が token を局所再宣言している pattern（`App.css:238-250`, `271-283`）とも整合 | 一貫（供給範囲は 8.3） |
| pointerup 再判定と explicit destination | §2.3-4 / §8.4 / §9.1 が `moveTab(source, destination, tabId)` で統一。`splitView.ts:145-180` の reducer は引数が明示化されるだけで invariant も guard も不変。§9.5「`splitView.ts` を変更しない」と矛盾しない（変更は App 側の関数 signature） | 一貫 |
| mouse 限定 drag | §8.2（受理条件）、§7.1（`touch-action` を付けない）、§14-14（手動確認）、§15 の `interface_spec.md` 置換行（mouse drag と明記）が一致。§2.3-1 だけ「primary pointer を押す」の旧表現が残るが、§8.2 が受理条件の正本であり実装判断は割れない（編集上の微差） | 一貫 |
| §15 置換対象表 / meta 登録 | 7.1 の 1.4 / 3.8 のとおり。Phase 3 で新旧仕様が並存する箇所は表から特定できる | 一貫 |
| pure policy 自動 test と手動 matrix の境界 | §13.1 が reveal delta / 非 finite throw / threshold / drop narrowing、§13.2 が accessibility mapping、§13.3 が既存 `move-tab` 回帰。DOM lifecycle（capture、click identity、focus、CSS）は §14（14 項目）へ寄せ、§16 のリスク表へ「DOM lifecycle を unit test できない → pure policy 自動 test + §14 手動 matrix 必須」が明記された。jsdom / RTL を持たない現行構成（`package.json`、既存 test 5 本）で取りうる最善の切り分けであり、境界が文書化されている | 一貫 |
| 要求 traceability | §18 の対応表は初回から不変で、追加した contract（preventScroll、click identity、mouse 限定、token）はいずれも既存行（§6 / §7 / §8 / §11–12 / §13）の内側に収まる。TODO-2026-026 の受け入れ条件に新たな欠落は無い | 問題なし |

### 7.4 Round 1 で新規に検出した指摘

#### 8.1 `scrollbar-width` と `::-webkit-scrollbar` を併記すると、対象 WebView で pseudo-element 側が無効化され 6px / 33px の見積もりが崩れうる

**severity**: Medium（non-blocking）
**工程**: Phase 3（設計 1 行の確定 + CSS 実装 + 実機確認）
**status**: 未解決

**ドキュメント記載**: §4.5「`overflow-x: scroll`と6pxのscrollbar寸法を使い…Firefox系の`scrollbar-color`とWebKit系pseudo-elementの両方を定義する。」§7.1「`.tab-strip`は`overflow-x: scroll`と6pxのtransparent trackを常時持つ。content control領域は最低33pxを確保し」。

**根拠 / 差異**: 「両方を定義する」は、現行 CSS が `.tab-strip` に持つ `scrollbar-width: thin`（`App.css:866`）を残したまま `::-webkit-scrollbar { height: 6px }` を足す実装へ誘導する。しかし Chromium 121 以降および近年の WebKit は標準の `scrollbar-width` / `scrollbar-color` を実装しており、これらが `auto` 以外に設定されている場合 `::-webkit-scrollbar` 系の pseudo-element 規則を無視する。本 application の対象 WebView は WebView2（Chromium）、WKWebView / WebKitGTK（WebKit）であり Gecko は含まれないため、**併記した場合に効くのは標準プロパティ側**になる可能性が高い。そのとき track 幅は UA 定義の「thin」であって 6px ではなく、`--tab-strip-height: 40px` から差し引く量が設計の想定より大きくなる。§7.1 の「content control 領域 33px 以上」は 40px − 6px = 34px を前提にしているため、UA thin が 10px 前後であればこの budget を満たさない。

なお、visibility 切替（通常 transparent、hover / focus-within で muted）自体は `scrollbar-color` でも表現できるため、機能要件は標準プロパティだけでも満たせる。崩れるのは**寸法の確定値**と、それに紐づく §7.1 の control 高さ見積もりである。

**推奨対応**: §4.5 / §7.1 で機構を 1 つに決める。

- 案 A（推奨）: 対象 WebView がすべて WebKit / Chromium 系であることを根拠に pseudo-element 側で寸法を確定する。この場合 `.tab-strip` の既存 `scrollbar-width: thin`（`App.css:866`）を**削除**し、`scrollbar-color` も設定しない旨を §7.1 の置換対象として明記する。6px / 34px / 33px の見積もりがそのまま成立する。
- 案 B: 標準プロパティを正本にし、`::-webkit-scrollbar` は legacy fallback と位置づける。この場合 §7.1 の「6px」「最低 33px」を「UA thin 幅を差し引いた残り」に書き換え、実測値を Phase 4-a で確認する項目へ格上げする。

いずれの案でも §14-4 へ「WebView 上で track の実寸と thumb 可視切替が設計どおりか」を含めること。Phase 3 の CSS 実装時に実機で確認し、結果を Phase 3 実装レビューで報告することを条件に、本指摘は Phase 3 進行のブロッキングとはしない。

#### 8.2 click 抑止 identity の scheduled clear を `requestAnimationFrame` に置く必然性が無く、早すぎる clear の risk だけが残る

**severity**: Low（non-blocking）
**工程**: Phase 3（設計 1 文の簡素化 + 実装）
**status**: 未解決

**ドキュメント記載**: §8.4「pointerup handlerはsessionをfinalizeしてからcaptureをreleaseし、source click dispatchより後になる次の`requestAnimationFrame`でidentityを必ずclearする。…新しいpointerdownもstale identityを先にclearする。」

**根拠 / 差異**: 「rAF は click dispatch より後」という前提は、pointerup → mouseup → click が同一 task で連続 dispatch される通常経路では成立するが、rendering opportunity が click の前に挟まる経路では成立しない。前倒しに clear された場合、**invalid drop cancel の直後に source activate button の click が素通りする**。非 active tab を drag して cancel した場合はその tab が activate され、§2.3-5「cancel 時は state を変更しない」に反する（`move-tab` は呼ばれないので tab 所属は変わらないが、selection は変わる）。

一方、初回 1.2 で問題にした「identity が残り続けて次の click を飲む」経路は、同じ §8.4 が既に持つ「新しい pointerdown で stale identity を先に clear する」だけで塞がる。identity は `{ pointerId, sourcePaneId, tabId }` scoped であり、残存しても抑止できるのは同一 source tab の activate click に限られ、その click は必ず pointerdown を伴うためである。したがって rAF clear は 1.2 の解決に不要で、早すぎる clear の risk だけを追加している。

**推奨対応**: identity の解除経路を「matching click の消費」「次の pointerdown」「click を生成しない unexpected lost capture の同期 clear」の 3 つに限定し、`requestAnimationFrame` による時間依存の clear を落とす。§14-13 の確認項目（成功 drop 後 / cancel 後に別 tab を 1 回で activate）はそのまま有効である。

#### 8.3 fixed drag layer へ供給する token が「TabStrip 用 semantic token」だけに読め、preview の描画に必要な既存 token が欠ける

**severity**: Low（non-blocking）
**工程**: Phase 3（設計 1 行の具体化 + CSS 実装）
**status**: 未解決

**ドキュメント記載**: §9.6「fixed drag previewのsibling layerにもtheme tokenを供給するため、Lightは`.app-shell, .tab-drag-layer`、Darkは`:root[data-theme="dark"] .app-shell, :root[data-theme="dark"] .tab-drag-layer`の共通selectorで同じsemantic tokenを定義する。sibling間のCSS variable継承には依存しない。」§7.1 は追加 token として `--tab-indicator-loading` / `--tab-indicator-rendering` / `--tab-indicator-error` の 3 つを挙げる。

**根拠 / 差異**: theme token は `.app-shell` に定義されており（`App.css:45-58` / dark は `61-75`）、sibling の `.tab-drag-layer` はこれを継承しない。`:root` 側に存在するのは `color` / `background` だけ（`App.css:1-16`）である。drag preview は tab 相当の chip を描くため、少なくとも `--panel-bg`（または `--chrome-bg`）、`--text`、`--border`、状態表示を行うなら indicator token と `--muted` を参照する。§9.6 の「同じ semantic token」が §7.1 の 3 つだけを指すと読まれると、背景・枠線が未定義（`var()` 解決不能）となり、Dark で透明な preview が出る。

既存の sibling overlay は必要 token を局所再宣言している（`.settings-backdrop` は `--accent-bg` / `--error-bg` / `--error-text` と `color`、`.image-viewer-backdrop` は `--panel-bg` / `--border` / `--muted` 等、`App.css:238-250`, `271-283`）。同じ運用に揃えるのが自然である。

**推奨対応**: §9.6 へ「`.tab-drag-layer` には preview が参照する token（`--panel-bg` / `--chrome-bg` / `--text` / `--muted` / `--border` / `--accent` と TabStrip indicator token）を Light / Dark 双方で定義する」と対象を列挙する。あるいは preview が参照する token を indicator token だけに絞る設計（背景・文字色は `:root` の `color` / `background` と固定 border なしで表現）へ寄せるかを、§8.1 の preview 仕様とあわせて 1 行で確定する。

### 7.5 集計と結論（Round 1 再確認）

| 分類 | 初回 | Round 1 で解決 | Round 1 新規 | 未解決 |
| --- | --- | --- | --- | --- |
| blocking Medium | 4 | 4 | 0 | 0 |
| non-blocking Medium | 3 | 3 | 1（8.1） | 1 |
| Low | 10 | 10 | 2（8.2 / 8.3） | 2 |
| **合計** | **17** | **17** | **3** | **3** |

**結論**: **承認 (Approved)。Phase 3 へ進行可。**

初回の blocking Medium 4 件は、いずれも「設計が自ら掲げた不変条件が実装時に破れる」という構造的な穴だったが、Round 1 fix でそれぞれ contract 化された。特に 1.1（全 programmatic focus の `preventScroll` と manual reveal 単一路線）、1.2（identity 化した click 抑止と clear 順）、1.3（`overflow-x: scroll` + 常時 transparent track）は、設計書内の複数節（§4 / §7 / §8 / §9 / §12 / §13 / §14）で相互に矛盾なく閉じている。1.4 の §15 置換対象表と meta の module 登録により、Phase 3 で恒久 docs と実装差分を同時に整合させる準備も整った。

新規 3 件はいずれも Phase 3 の CSS / 実装差分と同じ改訂で閉じられる粒度であり、設計の骨格・責務分割・transition 契約には影響しない。ただし 8.1 は 40px 固定高という受け入れ条件に数値で効くため、**Phase 3 の CSS 実装時に機構を 1 つへ確定し、対象 WebView での track 実寸を確認したうえで Phase 3 実装レビューへ報告すること**を進行条件とする。8.2 / 8.3 も同じ Phase 3 差分で反映し、実装レビュー時に解決を確認する。
