# TODO-2026-023 Tauri pane-local tab group / pane 間移動 設計レビュー

**レビュー日**: 2026-07-28
**対象ドキュメント**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/design/tauri_pane_local_tab_groups_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-023（統合済み TODO-2026-024 を含む）
**レビュー対象コミット**: `996275a` (Phase 2 design Tauri pane-local tab groups)
**判定**: **要修正 (Changes Requested)**。設計の骨格（global document data + pane-local ordered ID references、`splitView.ts` への group state 統合、local close + unreferenced eviction、typed atomic move）は妥当で採用可。ただし Phase 3 着手前に **blocking 3 件 (Medium)** の設計反映が必要。**non-blocking Medium 2 件 / Low 7 件**。

---

## 概要

TODO-2026-023 の Phase 2 設計レビュー。`OpenDocumentTab[]` を document data の正本として維持したまま、表示所属・表示順・選択だけを pane-local な ordered tab ID collection へ移す設計を、現行実ソース（`markdown-viewer-tauri/src/splitView.ts`、`paneRuntime.ts`、`App.tsx`、`App.css`、`splitView.test.ts`、`paneRuntime.test.ts`）、TODO-2026-006 の確定設計・レビュー（`docs/design_analysis/new_feature/20260726_tauri_split_view/`）、恒久 docs（`docs/components/tauri_viewer/`、`docs/architecture/`、`docs/rules/development_workflow.md`）、`docs/adr/README.md` の起票条件を根拠に検証した。

採用案の骨格は妥当である。

- §4.1 の「global data 1 件 + 両 group から参照できる ordered ID」は、`OpenDocumentTab` が path 一意・`revision`・PlantUML 結果 cache を保持する現行構造（`App.tsx:87-98`）と一致し、pane ごとに複製する案を退けた理由も具体的である。
- §4.2 の `splitView.ts` への統合は、`explorerPane.ts` / `documentPolicy.ts` / `imageViewer.ts` / `paneRuntime.ts` が確立した「React / DOM / Tauri 非依存の exported pure policy」という既存 project pattern と一貫し、module-global mutable state を持ち込まない旨も明記されている。
- §4.3 の local close + unreferenced eviction は、eviction 判定を「次 state の両 group 参照集合」に置く点で順序依存を正しく閉じており、§9.1 の `closeTab` 契約とも整合する。
- §9.5 の「`paneRuntime.ts` は原則変更なし。`activeTabId` が membership invariant を満たすため global membership fallback は不要」は正しい。`isPaneSelectionCurrent`（`paneRuntime.ts:33-42`）は pane ごとの `activeTabId` 比較だけを行い、`isTabRevisionCurrent`（同 44-50）は global tab identity を見るため、pane-local group 導入で判定式を変える必要は無い。
- §10.2 の security 判断（active pane / group membership を許可条件へ持ち込まない、`documentPolicy.ts` を正本とする、sandbox / CSP / capability を緩和しない）は TODO-2026-006 の確定方針を維持しており、退行は無い。
- §4.5 の不採用案表は、単一 `paneId` 保持、`OpenDocumentTab[]` 複製、global からの filter、global close 維持、split toggle 時の暗黙 merge / copy、move 専用 React state、invalid ID の silent filter をいずれも具体的な理由で退けており、review checkpoint 2 / 3 / 5 の観点と一致する。

一方、次の 3 点は設計として閉じていない。

1. `pendingNavigation` の遷移規則が新しい action 契約表（§7）に一切書かれておらず、§6.2 invariant 3 が `open-tab` / `select-tab` / `close-pane-tab` / `move-tab` のいずれでも破れうる。現行 `select-tab` / `remove-tab` が持っている clear 規則が、新 action へ引き継がれていない。
2. `createInitialSplitViewState` の signature 変更、`enable-split` / `disable-split` の payload 削除、`select-tab` の非 member throw 化により既存 test の前提が破壊されるが、その影響範囲と書き換え方針が §14 / §16 に無い。
3. 恒久 docs に新仕様と**直接矛盾する確定記述**（global close、両 pane 同一 collection、split on/off の引き継ぎ規則）が存在し、そのうち 2 行は Phase 4-a の手動確認合否基準そのものだが、§15 は更新先ファイル名を列挙するだけで置換対象を特定していない。

---

## 1. 齟齬・不整合（blocking）

### 1.1 `pendingNavigation` の遷移規則が新 action 契約表に無く、invariant §6.2-3 が全経路で閉じない

**severity**: Medium（**blocking**）
**工程**: Phase 2（設計修正）
**対応優先度**: 高（Phase 3 着手前）

**ドキュメント記載**: §6.2-3「`pendingNavigation`がある場合、その`tabId`は`activeTabId`と一致する。」§7 action 表（`open-tab` / `select-tab` / `close-pane-tab` / `move-tab` の「契約」列）。§7 本文「sourceのtabがactiveでなければsource active / pendingは維持する。」§16.1 test 一覧。

**根拠 / 差異**: §7 の表で `pendingNavigation` に言及しているのは `disable-split`（secondary の pending だけ clear）と `consume-navigation` だけである。selection を動かす 4 つの action すべてで clear 規則が未定義であり、現行実装が持っている規則が引き継がれていない。

