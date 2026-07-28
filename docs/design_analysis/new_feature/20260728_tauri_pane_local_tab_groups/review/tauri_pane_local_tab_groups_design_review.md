# TODO-2026-023 Tauri pane-local tab group / pane 間移動 設計レビュー

**レビュー日**: 2026-07-28
**再確認日**: 2026-07-28（Round 1 / Round 2）
**対象ドキュメント**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/design/tauri_pane_local_tab_groups_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-023（統合済み TODO-2026-024 を含む）
**初回レビュー対象コミット**: `996275a` (Phase 2 design Tauri pane-local tab groups)
**Round 1 fix コミット**: `e21fe5d` (Phase 2 address pane-local tab groups design review)
**Round 2 fix コミット**: `3542fbb` (Phase 2 resolve runtime status clear review finding)
**判定**: **承認 (Approved)**。Phase 3 進行可。初回検出の **blocking Medium 3 件 / non-blocking Medium 2 件 / Low 7 件 = 全 12 件**は Round 1 fix (`e21fe5d`) で、Round 1 再確認で新規検出した **Low 1 件（3.8）**は Round 2 fix (`3542fbb`) で、それぞれ設計へ反映済みと再確認した。**検出指摘 13 件すべて解決済み、未解決指摘 0 件。**

---

## 概要

TODO-2026-023 の Phase 2 設計レビュー（初回 + Round 1 再確認）。`OpenDocumentTab[]` を document data の正本として維持したまま、表示所属・表示順・選択だけを pane-local な ordered tab ID collection へ移す設計を、現行実ソース（`markdown-viewer-tauri/src/splitView.ts`、`paneRuntime.ts`、`App.tsx`、`App.css`、`splitView.test.ts`、`paneRuntime.test.ts`）、TODO-2026-006 の確定設計・レビュー（`docs/design_analysis/new_feature/20260726_tauri_split_view/`）、恒久 docs（`docs/components/tauri_viewer/`、`docs/architecture/`、`docs/rules/development_workflow.md`）、`docs/adr/README.md` の起票条件を根拠に検証した。

設計の骨格は初回レビュー時点から妥当である。

- §4.1 の「global data 1 件 + 両 group から参照できる ordered ID」は、`OpenDocumentTab` が path 一意・`revision`・PlantUML 結果 cache を保持する現行構造（`App.tsx:87-98`）と一致し、pane ごとに複製する案を退けた理由も具体的である。
- §4.2 の `splitView.ts` への統合は、`explorerPane.ts` / `documentPolicy.ts` / `imageViewer.ts` / `paneRuntime.ts` が確立した「React / DOM / Tauri 非依存の exported pure policy」という既存 project pattern と一貫し、module-global mutable state を持ち込まない旨も明記されている。
- §4.3 の local close + unreferenced eviction は、eviction 判定を「次 state の両 group 参照集合」に置く点で順序依存を正しく閉じており、§9.1 の `closeTab` 契約とも整合する。
- §9.5 の「`paneRuntime.ts` は原則変更なし。`activeTabId` が membership invariant を満たすため global membership fallback は不要」は正しい。`isPaneSelectionCurrent`（`paneRuntime.ts:33-42`）は pane ごとの `activeTabId` 比較だけを行い、`isTabRevisionCurrent`（同 44-50）は global tab identity を見るため、pane-local group 導入で判定式を変える必要は無い。
- §10.2 の security 判断（active pane / group membership を許可条件へ持ち込まない、`documentPolicy.ts` を正本とする、sandbox / CSP / capability を緩和しない）は TODO-2026-006 の確定方針を維持しており、退行は無い。
- §4.5 の不採用案表は、単一 `paneId` 保持、`OpenDocumentTab[]` 複製、global からの filter、global close 維持、split toggle 時の暗黙 merge / copy、move 専用 React state、invalid ID の silent filter をいずれも具体的な理由で退けており、review checkpoint 2 / 3 / 5 の観点と一致する。

初回レビューでは次の 3 点をブロッキング（Medium）として指摘した。

1. `pendingNavigation` の遷移規則が新しい action 契約表（§7）に一切書かれておらず、§6.2 invariant 3 が `open-tab` / `select-tab` / `close-pane-tab` / `move-tab` のいずれでも破れうる。
2. `createInitialSplitViewState` の signature 変更、`enable-split` / `disable-split` の payload 削除、`select-tab` の非 member throw 化により既存 test の前提が破壊されるが、その影響範囲と書き換え方針が §14 / §16 に無い。
3. 恒久 docs に新仕様と直接矛盾する確定記述が存在し、うち 2 行は Phase 4-a の手動確認合否基準そのものだが、§15 は更新先ファイル名を列挙するだけで置換対象を特定していない。

Round 1 fix (`e21fe5d`) では、(1) §7 を「membership / selection 契約」「pending navigation 契約」の 2 列表へ再構成して 10 action すべての pending 規則を確定、(2) §6.3 / §7 / §9.2 で初期化関数・split payload・adjacent helper の契約を確定し §16.1「既存 test の移行方針」を新設、(3) §15 を置換対象表へ全面改稿、という形で 3 件とも構造的に解決されている。non-blocking Medium 2 件（runtime status の二重管理、split off 時の空 primary）と Low 7 件も、それぞれ推奨対応と一致する形で §6.2 / §8.1〜§8.5 / §9.1〜§9.4 / §11 / §12 / §13 / §14 / §16 / §17 / §18 へ反映されている。

Round 1 再確認の結果、対応による新たな invariant の穴、実装不能な契約、section 参照の破損は検出しなかった（§16 が 3 節から 4 節へ増えた影響も、design 内に旧番号を参照する記述が残っていないことを確認済み）。新規に検出したのは指摘 3.8（runtime status 直接 clear の削除対象が 5 call site 中 2 件しか列挙されていない）1 件のみで、挙動は変わらず旧経路が 3 箇所残るだけであるため Low・非ブロッキングとした。

Round 2 fix (`3542fbb`) では §9.1 と §14 の 2 行を改訂し、直接 clear を行わない handler を 6 種すべて列挙した上で、`setPanePreviewStatus` の残存呼び出しを「`updatePanePreviewPhase` 経由の status 設定」と「generic effect による clear」の 2 経路へ限定する実装完了条件を明示した。Round 2 再確認では、この 2 経路が現行実装の call site と過不足なく対応することを確認し、新たな指摘は検出しなかった。

---

## 1. 齟齬・不整合（初回 blocking）

### 1.1 `pendingNavigation` の遷移規則が新 action 契約表に無く、invariant §6.2-3 が全経路で閉じない

**severity**: Medium（初回 blocking）
**工程**: Phase 2（設計修正）
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §7 を「membership / selection 契約」と「pending navigation 契約」の 2 列表へ再構成し、10 action すべての pending 規則を確定した。§8.1-5 へ anchor 無し `open-tab` の clear を明記し、到達不能になる現行 `remove-tab` guard の削除と invariant 3 の test を §7 / §14 / §16.2 へ追加した。

**ドキュメント記載（初回時点）**: §6.2-3「`pendingNavigation`がある場合、その`tabId`は`activeTabId`と一致する。」§7 action 表。§7 本文「sourceのtabがactiveでなければsource active / pendingは維持する。」§16.1 test 一覧。

**根拠 / 差異**: §7 の表で `pendingNavigation` に言及しているのは `disable-split`（secondary の pending だけ clear）と `consume-navigation` だけであり、selection を動かす 4 action すべてで clear 規則が未定義だった。

