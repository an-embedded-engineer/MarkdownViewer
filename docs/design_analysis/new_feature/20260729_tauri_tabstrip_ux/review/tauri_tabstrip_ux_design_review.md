# TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善 設計レビュー

**レビュー日**: 2026-07-29
**対象ドキュメント**: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/design/tauri_tabstrip_ux_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-026
**初回レビュー対象コミット**: `affc977` (Phase 2 prepare Tauri TabStrip UX design)
**判定**: **条件付き差し戻し (Changes Requested)**。設計の骨格・採用案・非対象境界は妥当だが、**blocking Medium 4 件**を設計へ反映してから Phase 3 へ進むこと。non-blocking Medium 3 件 / Low 10 件を含め **検出 17 件、未解決 17 件**。

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