- **`select-tab`**: 現行は anchor 無しで選択した場合に必ず `pendingNavigation: null` を書く（`splitView.ts:70-74`）。新 §7 の `select-tab` は入力から anchor が外れ（`paneId, tabId` のみ）、契約列は「memberだけ選択。非memberはthrow」だけである。clear 規則が落ちると、pane が tab A の pending を保持したまま TabStrip で tab B を選択した瞬間に `pendingNavigation.tabId (A) !== activeTabId (B)` となり invariant 3 が破れる。
- **`close-pane-tab`**: 現行 `remove-tab` は、閉じた tab が active なら `{ activeTabId: fallback, pendingNavigation: null }`、非 active なら pending の tabId 一致時だけ null にする（`splitView.ts:113-127`）。新 §7 の契約列は fallback 順序（右→左→null）しか定義していないため、pending を持つ active tab を close すると fallback tab が選択されたまま pending が閉じた ID を指し続ける。
- **`move-tab`**: §7 本文は source 側（「activeでなければ source active / pending は維持」）にしか触れていない。destination が別 tab の pending を保持している状態で移動対象を destination へ選択させると、destination 側で invariant 3 が破れる。§8.3 の 6 手順にも destination pending の記述は無い。
- **`open-tab`**: §8.1-5「anchorがあれば同paneのpending navigationへ設定する」とあるが、anchor が**無い**場合に既存 pending をどうするかが無い。Explorer から別 document を開く経路（`App.tsx:1231` → `openOrActivateTab`）は anchor 無しであり、頻出経路で invariant 3 が破れる。

破れた場合の実害は crash ではなく、消えない stale anchor である。`DocumentPane` の pending navigation effect は `navigation.tabId !== tab.id` で早期 return する（`App.tsx:2288-2300`）ため即時の誤 scroll は起きないが、`consume-navigation` は §7 のとおり identity 一致時だけ clear するため pending は永続的に残り、その pane で当該 tab を再選択した瞬間に古い anchor へ scroll する。これは TODO-2026-023 完了条件「tab activate / close、Reload、relative link、root変更、split on / offでpane-local tab collectionとactive tabが一貫して復旧する」に反する。

§16.1 の test 一覧でも `pending clear` は move 行にしか現れず、close / select 経路の pending は検証対象外である。

**推奨対応**: §7 の表へ pending 列（または契約列への 1 文）を追加し、4 action すべての規則を確定させる。invariant 3 が成立していれば「pending.tabId は常に activeTabId」なので、規則は次のように単純化できる。

- `open-tab`: anchor があれば `{ tabId, anchor }`、無ければ `null`。
- `select-tab`: 常に `null`。
- `close-pane-tab`: **閉じた tab が active だった場合だけ** `null`。非 active tab の close では pending は不変（invariant 3 により非 active tab の pending は存在し得ない）。この結果、現行 `remove-tab` が持つ `pane.pendingNavigation?.tabId === action.tabId` guard（`splitView.ts:119-121`）は不要な旧経路になるため、併せて削除対象として §14 へ記載する。
- `move-tab`: source は active tab を移した場合だけ `null`、destination は selection が変わる場合 `null`（destination が既に同 tab を選択中なら維持）。

§16.1 へ「pending 保持中の select / close / move で invariant 3 が保たれる」test を、§16.2 側は変更不要として明記する。

### 1.2 公開 API・既存 test の契約破壊範囲が §14 / §16 に整理されていない

**severity**: Medium（**blocking**）
**工程**: Phase 2（設計追記）
**対応優先度**: 高（Phase 3 の作業見積りに直結）

**ドキュメント記載**: §6.3「起動時: single、active primary、両group empty、ratio 0.5。」§7 の `enable-split` / `disable-split`（入力「なし」）、`select-tab`（「非memberはthrow」）。§14 影響範囲表の `splitView.ts` / `splitView.test.ts` / `paneRuntime.ts` / `paneRuntime.test.ts` 行。§16.1 / §16.2 の test 一覧。

**根拠 / 差異**: 新 schema へ一括置換する方針（§13）自体は妥当だが、置換によって壊れる既存の公開契約と test が特定されていない。

- **`createInitialSplitViewState(activeTabId: string | null = null)`（`splitView.ts:45-53`）**: 現行は引数の tab ID を `primary.activeTabId` へ直接入れる。新 schema でこれを維持すると、`primary.orderedTabIds` が空のまま `activeTabId` が非 null となり、**初期状態で invariant §6.2-2（active は own group member）と §6.2-4（ordered ID は global tab に実在）を同時に破る**。signature 変更は必須だが、§14 の `splitView.ts` 行は「ordered IDs、group actions、invariant / reference helper、既存split semantics更新」までで初期化関数に触れていない。影響は `splitView.test.ts` 9 箇所、`paneRuntime.test.ts` 9 箇所の引数付き呼び出し。
- **`enable-split` / `disable-split` の `orderedTabIds` payload 削除**: `splitView.test.ts` 13 箇所、`paneRuntime.test.ts` 3 箇所が該当。`findAdjacentTabId`（`splitView.ts:156-162`）も §7 の「global順序は使わない」により用途が source group 内 fallback へ変わるため、export 継続可否と signature の確定が要る。
- **`select-tab` の非 member throw 化**: group 未登録 ID を選択している既存 test が throw する。具体的には `splitView.test.ts:62-82`（`secondary` へ未登録の `"a"` を select）、`paneRuntime.test.ts:78-82`（`primary` へ未登録の `"b"` を select）。これは review checkpoint 5「既存テストケースの意味が変わっていないか」に直接該当し、「同じ意図を新 schema で表現し直す」のか「規約変更により削除する」のかを設計時に決めておかないと、Phase 3 で意味を保ったまま書き換えたのか単に通るよう緩めたのかが判定できない。
- §14 は `paneRuntime.ts` を「原則変更なし。型変更に伴う参照調整のみ」とするが、`paneRuntime.test.ts` は helper 前提（group 未登録の active tab を持つ state）が崩れるため、**追加 test（§16.2）だけでなく既存 5 test の書き換え**が必要になる。§16.2 は追加分しか列挙していない。