- **`select-tab`**: 現行は anchor 無しの選択で必ず `pendingNavigation: null` を書く（`splitView.ts:70-74`）。新 `select-tab` は入力から anchor が外れており、clear 規則が落ちると tab A の pending を保持したまま tab B を選択して invariant 3 が破れる。
- **`close-pane-tab`**: 現行 `remove-tab` は active close で `pendingNavigation: null`、非 active close で tabId 一致時だけ null にする（`splitView.ts:113-127`）。新契約列は fallback 順序しか定義していない。
- **`move-tab`**: source 側にしか触れておらず、destination が別 tab の pending を保持したまま移動対象を選択すると destination で invariant 3 が破れる。
- **`open-tab`**: anchor が**無い**場合の既存 pending の扱いが無い。Explorer から別 document を開く経路（`App.tsx:1231`）は anchor 無しであり、頻出経路で破れる。

実害は crash ではなく、消えない stale anchor である。pending navigation effect は `navigation.tabId !== tab.id` で早期 return する（`App.tsx:2288-2300`）ため即時の誤 scroll は起きないが、`consume-navigation` は identity 一致時だけ clear するため pending は永続的に残り、その pane で当該 tab を再選択した瞬間に古い anchor へ scroll する。

**推奨対応**: §7 へ pending 列を追加し、`open-tab`（anchor 有無で設定／`null`）、`select-tab`（常に `null`）、`close-pane-tab`（active close のときだけ `null`）、`move-tab`（source は active move のときだけ `null`、destination は selection 変化時 `null`）を確定する。到達不能になる現行 guard（`splitView.ts:119-121`）を削除対象として §14 へ、invariant 3 の test を §16.1 へ追加する。

**確認 (`e21fe5d`)**: 推奨した規則がそのまま独立列として明文化され、10 action すべてに規則が付いた。

- §7 の表が 2 列化され、`open-tab`「anchorがあれば`{ tabId, anchor }`、なければ`null`へ置換」、`select-tab`「常に`null`」、`close-pane-tab`「active tabを閉じた場合だけ`null`。non-active closeでは維持」、`move-tab`「sourceはactive tabを移した場合だけ`null`。destinationはselectionが変わる場合`null`、既に同tabを選択中なら維持」となった。`activate-pane` / `enable-split` / `set-requested-ratio`「変更しない」、`disable-split`「primaryは維持、secondaryだけ`null`」、`reset-root`「両pane`null`」、`consume-navigation`「identity一致時だけ`null`」も明示され、**pending に触れない action が 1 つも残っていない**。
- 全 10 action を invariant 3（`pending !== null ⇒ pending.tabId === activeTabId`）に対して検算した。selection を変える 4 action はいずれも pending を同一 tab へ設定するか `null` にしており、selection を変えない 6 action は pending を保存または `null` にするため、どの遷移でも invariant 3 が保たれる。**invariant は全経路で閉じている。**
- §8.1-5 が「`open-tab`はanchorがあれば同paneのpending navigationへ設定し、anchorがなければ既存pendingを必ずclearする」へ更新され、指摘した Explorer 経路の穴が塞がった。
- §7 末尾へ「現行`remove-tab`にある『非active paneのpendingがclosed IDならclear』というguardはinvariant 3の下で到達不能になるため残さない」が追加され、旧経路の削除が明示された（review checkpoint 5）。§14 の `splitView.ts` 行にも「pending規則」が入っている。
- §16.2 へ「pending保持中のopen / select / active close / non-active close / moveで§6.2 invariant 3が維持される」が追加され、推奨した 3 経路に加えて `open` / non-active close まで自動検証対象になった。

### 1.2 公開 API・既存 test の契約破壊範囲が §14 / §16 に整理されていない

**severity**: Medium（初回 blocking）
**工程**: Phase 2（設計追記）
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §6.3 で `createInitialSplitViewState()` の引数廃止、§7 / §9.2 で split payload 削除と `findAdjacentTabId` の private 化を確定した。§16.1「既存 test の移行方針」を新設し、34 call site の移行・置換方針と共通 fixture helper を定義した。

**ドキュメント記載（初回時点）**: §6.3「起動時: single、active primary、両group empty、ratio 0.5。」§7 の `enable-split` / `disable-split`（入力「なし」）、`select-tab`（「非memberはthrow」）。§14 影響範囲表。§16.1 / §16.2 の test 一覧。

**根拠 / 差異**: 新 schema へ一括置換する方針（§13）自体は妥当だが、置換によって壊れる既存の公開契約と test が特定されていなかった。

- **`createInitialSplitViewState(activeTabId: string | null = null)`（`splitView.ts:45-53`）**: 現行は引数の tab ID を `primary.activeTabId` へ直接入れる。新 schema でこれを維持すると `orderedTabIds` が空のまま `activeTabId` が非 null となり、**初期状態で invariant §6.2-2 と §6.2-4 を同時に破る**。影響は `splitView.test.ts` 9 箇所、`paneRuntime.test.ts` 9 箇所。
- **`enable-split` / `disable-split` の payload 削除**: `splitView.test.ts` 13 箇所、`paneRuntime.test.ts` 3 箇所。`findAdjacentTabId`（`splitView.ts:156-162`）も用途が source group 内 fallback へ変わるため export 継続可否の確定が要る。
- **`select-tab` の非 member throw 化**: `splitView.test.ts:62-82`、`paneRuntime.test.ts:78-82` が throw する。review checkpoint 5「既存テストケースの意味が変わっていないか」に直接該当し、方針を決めないと Phase 3 で意味を保った書き換えか単に通るよう緩めたのかが判定できない。
- §14 は `paneRuntime.ts` を「原則変更なし」とするが、`paneRuntime.test.ts` は既存 5 test の書き換えが必要になる。§16.2 は追加分しか列挙していない。

**推奨対応**: (a) 初期化関数の新 signature 確定、(b) split payload 削除と `findAdjacentTabId` の新しい入力・export 継続可否、(c) 「既存 test の扱い」小節で意味を保つ test と置換する test を分けて列挙、(d) group membership 込みの共通 fixture helper 方針。

**確認 (`e21fe5d`)**: 推奨 (a)〜(d) がすべて実装可能な粒度で確定した。

- (a) §6.3 が「`createInitialSplitViewState(): SplitViewState`は引数を廃止し、single、active primary、両group empty、ratio 0.5を返す」へ改訂された。§9.2 にも同内容が入り、初期状態で invariant 2 / 4 を破る経路が消えた。root 初期 document は §8.6 のとおり `open-tab` 経由で入るため、初期化関数に選択責務を残す必要も無い。
- (b) §7 末尾へ「`enable-split` / `disable-split`から現行`orderedTabIds` payloadを削除する。現行`findAdjacentTabId(activeTabId, orderedTabIds)`はexportを廃止し、source group内のclose / move fallbackだけに使うprivate helperとして維持する。global順のsecondary初期選択には使わない」が追加され、§9.2 にも同旨が入った。現行 test は `findAdjacentTabId` を import していないため、export 廃止による追加の test 破壊は無いことも確認した。
- (c) §16.1 が新設され、call site 数まで含めて特定されている。「`createInitialSplitViewState(activeTabId)`を使う`splitView.test.ts` 9箇所と`paneRuntime.test.ts` 9箇所」「`enable-split` / `disable-split`へglobal ordered IDsを渡す`splitView.test.ts` 13箇所と`paneRuntime.test.ts` 3箇所」の計 34 call site は実測値と一致する。さらに「split width、ratio、keyboard、pane / tab / revision guard、shared / pane runtime合成testは**意味を維持して**新state helper上へ移す」と「secondary隣接自動選択、active secondary→primary引継ぎ、group未登録IDを直接`select-tab`するtestは**旧仕様のため削除**し、secondary group保持、nonmember throw、`open-tab`で同じIDを両groupへ登録するtestへ置換する」が分けて書かれており、指摘した「意味を保った書き換えか緩めたのか判定できない」問題が解消されている。
- (d) §16.1 末尾へ「test file内に`stateWithPaneTabs({ primary, secondary, activePaneId?, mode? })`相当の共通helperを置き、actionの積み上げでfixture意図を不透明にしない」が追加された。
- §14 の 3 行（`splitView.ts` / `splitView.test.ts` / `paneRuntime.test.ts`）も具体化され、`paneRuntime.test.ts` 行が「引数付きinitial stateと非member select前提をgroup membership helperへ書換え、…guard回帰を**追加**」となって既存書き換えと追加が両方追跡される。