**推奨対応**: §6.3 / §14 / §16 へ次を追記する。

- (a) `createInitialSplitViewState` の新 signature を確定する（推奨は引数なしで両 group empty を返す形。root 初期 document は §8.6 のとおり `open-tab` で入れる）。
- (b) `enable-split` / `disable-split` の payload 削除と、`findAdjacentTabId` の新しい入力（source group ordered IDs）・export 継続可否を §7 か §9.2 へ明記する。
- (c) §16 冒頭へ「既存 test の扱い」小節を設け、意味を保って書き換える test（split width / ratio / keyboard 系、`paneRuntime` の guard 系）と、規約変更により置換する test（group 未登録 ID の select、split on/off の隣接 tab 選択・引き継ぎ）を分けて列挙する。
- (d) test 側で group membership 込みの state を組み立てる共通 helper を置く方針を §16.1 へ 1 行加える（各 test で `open-tab` を積み上げると意図が読みにくくなるため）。

### 1.3 恒久 docs に新仕様と矛盾する確定記述があり、§15 が「置換対象」を特定していない

**severity**: Medium（**blocking**）
**工程**: Phase 2（設計の §15 具体化）／ Phase 3（実反映）
**対応優先度**: 高（Phase 4-a の合否基準に直結）

**ドキュメント記載**: §15「恒久ドキュメント更新予定先」（11 ファイルの列挙）。§2.3「明示的な互換性変更」。§17 ユーザ動作確認観点。

**根拠 / 差異**: §15 は更新先ファイル名と概略テーマを挙げるだけで、**現行 docs に既に確定記述として存在し、本変更で偽になる記述**を特定していない。次の 6 箇所は追記では解消せず、削除・置換が必要である。

- `docs/components/tauri_viewer/interface_spec.md:11`「Tab close: **global tabを両paneのTabStripから削除する**。閉じたtabを選択していたpaneだけ右隣、なければ左隣へ移り、最後のtab close後は両paneが未選択表示になる。」→ §4.3 の local close と正面から矛盾する。
- 同 `## TabStrip 表示` 節「**single / splitの各paneに同じglobal tab collectionを表示する**。」「同一root内でopenしたMarkdown / HTMLを**open順**に表示する。」→ §5 の「pane-local insertion order」と矛盾する。
- 同 `## Split View 表示` 節「split on時はprimaryを維持し、**右隣、なければ左隣の別tabをsecondaryへ選ぶ**。別tabがなければsecondaryは未選択とする。」「**split off時はselected tabを持つactive paneをprimaryへ引き継ぐ**。active secondaryが未選択なら既存primaryを維持し、両pane未選択でtabが残る場合だけ先頭tabへ復旧する。」→ §2.3 で明示的に廃止する仕様であり、全面置換が要る。なお後段は TODO-2026-006 設計レビュー指摘 1.1 の対応結果として確定した記述であり、その経緯を承知の上で置換する旨を残さないと、後から退行と誤読される。
- `docs/components/tauri_viewer/detail_design.md:469`「各`DocumentPane`は**同じglobal tabsを受ける**pane-local `TabStrip`とtabpanelを持ち」→ 置換が要る。
- `docs/rules/development_workflow.md:174`「`View > Split View`でsingle / 左右2 paneを切り替え、**primary維持、secondary隣接tab選択、active secondaryからsingleへの引き継ぎ、空secondaryからのprimary維持**が仕様どおりであること」→ **Phase 4-a の手動確認合否基準そのものが旧仕様**である。追記だけ行うと、同じ list 内で「引き継ぐこと」と「引き継がないこと」を両方確認する矛盾した手順が残る。
- 同 `:177`「active / non-active tab close、両paneで同じtab、最後のtab、root変更で**pane selectionが一貫して復旧**し、無効tab IDが残らないこと」→ local close と unreferenced eviction を含む文言へ更新が要る。
- `markdown-viewer-tauri/README.md:68`「各paneのTabStripから文書を独立に**選択**します。」→ 選択の独立性しか書いておらず、所属・表示順・local close・move が抜ける。

review checkpoint 5「要求されていない後方互換レイヤーや旧経路を残していないか」と checkpoint 7「関連コンポーネント文書へ反映済みか」の双方に該当する。

**推奨対応**: §15 を「更新予定先」から「**置換対象記述の一覧**」へ具体化し、上記 6 箇所（ファイル + 節または行 + 置換方針）を最低限含める。特に `development_workflow.md` の 2 行は追記ではなく置換であることを明記し、§17 の 12 観点と 1:1 で対応付ける（例: §17-9 ↔ split toggle 行、§17-3/5 ↔ close 行）。`interface_spec.md` の `## TabStrip 表示` / `## Split View 表示` は節単位の書き換えになる旨も 1 行加える。

---

## 2. 設計判断への指摘（non-blocking）

### 2.1 pane runtime status の clear が、既存の generic effect と二重管理になる

**severity**: Medium（non-blocking）
**工程**: Phase 2（責務の明記）または Phase 3（実装時に一本化）
**対応優先度**: 中

**ドキュメント記載**: §8.2「source paneのruntime statusがclosed IDならclearする。他pane statusは、そのpaneが同じIDを表示していれば維持する。」§8.3-4「action前後で各paneのactive tab identityを比較し、selectionが変わったpaneのstale `PanePreviewStatus`だけをclearする。」§9.1「`moveTab`でtyped action、runtime clear、destination focusを調停する。」

**根拠 / 差異**: 現行 App には既に、全 pane の `PanePreviewStatus` を `isPanePreviewStatusCurrent` で毎 commit 検証し、current でないものを null へ落とす generic effect がある（`App.tsx:1166-1176`）。`isPanePreviewStatusCurrent` は `paneId + tabId + revision` と pane selection・global tab identity を照合する（`paneRuntime.ts:63-70`）ため、close / move による selection 変化は**この effect だけで自動的に閉じる**。

したがって §8.2 / §8.3-4 が App 側へ要求する「どの pane の status を clear するか」の明示比較は、判定条件が異なる 2 つ目の正本になる。結果が一致する限り実害は無いが、次の点で保守上の負債になる。

- close 側は「他 pane が同じ ID を表示していれば維持」という条件を App 側に**再実装**することになるが、これは `isPanePreviewStatusCurrent` の判定と同義である。条件が将来ずれると、片方だけが正しい状態になる。
- move 側の「selection が変わった pane だけ clear」も同様で、`isPaneResultCurrent` の否定と同義である。
- 現行 `closeTab` は closed tabId に一致する status を**両 pane 無条件で** clear している（`App.tsx:783-787`）。これは local close 導入後は誤りになるため削除が必要だが、§9.1 / §14 は「local close へ変更」としか書いておらず、この行の削除が明示されていない。

review checkpoint 2（不要な重複実装 / 責務分離）に該当する。

**推奨対応**: §8.2 / §8.3-4 / §9.1 へ「pane preview status の stale 判定の正本は `paneRuntime.ts` の `isPanePreviewStatusCurrent` を使う既存 effect とし、App の action handler では status を直接 clear しない」と一本化するのが望ましい。commit 前の 1 frame 分の残留表示を避けるために先行 clear が必要と判断する場合は、その理由と「generic effect が最終的な正本である」旨を §8.2 に明記した上で、条件を `isPanePreviewStatusCurrent` の否定として表現する（独自条件を書かない）。併せて、`App.tsx:783-787` の両 pane 無条件 clear を削除対象として §14 の `App.tsx` 行へ明記する。

### 2.2 split off 時に primary group が空だと、開いている文書が UI 上どこからも見えなくなる

**severity**: Medium（non-blocking）
**工程**: Phase 2（動作定義の追記）／ Phase 4-a（手動確認の追加）
**対応優先度**: 中

**ドキュメント記載**: §2.2-8「splitを無効にするとprimary groupだけを表示し、secondary groupはsession内で保持する。」§2.3「split offでsecondary tabをprimaryへコピー・移動しない。」§8.4。§12 error handling 表。§17-9。

**根拠 / 差異**: 互換性変更そのもの（暗黙の ownership 変更をしない）は §4.5 の不採用理由と一貫しており、TODO-2026-023 の完了条件にも「split off で引き継ぐこと」は含まれないため、判断としては妥当である。ただし次の状態が到達可能で、設計内に定義が無い。

到達経路: 初回 split on（§2.2-3 により secondary は空）→ secondary を active にして Explorer から document を開く（§2.2-4）→ primary には一度も tab を開いていない → split off。

結果として、primary group は空、secondary group には document が残る。`DocumentPane` は selected tab が無いと `No document selected` を表示し（`App.tsx:2383`）、StatusBar は `No file selected`（`App.tsx:2106`）、Explorer highlight も消える。single mode では secondary の TabStrip が描画されず（`App.tsx:1325`）、secondary group の tab を close する手段も move する手段（§7: `move-tab` は split 限定）も無い。**利用者から見ると「文書を開いていたはずなのに Viewer が空になり、原因も回復手段も画面に無い」状態**で、回復には split を再度有効化するしかない。

これは TODO-2026-006 設計レビュー指摘 1.1 が blocking として排除した失敗モード（「open tab が存在するのに single view が『No document selected』になる」）と外形が同じである。本設計ではデータが失われないため深刻度は下がるが、可視性が無い点は同じであり、§2.3 が「意図した UI 仕様変更」と述べるだけでは Phase 4-a で退行と区別できない。

**推奨対応**: 最小コストの選択肢を 1 つ選び §8.4 と §12 の表へ確定させる。

- (a) 推奨: primary の空表示メッセージを group 状態に応じて分岐させる（例: secondary group が非空なら `No document selected in this pane. N documents remain in the secondary pane.`）。`DocumentPane` の既存 `preview-empty` 文言を差し替えるだけで、新しい state も action も増えない。
- (b) `View > Split View` の menu item に、secondary group が非空の間だけ件数を併記する。
- (c) 上記を採らない場合でも、§12 の表へ「split off 時に primary group が空 | primary は未選択表示のまま。secondary group は保持され、split 再有効化で復帰する」を追加し、§17-9 の手動確認へ「primary が空のまま split off しても secondary group が失われず、再有効化で復帰すること」を明記する。

いずれの案でも §15 の `markdown-viewer-tauri/README.md` 行へ「split off 中は secondary group が非表示のまま保持される」旨の利用者向け説明を含めることを推奨する。

---

## 3. 改善提案（Low）

### 3.1 「非空 group は必ず非 null の active を持つ」という強い invariant が明示されておらず、TabStrip の旧 fallback が残る

**severity**: Low
**工程**: Phase 2（invariant 追記）／ Phase 3（該当分岐の削除）

**根拠 / 差異**: §6.2-2 は「`activeTabId`は`null`、または同じpaneの`orderedTabIds` member」と弱い形でしか書いていないが、§7 の各 action を通すと実際にはより強い性質が成立する。`open-tab` は必ず選択し、`move-tab` の destination も必ず選択し、`close-pane-tab` / `move-tab` の source fallback は group が空になる場合だけ `null` を返す。`reset-root` は両方を空にする。したがって **`orderedTabIds.length > 0` ⇒ `activeTabId !== null`** が全経路で成立する。