### 1.3 恒久 docs に新仕様と矛盾する確定記述があり、§15 が「置換対象」を特定していない

**severity**: Medium（初回 blocking）
**工程**: Phase 2（§15 具体化）／ Phase 3（実反映）
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §15 を「恒久ドキュメント更新・置換対象」表へ全面改稿し、指摘した 6 箇所の旧確定記述と節単位の置換方針を明記した。末尾へ「旧仕様への追記ではなく置換であり、相反する合否基準を残さない」旨を追加した。

**ドキュメント記載（初回時点）**: §15「恒久ドキュメント更新予定先」（11 ファイルの箇条書き）。

**根拠 / 差異**: §15 は更新先ファイル名と概略テーマを挙げるだけで、**現行 docs に確定記述として存在し本変更で偽になる記述**を特定していなかった。該当は次の 6 箇所で、いずれも追記では解消しない。

- `docs/components/tauri_viewer/interface_spec.md:11`「Tab close: **global tabを両paneのTabStripから削除する**。…最後のtab close後は両paneが未選択表示になる。」
- 同 `## TabStrip 表示` 節「**single / splitの各paneに同じglobal tab collectionを表示する**。」「同一root内でopenしたMarkdown / HTMLを**open順**に表示する。」
- 同 `## Split View 表示` 節「split on時はprimaryを維持し、**右隣、なければ左隣の別tabをsecondaryへ選ぶ**。」「**split off時はselected tabを持つactive paneをprimaryへ引き継ぐ**。…」（後者は TODO-2026-006 設計レビュー指摘 1.1 の対応結果として確定した記述であり、経緯を承知の上で置換する旨を残さないと退行と誤読される）
- `docs/components/tauri_viewer/detail_design.md:469`「各`DocumentPane`は**同じglobal tabsを受ける**pane-local `TabStrip`とtabpanelを持ち」
- `docs/rules/development_workflow.md:174`「`View > Split View`で…**primary維持、secondary隣接tab選択、active secondaryからsingleへの引き継ぎ、空secondaryからのprimary維持**が仕様どおりであること」→ **Phase 4-a の合否基準そのものが旧仕様**
- 同 `:177`「active / non-active tab close、両paneで同じtab、最後のtab、root変更で**pane selectionが一貫して復旧**し、無効tab IDが残らないこと」
- `markdown-viewer-tauri/README.md:68`「各paneのTabStripから文書を独立に**選択**します。」

**推奨対応**: §15 を置換対象記述の一覧へ具体化し、上記 6 箇所（ファイル + 節または行 + 置換方針）を最低限含める。`development_workflow.md` の 2 行は追記ではなく置換であることを明記し、§17 の観点と 1:1 で対応付ける。

**確認 (`e21fe5d`)**: §15 が箇条書きから 11 行の置換方針表へ改稿され、指摘した 6 箇所すべてが特定された。

- `interface_spec.md` 行が「`Tab close`のglobal削除記述をlocal close + last-reference evictionへ置換。`## TabStrip 表示`の同一global collection / global open順をpane-local所属・挿入順へ**節単位で書換え**。`## Split View 表示`のsecondary隣接自動選択とactive secondary→primary引継ぎを、group保持・初回empty・hidden secondary案内へ**節単位で置換**」となり、推奨した 3 箇所が節粒度で確定した。
- `development_workflow.md` 行が「現行split toggle確認の『secondary隣接選択 / active secondary引継ぎ』を**§17-2 / 9**の初回empty・group保持・primary empty回復へ置換。現行close確認を**§17-3 / 5**のlocal close・shared membership・last-reference evictionへ置換し、move / same document / keyboard / focus項目を追加」となり、推奨した §17 との 1:1 対応まで含まれている。
- `detail_design.md` 行が「『同じglobal tabsを受ける』という記述を、Appで解決済みのpane-local ordered viewを受ける契約へ置換」となり、指摘 3.3 の解決内容とも整合する。
- `markdown-viewer-tauri/README.md` 行が「現行『各paneから独立に選択』だけの説明を拡張」と、置換元を明示した形になった。指摘 2.2 の hidden secondary 回復方法もこの行に含まれている。
- 表の直後へ「`interface_spec.md`と`development_workflow.md`は旧仕様への追記ではなく、TODO-2026-006で確定したglobal TabStrip baselineを本機能の承認済みpane-local group仕様へ明示的に置換する。**相反する合否基準を残さない**」が追加され、TODO-2026-006 の確定記述を承知の上で置換するという経緯も残った。**旧 manual 合否基準が残る経路は無い。**

---

## 2. 設計判断への指摘（初回 non-blocking）

### 2.1 pane runtime status の clear が、既存の generic effect と二重管理になる