この性質を明示すると、現行 TabStrip の roving tabindex fallback `activeTabId === null && index === 0`（`App.tsx:2507`）が到達不能な分岐（= 旧経路）であることが確定し、削除できる。明示しないままだと、実装者が「group は非空だが未選択」という存在しない状態を想定した分岐を新 TabStrip へそのまま移植する。review checkpoint 5「要求されていない旧経路を残していないか」に該当する。

**推奨対応**: §6.2 へ invariant 8 として「`orderedTabIds` が非空の pane は必ず非 `null` の `activeTabId` を持つ」を追加し、§9.4 へ「この invariant により、TabStrip の `activeTabId === null` 時の先頭 tab roving fallback は不要になるため残さない」を 1 行加える。§16.1 の invariant test へも 1 項目追加する。

### 3.2 `open-tab` / `close-pane-tab` の single mode + secondary 指定の契約が `activate-pane` と非対称

**severity**: Low
**工程**: Phase 2（設計追記）

**根拠 / 差異**: §7 は `activate-pane` について「singleでsecondary指定はthrow」と明記し、`move-tab` も「split限定」と明記する一方、`open-tab` と `close-pane-tab` は paneId の妥当性条件を書いていない。`open-tab` は契約列に「pane activate」を含むため、single mode で secondary を渡すと invariant §6.2-7（single では `activePaneId` は必ず primary）と衝突する。現行 UI からは到達しない（single では secondary の `DocumentPane` を描画せず、Explorer は `splitViewState.activePaneId` を渡す）が、reducer は programming error を throw で顕在化する方針（§6.2 末尾）なので、契約表の側で対称に定義しておくべきである。

**推奨対応**: §7 の `open-tab` / `close-pane-tab` の契約列へ「single mode の secondary 指定は `activate-pane` と同じく throw」を追記し、§16.1 の invalid invariant test へ 1 項目加える。

### 3.3 group → data 解決 helper の signature と、throw の実行点が未確定

**severity**: Low
**工程**: Phase 2（設計追記）

**根拠 / 差異**: §9.2 は `splitView.ts` に「group ordered IDs から data を解決する helper」を置きつつ、同節で「React、DOM、Tauri、`OpenDocumentTab` の具体型へ依存しない」と要求している。両立には generic signature（例 `resolveGroupTabs<T extends { id: string }>(orderedTabIds: string[], tabs: T[]): T[]`）が必要だが、その旨が書かれていない。

より重要なのは throw の実行点である。§9.2 は「ID 不在を throw」、§9.3 は「`DocumentPane` は `PaneState.orderedTabIds` 順に自 pane の view を解決する」と書いており、素直に読むと **render path で throw する**設計になる。`tabs` と `splitViewState` は App の別々の `useState`（`App.tsx:153-154`）であり、invariant §6.2-4 / 5 は「App が同時更新する integration boundary で守る」（§6.2 末尾）とされている。React 19 の自動 batching により現行の全経路（`closeTab`、`loadRoot`、`openOrActivateTab`）は同一 commit へ入るため実際には破れないが、render path で throw する設計は、将来の非同期順序の綻びが「表示崩れ」ではなく「復帰不能な白画面」になることを意味する。silent filter を入れない方針（§4.5）は維持すべきだが、throw の位置は選べる。

**推奨対応**: §9.2 へ helper の generic signature を明記する。加えて §9.1 / §9.3 へ「pane ごとの tab view は App が `useMemo` で 1 箇所だけ解決し、`DocumentPane` へは解決済み view を渡す。ID 不在の throw はこの integration boundary で発生させ、`DocumentPane` / `TabStrip` の render 内では再解決しない」と確定させる。これにより throw 位置が 1 箇所に定まり、§9.3 の「global list から任意 ID を直接選ばない」という要求も構造的に担保される。

### 3.4 §8.3 の move 手順に image viewer の扱いが無い（§8.2 の close とは非対称）

**severity**: Low
**工程**: Phase 2（設計追記）

**根拠 / 差異**: §8.2 は close について「active image viewerのoriginが閉じたsource pane / tabなら既存identity effectで閉じる」と明記するが、§8.3 の move 6 手順と §12 の error handling 表には image viewer の記述が無い。実際には既存の identity effect（`App.tsx:1133-1148`）が `paneId` + `tabId` + `revision` + `visual.isConnected` を照合するため、(a) source pane で開いていた viewer は source の selection 変化により閉じ、(b) destination で selection が変わる場合も閉じ、(c) destination が既に同 tab を選択中で selection が変わらない場合は開いたままになる、という挙動になる。挙動自体は妥当だが、§8.2 が明記している以上 §8.3 にも同じ粒度の記述が要る。特に (c) は §8.3-4 の「destination が移動対象を既に選択中なら status と既存 DOM / iframe を維持する」と対になる境界条件である。

**推奨対応**: §8.3 へ手順 7 として上記 3 ケースを 1 文で追記し、§12 の表へ「move 時の image viewer | origin pane の selection が変わる場合だけ既存 identity effect で閉じる」を 1 行加える。§17-6 の手動確認へも「image viewer 表示中の move」を含める。

### 3.5 §8.5 Reload の対象記述が「両 pane 同時 reload」とも読める

**severity**: Low
**工程**: Phase 2（記述訂正）

**根拠 / 差異**: §8.5 は「**active primary / secondary**のselected global tabだけrevisionを増やす」と書いている。現行実装は active pane の selected tab 1 件だけを対象とし（`App.tsx:625-642` の `if (activeTab)`）、`docs/components/tauri_viewer/interface_spec.md:12` も「root treeと**active pane**のselected tabだけを再読み込みする」と確定済みである。§8.5 の文言は「active な primary または secondary の」という意図と読めるが、「primary と secondary の両方の」とも読め、後者で実装されると Reload の対象が 1 件から最大 2 件へ変わる仕様変更になる。直後の「同じIDが両groupでselectedなら両pane previewが同じnew revisionへ更新される」という文は前者の解釈と整合するため、単なる語順の問題と判断する。

**推奨対応**: §8.5 の当該文を「active pane（primary または secondary）の selected global tab だけ revision を増やす」へ訂正する。

### 3.6 split 時の tab item 幅（`min-width` / `32vw`）の見直し根拠が §11 / §18 に無い

**severity**: Low
**工程**: Phase 2（設計追記）

**根拠 / 差異**: §11 は「CSSはsingle時2列、split時3列を使い、既存tab width / horizontal overflow / focus-visible / loading / error表示を維持する」、§18 のリスク表は「inline buttonでtab幅が狭い | 30px control追加、既存horizontal overflow維持」とする。現行 `.tab-item` は `grid-template-columns: minmax(0, 1fr) 30px`、`width: min(220px, 32vw)`、`min-width: 130px`（`App.css:867-876`）である。split 時に 3 列化すると control が計 60px を占めるため、`min-width: 130px` の下限では document 名に 70px しか残らず、`.tab-name` の ellipsis が実質的に機能しなくなる。

さらに `32vw` は TODO-2026-021 で確定した **window viewport 基準**の契約であり（TODO-2026-006 設計レビュー指摘 3.4 で明文化済み）、pane 幅が半減しても tab 幅は縮まない。したがって split 時は tab あたりの必要幅が増え、pane 幅は減るため、TabStrip の horizontal overflow が single 時よりさらに早く発生する。これは意図した結果だが、`min-width` を据え置くのか split 時だけ引き上げるのかが未確定である。

**推奨対応**: §11 へ「split 時の `min-width` は 3 列分の実効値へ見直す（例: 160px）。`min(220px, 32vw)` は TODO-2026-021 の viewport 基準契約を維持し変更しない」を 1 行加え、§18 のリスク行の軽減策へ同内容を反映する。§17-12 の responsive width 確認へ「split 時に tab 名が ellipsis で判別可能であること」を含める。

### 3.7 ADR 非追加の再評価条件が書かれていない

**severity**: Low
**工程**: Phase 2（記述追記）

**根拠 / 差異**: §13 は「ADRは追加しない。本判断は現時点でTauri component固有であり、横断判断の起票条件を満たさない」とする。`docs/adr/README.md` §2 の起票条件 1（既に採用済み）は Phase 2 時点で未成立、条件 2（複数案件で再利用される可能性が高い）も現時点では Tauri 単独であるため、判断自体は妥当である（ADR 一覧も現在 seed 無しで空）。

ただし §13 自身が「TODO-2026-025 の上下 split は同じ primary / secondary group を再利用できる」と述べ、§19 が Avalonia（TODO-2026-011）への適用可能性に触れているため、条件 2 が成立する時期は具体的に予見できる。TODO-2026-006 の設計レビューでは「Avalonia 展開（TODO-2026-011）で横断判断が成立してから再評価する」という再評価条件が §17 末尾に置かれており、本設計はその運用を引き継いでいない。

**推奨対応**: §13 の ADR 行へ「TODO-2026-025 または TODO-2026-011 で同じ group model を採用した時点で起票条件 2 を再評価する」を追記する。

---

## 4. 受け入れ条件トレース確認

`docs/todo/todo.md` TODO-2026-023 の completion / success_metrics に対する設計側の対応状況。