**severity**: Medium（初回 non-blocking）
**工程**: Phase 2（責務の明記）
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`。削除対象の列挙範囲は指摘 3.8 として切り出し、commit `3542fbb` で解決済み）。

**対応**: §8.2 / §8.3-4 / §8.4 / §9.1 で `isPanePreviewStatusCurrent` を使う既存 generic effect を唯一の正本と定め、close / move / toggle handler の直接 clear を行わない方針へ一本化した。現行 `closeTab` の両 pane 無条件 clear を削除対象として §8.2 / §14 へ明記した。

**ドキュメント記載（初回時点）**: §8.2「source paneのruntime statusがclosed IDならclearする。他pane statusは、そのpaneが同じIDを表示していれば維持する。」§8.3-4「action前後で各paneのactive tab identityを比較し、selectionが変わったpaneのstale `PanePreviewStatus`だけをclearする。」§9.1「`moveTab`でtyped action、runtime clear、destination focusを調停する。」

**根拠 / 差異**: 現行 App には既に、全 pane の `PanePreviewStatus` を `isPanePreviewStatusCurrent` で毎 commit 検証して current でないものを null へ落とす generic effect がある（`App.tsx:1166-1176`）。`isPanePreviewStatusCurrent` は `paneId + tabId + revision` と pane selection・global tab identity を照合する（`paneRuntime.ts:63-70`）ため、close / move による selection 変化は**この effect だけで自動的に閉じる**。§8.2 / §8.3-4 が App 側へ要求する明示比較は判定条件の異なる 2 つ目の正本になり、条件が将来ずれると片方だけが正しい状態になる。加えて現行 `closeTab` は closed tabId に一致する status を両 pane 無条件で clear しており（`App.tsx:783-787`）、local close 導入後は誤りになるが §9.1 / §14 に削除が明示されていない。review checkpoint 2（不要な重複実装 / 責務分離）に該当する。

**推奨対応**: stale 判定の正本を `isPanePreviewStatusCurrent` を使う既存 effect へ一本化し、App の action handler では status を直接 clear しない。先行 clear が必要と判断する場合は理由と最終正本を明記し、条件を `isPanePreviewStatusCurrent` の否定として表現する。併せて `App.tsx:783-787` を削除対象として §14 へ明記する。

**確認 (`e21fe5d`)**: 推奨どおり generic effect へ一本化され、独自条件は残っていない。

- §8.2 が「pane preview statusのstale判定は`isPanePreviewStatusCurrent`を使う既存generic effectを**唯一の正本**とし、close handlerでは直接clearしない。現行`closeTab`のclosed IDに一致するstatusを両paneから無条件clearする処理は**削除する**」へ改訂された。推奨した 2 点（一本化と `App.tsx:783-787` の削除）が同一文に入っている。
- §8.3-4 が「move handlerで**独自のidentity比較や直接clearを行わない**。destinationが移動対象を既に選択中ならstatusと既存DOM / iframeは**currentのまま維持され**、selectionが変わったdestinationだけ新しいpreviewを生成する」へ改訂され、旧文の「action 前後の identity 比較」が消えた。結果の記述が「handler が維持する」から「generic 判定の帰結として current のまま」へ変わっており、正本が 1 つであることが文面上も一貫する。
- §8.4 の disable 行が「hidden secondaryのpending navigationは**reducerで**clearし、runtime statusはmode不一致を検出する**既存generic effectで**clearする。toggle handlerから直接clearしない」へ改訂され、推奨の対象外だった toggle 経路まで同じ方針に揃った。`isPaneSelectionCurrent` は `paneId === "secondary" && mode !== "split"` で false を返すため（`paneRuntime.ts:38-40`）、この委譲は実際に成立する。
- §9.1 が「`moveTab`でtyped actionと**destination focus**を調停する。close / move handlerはpane runtime statusを直接clearせず、既存generic effectへ委ねる」へ改訂され、旧文の「runtime clear」が責務から外れた。§14 の `App.tsx` 行にも「close / toggleの直接runtime clearを削除」が入り、§18 のリスク表も「generic stale status effect、pane / tab / revision guard、DOM connection checkへ判定を一本化」へ更新された。
- 先行 clear を廃止したことによる 1 frame の誤表示が無いことを実装側で検算した。`resolvePaneTabPresentationState` は `panePreviewStatus?.tabId !== tab.id` で shared 値へ落ち（`paneRuntime.ts:82-88`）、App の `currentActivePaneStatus` も tabId / revision 一致を要求する（`App.tsx:198-204`）。close / move 後の fallback tab・移動先 tab はいずれも stale status とは別 ID になるため、effect が走る前の 1 commit でも誤った label / error は出ない。**先行 clear を残す理由は無く、一本化は安全である。**

### 2.2 split off 時に primary group が空だと、開いている文書が UI 上どこからも見えなくなる

**severity**: Medium（初回 non-blocking）
**工程**: Phase 2（動作定義の追記）／ Phase 4-a（手動確認の追加）
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: 推奨案 (a) を採用し、§8.4 で primary empty / secondary nonempty 時に hidden 件数と `Enable Split View` の回復案内を表示する規則を定義した。§12 / §17-9 / §18 / §15 へも反映した。

**ドキュメント記載（初回時点）**: §2.2-8、§2.3、§8.4、§12 error handling 表、§17-9。

**根拠 / 差異**: 互換性変更そのもの（暗黙の ownership 変更をしない）は §4.5 の不採用理由と一貫し、TODO-2026-023 の完了条件にも「split off で引き継ぐこと」は含まれないため判断としては妥当である。ただし「初回 split on（secondary は空）→ secondary を active にして Explorer から open → primary には一度も tab を開いていない → split off」という到達可能な経路で、primary group は空、secondary group には document が残る状態になる。`DocumentPane` は `No document selected` を表示し（`App.tsx:2383`）、StatusBar は `No file selected`（`App.tsx:2106`）、single mode では secondary の TabStrip が描画されず（`App.tsx:1325`）、secondary group の tab を close する手段も move する手段（`move-tab` は split 限定）も無い。利用者から見ると「文書を開いていたはずなのに Viewer が空になり、原因も回復手段も画面に無い」状態で、TODO-2026-006 設計レビュー指摘 1.1 が blocking として排除した失敗モードと外形が同じである（本設計ではデータが失われないため深刻度は低下）。

**推奨対応**: (a) primary の空表示メッセージを group 状態に応じて分岐させる、(b) menu item へ件数併記、(c) 少なくとも §12 と §17-9 へ動作と手動確認を追加する、のいずれかを §8.4 / §12 へ確定させる。

**確認 (`e21fe5d`)**: 推奨案 (a) が採用され、(c) も併せて反映された。

- §8.4 へ「primary groupが空でsecondary groupだけが非空のままsplit offした場合、primary previewは件数に応じて`No document selected in this pane. <N> document(s) remain in the secondary pane. Enable Split View to access them.`と回復方法を表示する。groupを暗黙mergeせず、利用者がsplitを再有効化して復帰できることを明示する」が追加された。**hidden 件数と回復導線の両方**が文言レベルで確定しており、新しい state も action も増えない（既存 `preview-empty` の文言分岐だけで実装できる）点も推奨と一致する。
- 既存 `preview-empty` は active pane で `role="status"` を持つため（`App.tsx:2377`）、この案内は支援技術にも通知される。文言が英語である点も既存 UI（`No document selected.` / `No file selected`）と一貫する。
- §12 の error handling 表へ「split off時にprimary empty / secondary nonempty | groupをmergeせずprimaryへhidden secondary件数と`Enable Split View`の回復案内を表示」が追加され、Phase 4 の期待値が確定した。
- §17-9 が「primary empty / secondary nonemptyでsplit offした場合はhidden件数と`Enable Split View`案内が表示され、再有効化で復帰する」まで含む形へ拡張され、§18 のリスク表にも同名の行と follow-up 条件（「UX評価でより直接的な復帰導線が必要なら別TODO」）が追加された。
- §15 の `markdown-viewer-tauri/README.md` 行にも「split off中のhidden secondary保持と回復方法を記載」が入り、利用者向け文書へ追跡された。

---

## 3. 改善提案

### 3.1 「非空 group は必ず非 null の active を持つ」という強い invariant が明示されておらず、TabStrip の旧 fallback が残る

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §6.2 へ invariant 8 を追加し、§9.4 で現行 roving tabindex fallback を旧経路として削除する旨を明記した。§16.2 へ invalid fixture test を追加した。

**根拠 / 差異**: §6.2-2 は「`activeTabId`は`null`、または同じpaneの`orderedTabIds` member」と弱い形でしか書いていないが、§7 の各 action を通すと `orderedTabIds.length > 0 ⇒ activeTabId !== null` が全経路で成立する（`open-tab` / `move-tab` destination は必ず選択し、`close-pane-tab` / `move-tab` source の fallback が `null` になるのは group が空になる場合だけ、`reset-root` は両方を空にする）。明示しないと、実装者が存在しない状態（非空 group + 未選択）を想定した現行分岐 `activeTabId === null && index === 0`（`App.tsx:2507`）をそのまま新 TabStrip へ移植する。review checkpoint 5 に該当する。

**推奨対応**: §6.2 へ invariant 8 を追加し、§9.4 へ旧 fallback を残さない旨、§16.1 へ invariant test を追加する。

**確認 (`e21fe5d`)**: 3 箇所すべてへ反映された。

- §6.2 へ「8. `orderedTabIds`が非空のpaneは必ず非`null`の`activeTabId`を持つ。`activeTabId === null`はgroupが空の場合だけ正当である。」が追加され、直後の担保責任も「1〜3、**7〜8**とmode / pane actionの整合は`splitView.ts`が守る」へ更新された。invariant 7 が守護対象から漏れていた点も併せて是正されている。
- §9.4 へ「invariant 8によりlocal tabsが非空ならactive tabも必ず存在するため、現行`activeTabId === null && index === 0`のroving tabindex fallbackは削除し、旧経路として残さない」が追加され、削除対象が実ソースの式まで特定された。
- §16.2 の invalid invariant test へ「nonempty group + null active」が追加され、reducer 側でも固定される。

### 3.2 `open-tab` / `close-pane-tab` の single mode + secondary 指定の契約が `activate-pane` と非対称

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §7 で single mode の secondary 指定を全 pane action で throw と対称定義し、§16.2 へ test を追加した。

**根拠 / 差異**: §7 は `activate-pane` に「singleでsecondary指定はthrow」、`move-tab` に「split限定」を明記する一方、`open-tab` と `close-pane-tab` は paneId の妥当性条件を書いていなかった。`open-tab` は契約に「pane activate」を含むため、single mode で secondary を渡すと invariant §6.2-7 と衝突する。現行 UI からは到達しないが、reducer は programming error を throw で顕在化する方針（§6.2 末尾）なので契約表側で対称に定義すべきである。

**推奨対応**: §7 の該当 2 行へ throw 条件を追記し、§16.1 の invalid invariant test へ 1 項目加える。

**確認 (`e21fe5d`)**: `open-tab`「groupになければ末尾追加し選択・pane activate。既存memberなら重複せず選択。**singleでsecondary指定はthrow**」、`select-tab`「memberだけ選択・pane activate。非member、**またはsingleでsecondary指定はthrow**」、`close-pane-tab`「…nonmember、**またはsingleでsecondary指定はthrow**」となり、`activate-pane` / `move-tab` と併せて pane action 5 種すべてが対称になった。§16.2 へも「single secondary open / select / close / activate / move…の拒否」が追加されている。なお §8.4 の hidden secondary 案内（指摘 2.2）が「single 中は secondary group を操作できず、split 再有効化で復帰する」と述べる内容とも整合しており、契約と UI 説明が一致する。

### 3.3 group → data 解決 helper の signature と、throw の実行点が未確定

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §9.2 へ generic `resolveGroupTabs<T>` の signature を、§9.1 へ App `useMemo` を integration boundary とする解決点を確定し、§9.3 で `DocumentPane` 内の再解決を禁止した。§16.2 へ resolver test を追加した。

**根拠 / 差異**: §9.2 は `splitView.ts` に解決 helper を置きつつ同節で「`OpenDocumentTab` の具体型へ依存しない」と要求しており、両立には generic signature が必要だが明記が無かった。より重要なのは throw の実行点で、§9.2「ID 不在を throw」と §9.3「`DocumentPane` は…view を解決する」を素直に読むと render path で throw する設計になる。`tabs` と `splitViewState` は別々の `useState`（`App.tsx:153-154`）で、invariant §6.2-4 / 5 は App の integration boundary で守られる。React 19 の自動 batching により現行の全経路は同一 commit へ入るため実際には破れないが、render path の throw は将来の非同期順序の綻びを「表示崩れ」ではなく「復帰不能な白画面」にする。

**推奨対応**: §9.2 へ generic signature を明記し、§9.1 / §9.3 へ「pane ごとの tab view は App が `useMemo` で 1 箇所だけ解決し、`DocumentPane` へは解決済み view を渡す。throw はこの integration boundary に限定する」を確定させる。

**確認 (`e21fe5d`)**: 推奨とほぼ同文で確定した。

- §9.2 へ「generic `resolveGroupTabs<T extends { id: string }>(orderedTabIds: string[], tabs: T[]): T[]`を提供する。ID不在はthrowし、silent filterしない」が入り、`OpenDocumentTab` 非依存と ID 解決責務が型で両立した。
- §9.1 へ「`resolveGroupTabs<T…>`を`useMemo`からprimary / secondaryそれぞれ1回だけ呼び、解決済みviewを`DocumentPane`へ渡す。missing IDのthrowは**このApp integration boundaryに限定する**」が入り、throw 実行点が 1 箇所へ確定した。
- §9.3 が「Appで…解決済みの`OpenDocumentTab[]` viewを受ける。**render内でglobal collectionとの再解決を行わない**」「selected tabは解決済みgroup viewからだけ選び、global listから任意IDを直接選ばない」へ改訂され、pane 側の再解決経路が構造的に塞がれた。§15 の `detail_design.md` 置換方針とも一致する。
- §16.2 へ「generic group resolverのlocal順解決とmissing ID throw、reference set導出」が追加され、pure function として自動検証される。

### 3.4 §8.3 の move 手順に image viewer の扱いが無い（§8.2 の close とは非対称）

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §8.3 へ手順 7 として image viewer の identity 3 ケースを追加し、§12 と §17-6 へも反映した。

**根拠 / 差異**: §8.2 は close について既存 identity effect による close を明記するが、§8.3 の手順と §12 の表には記述が無かった。実際には既存 effect（`App.tsx:1133-1148`）が `paneId` + `tabId` + `revision` + `visual.isConnected` を照合するため、(a) source pane の viewer は source の selection 変化で閉じ、(b) destination で selection が変わる場合も閉じ、(c) destination が既に同 tab を選択中で selection が変わらない場合は開いたまま、という挙動になる。(c) は §8.3-4 の「destination が移動対象を既に選択中なら status と既存 DOM / iframe を維持する」と対になる境界条件である。

**推奨対応**: §8.3 へ 3 ケースを 1 文で追記し、§12 の表と §17-6 へも加える。

**確認 (`e21fe5d`)**: §8.3 へ手順 7「image viewerは既存identity effectへ従う。origin paneのselectionが変わるsource active moveまたはdestination selection変更では閉じる。destinationが既に同tabを選択中でorigin identityも変わらないviewerは維持する」が追加され、指摘した (a)(b)(c) が網羅された。§12 へ「move時のimage viewer | origin paneのselectionが変わる場合だけ既存identity effectで閉じ、identity不変なら維持」、§17-6 へ「image viewer表示中はorigin selectionが変わるmoveで閉じ、identity不変のdestination viewerは維持されることも確認する」が追加され、§8.2 の close 記述と同じ粒度になった。§14 の `imageViewer.ts` 「変更なし」とも矛盾しない（判定は既存 App effect に閉じる）。

### 3.5 §8.5 Reload の対象記述が「両 pane 同時 reload」とも読める

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §8.5 の当該文を「active pane（primary または secondary）の selected global tab 1 件だけ」へ訂正した。

**根拠 / 差異**: 旧文は「**active primary / secondary**のselected global tabだけrevisionを増やす」であり、「active な primary または secondary の」とも「primary と secondary の両方の」とも読めた。現行実装は active pane の selected tab 1 件だけを対象とし（`App.tsx:625-642`）、`docs/components/tauri_viewer/interface_spec.md:12` も「root treeと**active pane**のselected tabだけを再読み込みする」と確定済みである。後者の解釈で実装されると Reload 対象が 1 件から最大 2 件へ変わる仕様変更になる。

**推奨対応**: 「active pane（primary または secondary）の selected global tab だけ revision を増やす」へ訂正する。

**確認 (`e21fe5d`)**: 「active pane（primaryまたはsecondary）のselected global tab **1件だけ**revisionを増やす」へ訂正され、件数まで明示された。直後の「同じIDが両groupでselectedなら両pane previewが同じnew revisionへ更新される」との整合も保たれており、`interface_spec.md:12` の既存確定記述と一致する（したがって §15 の同ファイル置換対象にも Reload 行は含まれない、という切り分けも成立する）。

### 3.6 split 時の tab item 幅（`min-width` / `32vw`）の見直し根拠が §11 / §18 に無い

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §11 へ split 時の `min-width` 160px と viewport 基準維持を明記し、§17-12 / §18 へ反映した。

**根拠 / 差異**: 現行 `.tab-item` は `grid-template-columns: minmax(0, 1fr) 30px`、`width: min(220px, 32vw)`、`min-width: 130px`（`App.css:867-876`）。split 時に 3 列化すると control が計 60px を占め、`min-width: 130px` では document 名に 70px しか残らず `.tab-name` の ellipsis が実質機能しない。また `32vw` は TODO-2026-021 で確定した window viewport 基準の契約であり（TODO-2026-006 設計レビュー指摘 3.4 で明文化済み）、pane 幅が半減しても tab 幅は縮まないため horizontal overflow が single 時より早く発生する。これは意図した結果だが、`min-width` を据え置くのか引き上げるのかが未確定だった。

**推奨対応**: §11 へ split 時の `min-width` 見直し（例 160px）と `32vw` の viewport 基準維持を 1 行加え、§18 と §17-12 へ反映する。

**確認 (`e21fe5d`)**: §11 が「split時だけ`.tab-item`の`min-width`を3列分の**160px**へ引き上げ、document名領域を確保する。`width: min(220px, 32vw)`の**window viewport基準**、horizontal overflow、focus-visible、loading / error表示は維持する」へ改訂され、推奨した値と据え置き対象が両方確定した。160px は control 60px を除いて名前領域 100px となり、130px 時の 70px から実用域へ回復する。§18 のリスク行が「split時だけminimum 160px、`min(220px, 32vw)`とhorizontal overflowは維持」へ、§17-12 が「split時のtabは160px minimumでmove / close controlと判別可能なellipsis名を保ち、`min(220px, 32vw)`のviewport基準とpane内horizontal overflowが維持される」へ更新され、TODO-2026-021 の確定契約を変更しない立場が手動確認まで一貫している。

### 3.7 ADR 非追加の再評価条件が書かれていない

**severity**: Low
**status**: **解決済み**（2026-07-28 再確認、commit `e21fe5d`）

**対応**: §13 の ADR 行へ TODO-2026-025 / TODO-2026-011 での再評価条件を追記した。

**根拠 / 差異**: `docs/adr/README.md` §2 の起票条件 1（既に採用済み）は Phase 2 時点で未成立、条件 2（複数案件で再利用される可能性が高い）も現時点では Tauri 単独であるため、ADR 非追加の判断自体は妥当である（ADR 一覧も現在 seed 無しで空）。ただし §13 自身が TODO-2026-025 での group model 再利用に触れ、§19 が Avalonia への適用可能性に触れているため条件 2 の成立時期は予見でき、TODO-2026-006 の設計レビューで確立した再評価条件を残す運用が引き継がれていなかった。

**推奨対応**: §13 の ADR 行へ再評価の起点となる TODO を明記する。

**確認 (`e21fe5d`)**: §13 の ADR 行へ「TODO-2026-025またはTODO-2026-011で同じgroup modelを採用した時点で、複数案件へ再利用する採用済み判断としてADR起票条件を再評価する」が追記され、`docs/adr/README.md` §2 の条件 1（採用済み）と条件 2（複数案件で再利用）の両方が成立する時点が特定された。TODO-2026-006 設計レビューの運用と一貫する。

### 3.8 runtime status の直接 clear 削除対象が 5 call site 中 2 件しか列挙されていない（新規）

**severity**: Low（非ブロッキング、指摘 2.1 の残課題）
**工程**: Phase 2（§9.1 / §14 への追記）
**status**: **解決済み**（2026-07-28 Round 2 再確認、commit `3542fbb`）

**対応**: §9.1 で直接 clear を行わない handler を close / move / open / reload / root reset / split toggle の 6 種へ拡張し、`setPanePreviewStatus(..., null)` による clear を generic effect だけに限定した上で、他の呼び出しを `updatePanePreviewPhase` 経由の status 設定へ限る実装完了条件を明記した。§14 の `App.tsx` 行も同じ列挙と 2 経路限定へ改訂した。

**ドキュメント記載（Round 1 時点）**: §8.2「pane preview statusのstale判定は`isPanePreviewStatusCurrent`を使う既存generic effectを**唯一の正本**とし、close handlerでは直接clearしない。現行`closeTab`の…両paneから無条件clearする処理は削除する。」§8.4「toggle handlerから直接clearしない。」§9.1「close / move handlerはpane runtime statusを直接clearせず、既存generic effectへ委ねる。」§14 `App.tsx` 行「close / toggleの直接runtime clearを削除」。

**根拠 / 差異**: 指摘 2.1 の解決により「generic effect が唯一の正本」という原則は確定したが、削除対象として名指しされているのは `closeTab`（`App.tsx:785`）と `toggleSplitView`（`App.tsx:874`）の 2 件だけである。現行 `App.tsx` には `setPanePreviewStatus(..., null)` による直接 clear が計 5 箇所ある。

- `App.tsx:461-462`（`loadRoot`）: root scan 成功後に両 pane を clear。`reset-root` 後は `tabs` が空になり `isTabRevisionCurrent` が false を返すため、generic effect で必ず clear される。**冗長**。
- `App.tsx:638`（`reload`）: 同じ tab を選択中の pane を clear。revision が +1 されるため status の revision が一致せず、generic effect で必ず clear される。**冗長**。
- `App.tsx:672`（`openOrActivateTab`）: 新規 tab 追加時に対象 pane を clear。pane の selection が新 tabId へ変わるため、generic effect で必ず clear される。**冗長**。
- `App.tsx:785`（`closeTab`）: §8.2 で削除対象として明記済み。
- `App.tsx:874`（`toggleSplitView`）: §8.4 / §14 で削除対象として明記済み。

§14 の `App.tsx` 行が「close / toggleの直接runtime clearを削除」と**列挙形で**書かれているため、Phase 3 で設計どおりに実装しても残り 3 箇所（`loadRoot` / `reload` / `openOrActivateTab`）が残存する読み方が成立する。その場合、§8.2 が宣言する「唯一の正本」は 5 箇所中 3 箇所で成立せず、指摘 2.1 が問題視した「判定条件の異なる 2 つ目の正本」が形を変えて残る。

なお 3 箇所とも clear 方向（`null` 化）のみであり、generic effect が出す結果と必ず一致するため**表示上の不具合は生じない**。純粋に旧経路・重複実装の残存であり、review checkpoint 2（不要な重複実装）に該当する Low 指摘としている。§8.1（open）・§8.5（Reload）・§8.6（root change）はいずれも status の扱いに触れていないため、設計上も空白のままである。

**推奨対応**: 次のいずれかで削除範囲を確定する。

- (a) 推奨: §14 の `App.tsx` 行を「close / toggle / open / reload / root reset の直接 runtime clear をすべて削除し、`setPanePreviewStatus` の呼び出しを `updatePanePreviewPhase`（`App.tsx:308-325`）による設定と generic effect による clear の 2 経路だけに限定する」へ改める。
- (b) §8.1 / §8.5 / §8.6 のそれぞれへ「pane preview status は §8.2 と同じく generic effect へ委ね、handler では直接 clear しない」を 1 行ずつ追加する。

いずれの場合も、削除後に status を `null` にする経路が generic effect だけになることを §9.1 に 1 文で明記すると、Phase 3 の完了判定が機械的に行える。

**確認 (`3542fbb`)**: 推奨案 (a) が採用され、指摘した 3 つの検証点すべてを満たしている。

- **handler の網羅**: §9.1 が「close / **move / open / reload / root reset** / split toggle handlerはpane runtime statusを直接clearせず、既存generic effectへ委ねる」へ改訂された。現行 5 call site（`loadRoot` の `App.tsx:461-462` = root reset、`reload` の `:638` = reload、`openOrActivateTab` の `:672` = open、`closeTab` の `:785` = close、`toggleSplitView` の `:874` = split toggle）と新設 `moveTab` = move が 1:1 で対応し、**列挙漏れは無い**。§14 の `App.tsx` 行も同じ 6 handler 列挙へ更新され、影響範囲表と責務記述が一致した。
- **clear 経路の限定**: 同行へ「`setPanePreviewStatus(..., null)`によるclearはこの**generic effectだけに限定**し」が入り、指摘 2.1 で確定した「唯一の正本」が call site レベルまで降りた。
- **実装完了条件**: 「`setPanePreviewStatus`の他の呼び出しは`updatePanePreviewPhase`経由のstatus設定だけにする」により、削除後の残存 call site が `updatePanePreviewPhase`（`App.tsx:324`）と generic effect（`App.tsx:1173`）の 2 箇所だけになる。現行の 7 call site（設定 1 + 直接 clear 5 + effect 1）から算術的に 2 へ収束することを確認しており、Phase 3 完了判定は `setPanePreviewStatus` の呼び出し数の確認だけで機械的に行える。

削除しても表示が壊れないことも再検算した。generic effect は `!isPanePreviewStatusCurrent` のときだけ clear するため、status が保持されるのは「その pane で当該 tab がその revision で選択中」の場合に限られる。root reset（`tabs` が空）、reload（revision +1）、open（selection 変化）はいずれもこの条件を外すため、generic effect だけで必ず clear される。§9.1 / §14 の記述と実装挙動に齟齬は無い。

---

## 4. 受け入れ条件トレース確認

Round 1 fix (`e21fe5d`) と Round 2 fix (`3542fbb`) 反映後の状態で再評価した。初回 △ だった 2 行と ✗ だった 1 行はすべて ✓ へ更新した。**全行 ✓、未達の完了条件は無い。**

| `docs/todo/todo.md` TODO-2026-023 完了条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| 各 pane の TabStrip にはその pane で開いた tab だけが表示され、他 pane の tab 追加・close で意図せず増減しない | §4.1、§6.1、§6.2、§7、§9.3、§9.4、§16.2 | ✓ 整合。ordered ID collection と local close で閉じており、invariant 8 の追加で「非空 group + 未選択」という中間状態も排除された |
| tab activate / close、Reload、relative link、root 変更、split on / off で pane-local tab collection と active tab が一貫して復旧する | §7（2 列 action 表）、§8.1-§8.6、§16.2 | ✓ 整合。指摘 1.1 の対応で `pendingNavigation` が全 10 action に定義され、invariant 3 が全経路で閉じた。Reload 対象も 1 件へ明確化済み（指摘 3.5） |
| Markdown / HTML / Mermaid / PlantUML の非同期結果と loading / error 表示が pane 間で混線しない | §8.2、§8.3、§8.4、§9.1、§9.5、§10.1、§10.2、§16.3 | ✓ 整合。stale 判定が `isPanePreviewStatusCurrent` の generic effect へ一本化され（指摘 2.1）、直接 clear の削除対象も 6 handler すべてと実装完了条件まで確定した（指摘 3.8）。`paneRuntime.ts` の pane / tab / revision guard を変更せずに済む理由も正しい |
| 移動元は隣接 tab または未選択へ復旧し、移動先では対象 tab が選択される | §7 (`move-tab`)、§8.3、§12 | ✓ 整合。source 変更前順序を基準にした右→左→null fallback、destination dedupe、source / destination の pending 規則、image viewer の identity 3 ケースまで確定した |
| keyboard だけでも移動操作へ到達でき、focus と accessible name / state が維持される | §4.4、§9.4、§11、§17-7 | ✓ 整合。roving order、Tab 順への含め方、move 後 focus、pane 名込み accessible name に加え、split 時の tab 幅 160px 確保で操作対象の判別性も担保された（指摘 3.6） |
| `npm test`、`npm run build`、`cargo check` が成功する | §16.4 | ✓ 整合。`docs/rules/development_workflow.md:156-164` の Tauri 検証コマンドと一致し、`cargo fmt --check` / `cargo test` / `git diff --check` を上乗せしている |
| frontend policy test で pane 別の追加・activate・close、同一 document の両 group 参照、pane 間移動、split off / on、root reset、stale async result 拒否を検証できる | §16.1（既存 test 移行方針）、§16.2、§16.3 | ✓ 整合。指摘 1.2 の対応で 34 call site の移行・置換方針と共通 fixture helper が確定し、pending invariant・invalid fixture・generic resolver の test も追加された |
| 手動確認で Explorer / relative link から active pane へ tab が追加され、左右の TabStrip が独立して増減・選択される | §17-1〜3 | ✓ 整合 |
| 手動確認で pointer / keyboard の双方から move でき、fallback、destination selection、focus、StatusBar / ErrorBanner routing が一致する | §17-6、§17-7 | ✓ 整合。image viewer の観点も §17-6 へ追加された（指摘 3.4） |
| 手動確認で同じ Markdown / HTML を両 pane に開き、Mermaid / PlantUML / HTML ready・timeout が混線しない | §17-4、§17-10、§17-11 | ✓ 整合 |
| 既存 single / split view と HTML security boundary の回帰が無い | §10.2、§13、§14（`src-tauri` 変更なし）、§17-12 | ✓ 整合。security 境界は `documentPolicy.ts` を正本に据え、group / active pane を許可条件へ持ち込まない方針が維持されている |
| 恒久ドキュメント同期 | §15（置換対象表） | ✓ 整合。指摘 1.3 の対応で 6 箇所の旧確定記述と節単位の置換方針が特定され、`development_workflow.md` の旧 manual 合否基準 2 行も §17 と 1:1 対応で置換される |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| global document data + pane-local ordered ID references の採用判断（§4.1、§4.5） | ✓ 妥当。`OpenDocumentTab` は path 一意・`revision`・PlantUML 結果を保持する（`App.tsx:87-98`）ため pane 複製で正本が二重化する。単一 `paneId` 案・global filter 案の不採用理由も現行構造と一致する |
| group state を `splitView.ts` へ統合する判断（§4.2） | ✓ 妥当。ordered IDs / selection / move / close / split toggle は同じ invariant を共有するため分離すると二重管理になる。別 module を作らない・module-global mutable state を持たない・discriminated union reducer へ集約するという方針は、既存 policy module 群の配置原則と一貫する |
| §6.2 invariant 1〜8 の網羅性（Round 1 fix 後） | ✓ 妥当。invariant 8 の追加と担保責任「1〜3、7〜8 は `splitView.ts`」への修正により、reducer が守る範囲と App が守る範囲（4〜5）の切り分けが漏れなく揃った |
| §7 action 表の pending 規則の完全性（Round 1 fix 後） | ✓ 妥当。10 action すべてに pending 契約が付き、selection を変える 4 action・変えない 6 action のいずれも invariant 3 を保存することを個別に検算した |
| local close + unreferenced eviction の順序（§4.3、§8.2、§9.1） | ✓ 妥当。「reducer 適用後の次 state の両 group 参照集合」で判定するため順序依存が閉じている。同 ID を両 group が参照する場合に global tab / revision / shared load state を維持する規則も、in-flight `loadTab` が `updateTabIfCurrent`（`App.tsx:409-417`）で正しく着地する構造と一致する |
| eviction 後の late async result（§8.2） | ✓ 妥当。`updateTabIfCurrent` は id + revision 一致の map であり、global tab 削除後は自動的に no-op になる。`nextTabIdRef`（`App.tsx:190`）が単調増加のため ID 再利用による誤着地も起きない |
| `move-tab` の atomic 契約（§7、§8.3、§12） | ✓ 妥当。source removal + fallback と destination dedupe add + select を 1 action で返す設計は正本が 1 つに保たれる。destination に同 ID がある場合に既存位置を維持する規則も §10.2 の iframe key 安定性と整合する |
| generic stale status effect への一本化（§8.2、§8.3、§8.4、§9.1、§14） | ✓ 妥当。`resolvePaneTabPresentationState`（`paneRuntime.ts:82-88`）と `currentActivePaneStatus`（`App.tsx:198-204`）がいずれも tabId / revision 一致を要求するため、先行 clear を廃止しても 1 commit 分の誤表示は生じない。§9.1 / §14 が close / move / open / reload / root reset / split toggle の 6 handler を列挙し、残存 call site を `updatePanePreviewPhase` 経由の設定と generic effect の clear の 2 経路へ限定したことで、正本が 1 つであることが call site 数として検証可能になった |
| `paneRuntime.ts` を変更しない判断（§9.5、§14） | ✓ 妥当。`isPaneSelectionCurrent`（`paneRuntime.ts:33-42`）は pane ごとの `activeTabId` 比較、`isTabRevisionCurrent`（同 44-50）は global identity 比較であり、membership の概念を必要としない |
| split off 中の secondary result 拒否（§8.4、§16.3） | ✓ 妥当。`isPaneSelectionCurrent` が `paneId === "secondary" && mode !== "split"` で false を返す既存実装（`paneRuntime.ts:38-40`）により、group 保持と result 拒否・runtime status clear が追加実装なしで両立する |
| Mermaid / PlantUML の扱い（§10.1） | ✓ 妥当。render ID を `paneId + tabId + revision + index` とする既存実装（`App.tsx:2225`）と queue の App instance 所有（`App.tsx:189`）を維持し、move を DOM ownership 変更として `isPaneResultCurrent` + `isConnected` で stale 化する説明は現行 effect の構造（`App.tsx:2228-2274`）と一致する |
| trusted HTML の security 境界（§10.2） | ✓ 妥当。iframe key、source 照合、opaque origin、ready、activation、duplicate、scheme policy を維持し、active pane / group membership を許可条件へ加えない方針は TODO-2026-006 の確定判断を正しく引き継いでいる。sandbox / CSP / root boundary / capability を緩和する fallback を追加しない旨も明記されている |
| 互換性・単一路線（§13） | ✓ 妥当。`PaneState` だけを一括置換し、旧 global TabStrip 解釈や global close action を互換経路として残さない方針は checkpoint 5 と一致する。Rust command / `OpenDocumentTab` schema / settings JSON / protocol URL 不変も §14 と整合する |
| 非対象範囲（§3.2） | ✓ 妥当。drag and drop、reorder、pin、複数選択、3 pane 以上、永続化、上下 split、Avalonia、Rust / capability / CSP 変更の除外は `docs/todo/todo.md` の non_scope および TODO-2026-025 / TODO-2026-011 との分担と一致する |
| 検証コマンド（§16.4） | ✓ 妥当。`docs/rules/development_workflow.md:156-164` と一致。同 :225 のとおり Tauri frontend は lint script 未定義のため `npm run build` の TypeScript compile を完了条件に含める運用とも整合する |
| §16 の節番号繰り下げに伴う参照破損 | ✓ 無し。§16.1 新設で旧 §16.1〜16.3 が §16.2〜16.4 へ繰り下がったが、design 内に旧番号を参照する記述は残っていない（§17 / §18 / §20 はいずれも節番号で §16 を参照していない） |
| meta.md の整合 | ✓ 妥当。`design_status` が `draft` → `in_review` へ、Phase 2 行が「In review (initial review: 3 blocking Medium, 2 non-blocking Medium, 7 Low; all addressed for follow-up)」へ更新され、`related_commits` へ `996275a` / `ffda6e3` が追加された。`components` 一覧は §14 の影響範囲表と、`integrated_todo` / `follow_up` / `depends_on` は `docs/todo/todo.md` と一致する |

---

## 6. 指摘一覧と最終 status

| # | 指摘 | severity | 初回 blocking | status |
| --- | --- | --- | --- | --- |
| 1.1 | `pendingNavigation` の遷移規則が未定義で invariant §6.2-3 が閉じない | Medium | blocking | **解決済み** (`e21fe5d`) |
| 1.2 | 公開 API・既存 test の契約破壊範囲が §14 / §16 に無い | Medium | blocking | **解決済み** (`e21fe5d`) |
| 1.3 | 恒久 docs の矛盾記述（置換対象）が §15 で特定されていない | Medium | blocking | **解決済み** (`e21fe5d`) |
| 2.1 | pane runtime status clear が既存 generic effect と二重管理 | Medium | non-blocking | **解決済み** (`e21fe5d` + `3542fbb`) |
| 2.2 | split off 時に primary group が空だと開いている文書が不可視になる | Medium | non-blocking | **解決済み** (`e21fe5d`) |
| 3.1 | 非空 group ⇒ 非 null active の invariant 未明示、TabStrip 旧 fallback が残る | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.2 | `open-tab` / `close-pane-tab` の single + secondary 契約が非対称 | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.3 | group → data 解決 helper の signature と throw 実行点が未確定 | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.4 | §8.3 move に image viewer の扱いが無い | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.5 | §8.5 Reload の対象記述が曖昧 | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.6 | split 時 tab item 幅（`min-width` / `32vw`）の見直し根拠が無い | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.7 | ADR 非追加の再評価条件が未記載 | Low | non-blocking | **解決済み** (`e21fe5d`) |
| 3.8 | runtime status 直接 clear の削除対象が 5 call site 中 2 件しか列挙されていない | Low | — （Round 1 再確認で新規検出） | **解決済み** (`3542fbb`) |

**検出指摘 13 件（Medium 5 / Low 8）はすべて解決済み。未解決指摘 0 件。** Phase 3 へ進行できる。

Phase 3 実装レビューでの追跡観点（設計で確定済みの契約が実装へ落ちているかの確認点）:

- `splitView.ts`: §7 の pending navigation 契約が 10 action すべてに実装され、§6.2 invariant 1〜3 / 7〜8 が reducer で守られていること。`createInitialSplitViewState` が引数なし、`enable-split` / `disable-split` に payload が無く、`findAdjacentTabId` が export されていないこと。
- `App.tsx`: `setPanePreviewStatus` の呼び出しが `updatePanePreviewPhase` 経由の設定と generic effect の clear の 2 箇所だけであること（指摘 2.1 / 3.8）。`resolveGroupTabs` の呼び出しが `useMemo` の 2 回だけで、`DocumentPane` / `TabStrip` 内に再解決が無いこと（指摘 3.3）。TabStrip に `activeTabId === null` の roving fallback が残っていないこと（指摘 3.1）。
- 恒久 docs: §15 の置換対象 6 箇所が追記ではなく置換として反映され、`docs/rules/development_workflow.md` に旧 split toggle / close の合否基準が残っていないこと（指摘 1.3）。
- test: §16.1 の移行方針どおり、意味を維持した test と旧仕様のため置換した test が区別できる形になっていること（指摘 1.2）。