| TODO-2026-023 完了条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| 各 pane の TabStrip にはその pane で開いた tab だけが表示され、他 pane の tab 追加・close で意図せず増減しない | §4.1、§6.1、§7 (`open-tab` / `close-pane-tab`)、§9.3、§9.4、§16.1 | ✓ 整合。ordered ID collection と local close で閉じている |
| tab activate / close、Reload、relative link、root 変更、split on / off で pane-local tab collection と active tab が一貫して復旧する | §7、§8.1-§8.6、§16.1 | △ 条件付き。selection と membership は閉じているが、`pendingNavigation` の遷移が未定義で invariant §6.2-3 が破れる（指摘 1.1）。§8.5 の Reload 対象記述も曖昧（指摘 3.5） |
| Markdown / HTML / Mermaid / PlantUML の非同期結果と loading / error 表示が pane 間で混線しない | §9.5、§10.1、§10.2、§16.2 | ✓ 整合。`paneRuntime.ts` の pane / tab / revision guard を変更せずに済む理由が正しい。ただし status clear の正本が二重化する（指摘 2.1） |
| 移動元は隣接 tab または未選択へ復旧し、移動先では対象 tab が選択される | §7 (`move-tab`)、§8.3、§12 | ✓ 整合。source 変更前順序を基準にした右→左→null fallback と destination dedupe が明示されている |
| keyboard だけでも移動操作へ到達でき、focus と accessible name / state が維持される | §4.4、§9.4、§11 | ✓ 整合。roving order、Tab 順への含め方、move 後 focus、accessible name の pane 名込み方針が揃っている |
| `npm test`、`npm run build`、`cargo check` が成功する | §16.3 | ✓ 整合。`docs/rules/development_workflow.md:156-164` の Tauri 検証コマンドと一致し、`cargo fmt --check` / `cargo test` / `git diff --check` を上乗せしている |
| frontend policy test で pane 別の追加・activate・close、同一 document の両 group 参照、pane 間移動、split off / on、root reset、stale async result 拒否を検証できる | §16.1、§16.2 | △ 条件付き。新規 test の網羅性は十分だが、既存 test の破壊範囲と書き換え方針が無い（指摘 1.2）。pending 関連 test も不足（指摘 1.1） |
| 手動確認で Explorer / relative link から active pane へ tab が追加され、左右の TabStrip が独立して増減・選択される | §17-1〜3 | ✓ 整合 |
| 手動確認で pointer / keyboard の双方から move でき、fallback、destination selection、focus、StatusBar / ErrorBanner routing が一致する | §17-6、§17-7 | ✓ 整合。image viewer だけ観点から漏れる（指摘 3.4） |
| 手動確認で同じ Markdown / HTML を両 pane に開き、Mermaid / PlantUML / HTML ready・timeout が混線しない | §17-4、§17-10、§17-11 | ✓ 整合 |
| 既存 single / split view と HTML security boundary の回帰が無い | §10.2、§13、§14（`src-tauri` 変更なし）、§17-12 | ✓ 整合。security 境界は `documentPolicy.ts` を正本に据え、group / active pane を許可条件へ持ち込まない方針が維持されている |
| 恒久ドキュメント同期 | §15 | ✗ 不足。矛盾する既存確定記述の置換対象が未特定で、Phase 4-a の手動確認基準 2 行が旧仕様のまま（指摘 1.3） |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| global document data + pane-local ordered ID references の採用判断（§4.1、§4.5） | ✓ 妥当。`OpenDocumentTab` は path 一意・`revision`・PlantUML 結果を保持する（`App.tsx:87-98`）ため pane 複製で正本が二重化する。単一 `paneId` 案・global filter 案の不採用理由も現行構造と一致する |
| group state を `splitView.ts` へ統合する判断（§4.2） | ✓ 妥当。ordered IDs / selection / move / close / split toggle は同じ invariant を共有するため分離すると二重管理になる。「別 `tabGroups.ts` を作らない」「module-global mutable state を持たない」「discriminated union reducer へ集約する」はいずれも既存 policy module 群（`explorerPane.ts` / `documentPolicy.ts` / `imageViewer.ts` / `paneRuntime.ts`）の配置原則と一貫する |
| local close + unreferenced eviction の順序（§4.3、§8.2、§9.1） | ✓ 妥当。「reducer 適用後の次 state の両 group 参照集合」で判定するため、source 除去と eviction の順序依存が閉じている。同 ID を両 group が参照する場合に global tab / revision / shared load state を維持する規則も、in-flight `loadTab` が `updateTabIfCurrent`（`App.tsx:409-417`）で正しく着地する構造と一致する |
| eviction 後の late async result（§8.2） | ✓ 妥当。`updateTabIfCurrent` は id + revision 一致の map であり、global tab 削除後は自動的に no-op になる。`nextTabIdRef`（`App.tsx:190`）が単調増加のため ID 再利用による誤着地も起きない |
| `move-tab` の atomic 契約（§7、§8.3、§12） | ✓ 妥当。source removal + fallback と destination dedupe add + select を 1 action で返す設計は、move 専用 React state を持つ案（§4.5）より正本が 1 つに保たれる。destination に同 ID が既にある場合に既存位置を維持する規則も、§10.2 の iframe key 安定性（`paneId + tabId + revision`）と整合する |
| `paneRuntime.ts` を変更しない判断（§9.5、§14） | ✓ 妥当。`isPaneSelectionCurrent`（`paneRuntime.ts:33-42`）は pane ごとの `activeTabId` 比較、`isTabRevisionCurrent`（同 44-50）は global identity 比較であり、membership の概念を必要としない。「`activeTabId` が membership invariant を満たすため global membership fallback は不要」という理由付けも正しい |
| split off 中の secondary result 拒否（§8.4、§16.2） | ✓ 妥当。`isPaneSelectionCurrent` が `paneId === "secondary" && mode !== "split"` で false を返す既存実装（`paneRuntime.ts:38-40`）により、group 保持と result 拒否は追加実装なしで両立する |
| Mermaid / PlantUML の扱い（§10.1） | ✓ 妥当。render ID を `paneId + tabId + revision + index` とする既存実装（`App.tsx:2225`）と queue の App instance 所有（`App.tsx:189`）を維持し、move を「DOM ownership 変更」として `isPaneResultCurrent` + `isConnected` で stale 化する説明は現行 effect の構造（`App.tsx:2228-2274`）と一致する。group 操作だけで PlantUML command を再実行しない点も正しい |
| trusted HTML の security 境界（§10.2） | ✓ 妥当。iframe key、source 照合、opaque origin、ready、activation、duplicate、scheme policy を維持し、active pane / group membership を許可条件へ加えない方針は TODO-2026-006 の確定判断（同設計レビュー指摘 3.2）を正しく引き継いでいる。sandbox / CSP / root boundary / capability を緩和する fallback を追加しない旨も明記されている |
| 互換性・単一路線（§13） | ✓ 妥当。`PaneState` だけを一括置換し、旧 global TabStrip 解釈や global close action を互換経路として残さない方針は checkpoint 5 と一致する。Rust command / `OpenDocumentTab` schema / settings JSON / protocol URL 不変も §14 と整合する |
| 非対象範囲（§3.2） | ✓ 妥当。drag and drop、reorder、pin、複数選択、3 pane 以上、永続化、上下 split、Avalonia、Rust / capability / CSP 変更の除外は `docs/todo/todo.md` の non_scope および TODO-2026-025 / TODO-2026-011 との分担と一致する |
| 検証コマンド（§16.3） | ✓ 妥当。`docs/rules/development_workflow.md:156-164` と一致。同 :225 のとおり Tauri frontend は lint script 未定義のため `npm run build` の TypeScript compile を完了条件に含める運用とも整合する |
| meta.md の整合 | ✓ 妥当。`components` 一覧は §14 の影響範囲表と一致し、`integrated_todo: TODO-2026-024` / `follow_up: TODO-2026-025` / `depends_on: TODO-2026-006` は `docs/todo/todo.md` の記述と一致する。Phase Status も現状（Phase 2 Draft prepared）と一致する |

---

## 6. 対応サマリ

| # | 指摘 | severity | blocking | 対応工程 |
| --- | --- | --- | --- | --- |
| 1.1 | `pendingNavigation` の遷移規則が未定義で invariant §6.2-3 が閉じない | Medium | **blocking** | Phase 2 |
| 1.2 | 公開 API・既存 test の契約破壊範囲が §14 / §16 に無い | Medium | **blocking** | Phase 2 |
| 1.3 | 恒久 docs の矛盾記述（置換対象）が §15 で特定されていない | Medium | **blocking** | Phase 2 → Phase 3 |
| 2.1 | pane runtime status clear が既存 generic effect と二重管理 | Medium | non-blocking | Phase 2 または Phase 3 |
| 2.2 | split off 時に primary group が空だと開いている文書が不可視になる | Medium | non-blocking | Phase 2 / Phase 4-a |
| 3.1 | 非空 group ⇒ 非 null active の invariant 未明示、TabStrip 旧 fallback が残る | Low | non-blocking | Phase 2 / Phase 3 |
| 3.2 | `open-tab` / `close-pane-tab` の single + secondary 契約が非対称 | Low | non-blocking | Phase 2 |
| 3.3 | group → data 解決 helper の signature と throw 実行点が未確定 | Low | non-blocking | Phase 2 |
| 3.4 | §8.3 move に image viewer の扱いが無い | Low | non-blocking | Phase 2 |
| 3.5 | §8.5 Reload の対象記述が曖昧 | Low | non-blocking | Phase 2 |
| 3.6 | split 時 tab item 幅（`min-width` / `32vw`）の見直し根拠が無い | Low | non-blocking | Phase 2 |
| 3.7 | ADR 非追加の再評価条件が未記載 | Low | non-blocking | Phase 2 |

Phase 3 着手条件: 1.1 / 1.2 / 1.3 を設計へ反映し、2.1 / 2.2 について採る方針を設計内で確定させること。3.1〜3.7 は Phase 2 での追記を推奨するが、Phase 3 実装時の反映でも差し支えない。

---

## 7. 初回指摘への対応（実装担当、follow-up review待ち）

`ai-review-response-workflow`に従い、blocking / non-blockingを含む全12件を設計へ反映した。対応commitはfollow-up promptで通知する。

| # | 対応 | status |
| --- | --- | --- |
| 1.1 | §7をpending navigation列付きaction表へ変更し、open / select / close / move / toggle / rootのclear・保持規則を確定。旧`remove-tab`の到達不能guard削除とpending invariant testを§14 / §16へ追加 | 対応済み・再確認待ち |
| 1.2 | §6.3で`createInitialSplitViewState()`引数廃止、§7 / §9.2でsplit payload削除とprivate adjacent helperを確定。§16.1に既存test 34 call siteの移行・置換方針と共通fixture helperを追加 | 対応済み・再確認待ち |
| 1.3 | §15を恒久docsの置換対象表へ変更し、`interface_spec.md`、`detail_design.md`、`development_workflow.md`、Tauri READMEの旧確定記述と節単位の置換方針を明記 | 対応済み・再確認待ち |
| 2.1 | §8.2 / §8.3 / §9.1で`isPanePreviewStatusCurrent` generic effectを唯一の正本とし、close / move / toggle handlerの直接clearと現行両pane無条件clearを削除する方針へ一本化 | 対応済み・再確認待ち |
| 2.2 | §8.4 / §12でprimary empty・secondary nonempty時にhidden件数と`Enable Split View`回復案内を表示する推奨案(a)を採用。§17-9へ手動確認追加 | 対応済み・再確認待ち |
| 3.1 | §6.2 invariant 8へ「nonempty group ⇒ active non-null」を追加。§9.4で旧roving fallback削除、§16.2でinvalid fixture testを追加 | 対応済み・再確認待ち |
| 3.2 | §7でsingle modeのsecondary open / select / close / activate / moveをthrowと対称定義し、§16.2へtest追加 | 対応済み・再確認待ち |
| 3.3 | §9.1 / §9.2へgeneric `resolveGroupTabs<T>` signatureとApp `useMemo` integration boundaryを確定。DocumentPane内の再解決を禁止 | 対応済み・再確認待ち |
| 3.4 | §8.3-7 / §12 / §17-6へmove時image viewerのidentity 3ケースを追加 | 対応済み・再確認待ち |
| 3.5 | §8.5を「active paneのselected global tab 1件」へ明確化 | 対応済み・再確認待ち |
| 3.6 | §11 / §17-12 / §18でsplit時minimum 160px、`min(220px, 32vw)` viewport基準維持、horizontal overflowを確定 | 対応済み・再確認待ち |
| 3.7 | §13へTODO-2026-025またはTODO-2026-011で同model採用時のADR再評価条件を追加 | 対応済み・再確認待ち |
