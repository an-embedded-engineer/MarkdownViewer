# TODO-2026-006 Tauri Split view 導入 設計レビュー

**レビュー日**: 2026-07-26
**再確認日**: 2026-07-26
**対象ドキュメント**: `docs/design_analysis/new_feature/20260726_tauri_split_view/design/tauri_split_view_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260726_tauri_split_view/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-006
**初回レビュー対象コミット**: `10948dc` (Phase 2 draft Tauri split view design)
**Round 1 fix コミット**: `dd0dead` (Phase 2 address Tauri split view design review)
**判定**: **承認 (Approved)**。Phase 3 進行可。初回検出の Medium 3 件 / Low 6 件は Round 1 fix (`dd0dead`) ですべて設計へ反映済みと再確認した。**未解決指摘 0 件**。

---

## 概要

TODO-2026-006 (Tauri Split view 導入) の Phase 2 設計レビュー。`OpenDocumentTab[]` を文書データの正本として維持し、表示選択だけを `SplitViewState`（mode / activePaneId / pane ごとの selection と pending navigation / requested ratio）へ置換する設計を、現行実ソース（`markdown-viewer-tauri/src/App.tsx`、`App.css`、`documentPolicy.ts`、`explorerPane.ts`、`imageViewer.ts`）、`docs/todo/todo.md` の受け入れ条件、`docs/rules/development_workflow.md` の手動確認 list、`docs/adr/README.md` の起票条件を根拠に検証した。

設計の骨格は初回レビュー時点から妥当である。global tab data と pane-local selection / runtime の分離、App 所有 Mermaid 直列 queue、iframe ごとの ready handshake、純粋 policy module への集約、Explorer 幅 policy との非共通化、旧 `activeTabId` / `pendingNavigation` を互換用に残さない単一路線化は、いずれも現行実装の制約と一致し、不採用案の理由も具体的である。security 面でも `sandbox="allow-scripts"` / CSP / custom protocol / root boundary を変更せず、active pane を security 条件にしないという判断は正しい。

初回レビューでは次の 3 点をブロッキング（Medium）として指摘した。

1. split off 時に active pane の selection が `null` だと primary の有効な selection が破棄され、tab が残っているのに single view が未選択になる（§8.2 の遷移規則の穴）。
2. `markHtmlReady` / `markHtmlError` を廃止して HTML tab の `loadState` を先行 `ready` にする一方、TabStrip の state label（現行 `tab.loadState` 由来）の導出元が未定義で、HTML の handshake 中 / timeout error 表示が退行する。
3. 本設計の最大リスク（Mermaid stale 適用、pane/tab/revision guard、HTML ready/timeout の pane 帰属）がすべて `App.tsx` の closure 内に置かれ、`splitView.test.ts` の検証対象外になっている。§20 リスク表が「pane guard test」を軽減策に挙げていることとも内部矛盾する。

Round 1 fix (`dd0dead`) では、(1) `disable-split` / §8.2 を条件付き引き継ぎ + 先頭 tab fallback へ確定、(2) §7.2 へ TabStrip の shared / pane-local 合成規則を追加、(3) `paneRuntime.ts` / `paneRuntime.test.ts` を新設して guard 判定と表示 state 合成を純粋 policy へ分離、という形で 3 件とも構造的に解決されている。Low 6 件（DOM ID 改名の波及先、transient activation の根拠記述、Mermaid 生成 id の一意性、viewport 基準 CSS との相互作用、境界条件 2 件、width policy の入力契約）も、それぞれ推奨対応と一致する形で §9.3 / §11 / §10.1 / §12.2 / §8.1 / §10.3 / §9.4 / §18.1 / §19 へ反映されている。

再確認の結果、対応による新たな齟齬・実装不能な契約・section 参照の破損は検出しなかった（§9.5 の新設に伴う既存 module 節の §9.6 への繰り下げも、design 内に旧番号への参照が残っていないことを確認済み）。

---

## 1. 齟齬・不整合

### 1.1 split off 時に active pane が未選択だと primary の有効な selection を失う

**severity**: Medium（ブロッキング）
**工程**: Phase 2（設計修正）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§7.3 / §8.2を更新し、active paneが未選択ならprimary既存selectionを維持し、primaryも未選択かつopen tabありの場合だけ先頭tabへfallbackする規則へ確定した。空pane / 空collectionはthrow対象外とし、ordered tab IDsを`disable-split` actionへ渡す。unit testと手動確認へactive secondary未選択ケースを追加した。

**ドキュメント記載**: §8.2「1. active paneのselectionとpending navigationをprimaryへ引き継ぐ。2. secondaryをclearする。3. mode=`single`、activePaneId=`primary`。」§7.3 `disable-split`「active paneのselectionをprimaryへ移し、active paneをprimaryにする。」§18.1 test「split off時にactive secondary selectionをprimaryへ引継ぐ。」

**根拠 / 差異**: 規則が無条件の代入であるため、active pane が secondary かつ `secondary.activeTabId === null` の状態で split off すると、primary が保持していた有効な tab ID が `null` で上書きされる。この状態は設計自身が到達可能と認めている。

- §8.1 split on: 「別tabがなければ`null`とする」ため、tab が 1 件だけの状態で split on すると secondary は `null` になる。
- §2.2 / §13: pointer down・focus・TabStrip 操作で pane は active になるため、空の secondary pane を click しただけで activePaneId は `secondary` になる。
- §8.6: 「最後のtab closeでは両paneを未選択にする」以外にも、Explorer で secondary へ open した後に当該 tab だけを close すれば secondary は `null`、primary は有効という組合せが成立する。

結果として、open tab が存在するのに single view が「No document selected」（`App.tsx:1129`）になる。これは `docs/todo/todo.md` TODO-2026-006 の完了条件「tab close、最後の tab close、root 変更、split off / on 後も各 pane が残存 tab または未選択状態へ**一貫して**復旧する」に対し、利用者操作（split を閉じる）だけで表示中文書を失う不自然な復旧になる。

なお §18.1 の test 項目も「active secondary selection を primary へ引継ぐ」ケースだけで、active pane 未選択ケースを列挙していないため、実装時に検出されない。

**推奨対応**: §7.3 `disable-split` と §8.2 を次のいずれかへ具体化する。(a) active pane の selection が非 `null` の時だけ primary へ引き継ぎ、`null` の場合は primary の既存 selection と pending navigation を維持する。(b) 引き継ぎ結果が `null` になり、かつ tab collection が空でない場合は、残存 tab（例: primary の旧 selection、なければ先頭 tab）へ fallback する。いずれを採るにせよ §8.2 の手順表と §18.1 の test 一覧へ「active pane 未選択で split off」ケースを追加し、§19-1 の手動確認へも 1 行追加する。

**確認 (`dd0dead`)**: 推奨対応 (a) と (b) を組み合わせた形で解決されている。

- §7.3 `disable-split` が「active paneが非`null`のtabを選択している場合だけそのselection / pending navigationをprimaryへ移す。active paneが未選択なら既存primary selectionを維持し、primaryも未選択でopen tabが残る場合だけ先頭tabへfallbackする」へ改訂された（推奨 (a)+(b)）。
- §8.2 が 5 手順へ再構成され、手順 2 に「active paneが未選択なら既存primary selection / pending navigationを維持する。primaryも未選択でopen tabが残る場合は先頭tabをprimaryへ選び、pending navigationは`null`とする」が入った。fallback 時に pending anchor を持ち越さない点まで明示されており、§8.5 の pending navigation 契約と矛盾しない。
- §7.3 末尾に「`disable-split`はfallback判定にopen順が必要なため、actionへcurrent ordered tab IDsを明示的に渡す。空paneや空tab collectionは正当なUI stateであり、programming errorとしてthrowしない」が追加され、純粋関数の入力契約と throw 対象の切り分けが確定した。§7.3 冒頭の「programming error は throw」と両立する。
- §18.1 に「active pane未選択時はprimary維持、両方未選択かつtabありでは先頭fallback」、§19-1 に「空secondaryをactiveにしてsplit offしてもprimary文書を失わないことも確認する」が追加され、自動 test と手動確認の双方へ追跡された。

代表経路を検算した。active=secondary(未選択) / primary=A → primary=A 維持（旧設計では A を喪失）。active=primary(未選択) / secondary=B / tabs=[B] → primary 未選択のまま tabs 非空のため先頭 tab B へ fallback し、single view が文書を表示する。tabs 空 → 両 pane 未選択のまま throw しない。いずれも TODO の「残存 tab または未選択状態へ一貫して復旧する」を満たす。

### 1.2 HTML tab の loadState 前倒しにより TabStrip の状態表示の導出元が失われる

**severity**: Medium（ブロッキング）
**工程**: Phase 2（設計修正）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§7.2 / §9.3 / §9.5 / §14を更新し、各TabStripがshared `loadState`と自paneの`PanePreviewStatus`だけを合成する優先規則を定義した。同一HTML tabの片pane timeoutは当該paneのTabStripだけ`Error`とし、合成policyを`paneRuntime.ts` / `paneRuntime.test.ts`へ置く。

**ドキュメント記載**: §11「`open_document`がvalidated `previewUrl`を返した時点でshared tabのdocument loadを`ready`にし、iframe mount後の`loading-html` / ready / timeoutはpane runtimeだけで管理する。旧`markHtmlReady` / `markHtmlError`によるglobal tab更新は削除する。」§5.3、§7.2、§9.3。

**根拠 / 差異**: 現行 TabStrip は tab 単位の `loadState` から状態表示を導出している。

- `App.tsx:1959-1966`: `stateLabel` を `tab.loadState` の `loading` / `rendering` / `error` から算出し、tab 名の右へ「Loading」「Rendering」「Error」を表示する。
- `App.tsx:1968`: `tab-${tab.loadState}` を class に付け、`App.css:809` の `.tab-item.tab-error` で error 配色を与える。
- 現行 HTML 経路は `App.tsx:506-515` で `loadState: "loading"` を維持し、`markHtmlReady`（`App.tsx:569`）/ `markHtmlError`（`App.tsx:577`）で `ready` / `error` へ遷移させている。

設計どおり global 更新を削除すると、HTML tab は `previewUrl` 受領時点で `ready` に固定される。その結果、(a) iframe handshake 中の「Loading」表示、(b) handshake timeout（`documentPolicy.ts:30` の 5 秒）や external open 失敗時の「Error」表示と error 配色が TabStrip から消える。§7.2 の loading / error 優先順位表は StatusBar / ErrorBanner の導出だけを定めており、TabStrip の state label をどこから導くかは §9.3（`paneId`、pane selection、preview ID を props で受ける）にも記述が無い。

さらに、tab は 1 つでも pane runtime は 2 つあり得るため、同一 HTML tab を両 pane で表示し片方だけ timeout した場合に「その TabStrip がどちらの runtime を表示するか」という規則が必要になる。設計は「Mermaid error も失敗した pane だけへ帰属させる」（§5.3）と述べているが、TabStrip 表示への写像は未定義である。

これは TODO-2026-006 完了条件「各 pane で … loading / error 表示が破綻せず、非同期結果が他 pane / tab へ混線しない」に直接対応する。

**推奨対応**: §9.3 と §7.2 へ「各 TabStrip の state label / state class は、shared tab の `loadState` と**自 pane の** `PanePreviewStatus` の合成で導出し、他 pane の runtime は参照しない」旨と合成規則（例: shared `loading` / `rendering` / `error` を優先し、shared が `ready` の場合に自 pane の `loading-html` / `rendering-mermaid` / `error` を反映、当該 pane が非選択の tab では shared 値のみ）を追記する。§14 の error handling 表にも「HTML handshake timeout」行が TabStrip 表示へどう出るかを 1 行加えると Phase 4 の期待値が確定する。

**確認 (`dd0dead`)**: 推奨した合成規則がそのまま 3 段の優先順位として明文化されている。

- §7.2 へ「各paneのTabStripに表示するstate label / classも同じ合成規則を使う」として、(1) shared tab が `loading` / `rendering` / `error` なら shared を優先、(2) shared が `ready` かつ当該 tab がその pane で選択中で `PanePreviewStatus` の tab / revision が一致する場合だけ `loading-html`→`loading` / `rendering-mermaid`→`rendering` / pane runtime `error`→`error` を表示、(3) 非選択 tab または runtime identity 不一致なら shared のみ、が追加された。結語として「同じHTML tabを両paneへ表示して片方だけtimeoutした場合、timeoutしたpaneのTabStripだけが`Error`となり、他方paneのTabStripは自身のruntimeを表示する」と、指摘した写像の曖昧さが解消されている。
- §9.3 の props 契約が「`paneId`、pane selection、preview ID、**自paneの`PanePreviewStatus`**」へ更新され、他 pane の runtime を渡さない構造が props レベルで担保された。§5.3 の pane 分離の意図と一致する。
- §14 の「HTML handshake timeout」行が「発生iframe/paneだけerror。**自paneのTabStripを`Error`表示し、他paneへ混線させない**。sandboxを緩和するfallbackなし」へ更新され、Phase 4 の期待値が確定した。
- 合成 policy の置き場が §9.5 `paneRuntime.ts` の `resolvePaneTabPresentationState` として定義され、§18.1 に「shared loading / rendering / error優先と、selected tabだけのloading-html / rendering-mermaid / error合成」test が追加された。

現行実装との接続も確認した。tab 生成時の初期 `loadState: "loading"`（`App.tsx:482-493`）は規則 (1) で shared 優先となるため、`open_document` in-flight → previewUrl 受領 → iframe handshake の間、TabStrip の「Loading」表示は途切れない。external open 失敗（現行 `App.tsx:585-591`）も pane runtime error 経由で規則 (2) に載る。

### 1.3 pane runtime の stale guard が pure policy の外に置かれ、テスト対象から外れている

**severity**: Medium（ブロッキング）
**工程**: Phase 2（設計修正。テスト設計と責務配置）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: pane runtime guardを`paneRuntime.ts`のpure function `isPaneResultCurrent`へ分離し、TabStrip state合成とstale status判定も同moduleへ集約する設計へ変更した。§9.5と§18.1へ、pane/tab/revision一致、pane/tab切替、Reload、close、split off、同一tab両paneの自動testを追加した。DOM `isConnected`確認だけをReact effect側へ残す。

**ドキュメント記載**: §5.4「実行前後に DOM connection と pane/tab/revision を再確認し、stale task は結果を適用しない。」§7.2「callback適用時は `paneId + tabId + revision` と現在selectionを照合する。」§10.1-4、§11、§14「closed / reloadedタブのasync完了 | pane + tab + revision guardでignore」。§9.4「`splitView.ts` は split state transition、adjacent tab選択、width policy、keyboard policy」。§18.1 の test 一覧。§20 リスク表「close / root / Reloadのstate race | 軽減策: pure transition、tab revision、**pane guard test**」。

**根拠 / 差異**: §9.4 が `splitView.ts` の責務を layout / selection / width に限定しているため、§5.4・§7.2・§10.1・§11・§14 が繰り返し要求する「pane + tab + revision + DOM connection の照合」は、すべて `App.tsx` 内の effect closure（現行 `App.tsx:929-947` の Mermaid guard、`App.tsx:2170-2224` の HtmlPreview closure に相当する位置）に閉じ込められる。`splitView.test.ts` の検証項目（§18.1）にも guard 判定の単体テストは無く、「invalid / stale actionのthrowまたはignore契約」は `consume-navigation` 等の action level に留まる。

その結果、§20 リスク表が最上位に挙げる 3 リスク（Mermaid global state 競合、close / root / Reload の state race、duplicate HTML 表示の handshake 混線）の軽減策が実質的に §19 の手動確認だけになる。リスク表の「pane guard test」という記述と §18.1 の内容が一致しておらず、設計内部でも不整合である。現行の Vitest 構成は DOM を持たない純粋 policy テスト（`explorerPane.test.ts`、`documentPolicy.test.ts`、`imageViewer.test.ts`）であり、React DOM lifecycle をそのまま検証する手段が無い以上、guard の**判定式だけ**を純粋関数へ出す以外に自動検証の余地が無い。

**推奨対応**: guard 判定を pure function として切り出し、§9.4 の責務と §18.1 の test 一覧へ追加する。例として `isPaneResultCurrent(captured: { paneId; tabId; revision }, state: SplitViewState, tabs: Pick<OpenDocumentTab, "id" | "revision">[]): boolean` と、`PanePreviewStatus` の遷移（stale clear、phase 昇格、error 帰属）を返す純粋関数を `splitView.ts`（または `paneRuntime.ts`）へ置き、App 側 effect はその戻り値に従うだけにする。テストは「pane 切替後 / tab 切替後 / revision 更新後 / tab close 後 / split off 後に captured task が拒否される」「同一 tab を両 pane で表示した時に他 pane の結果を取り込まない」を最低限含める。DOM connection 判定だけは App 側に残す旨を §9.2 へ明記する。

**確認 (`dd0dead`)**: 推奨した責務分離が module 単位で実現されている。

- §9.5 として `paneRuntime.ts` が新設され、`isPaneResultCurrent({ paneId, tabId, revision }, splitViewState, tabIdentities)`、`resolvePaneTabPresentationState(...)`、stale pane preview status の identity 判定の 3 責務が定義された。推奨した signature と同型である。
- 同節末尾に「App / DocumentPaneは上記戻り値に従い、DOM nodeの`isConnected`確認だけをeffect側に残す」と明記され、React 側へ残す判断の境界が確定した（推奨では §9.2 への記載としたが、module 契約と同じ節に置かれており可読性はむしろ高い）。
- §5.5 の見出しが「専用 `splitView.ts` / `paneRuntime.ts` の純粋 policy」へ改題され、「layout transitionとpreview runtimeを別moduleに分け、`App.tsx`のeffect closureへ重要なguard式を埋め込まない」「`paneRuntime.ts`もReact、DOM、Tauri、Mermaidへ依存しない」という採用理由と依存制約が追加された。既存の純粋 policy module（`explorerPane.ts` / `documentPolicy.ts` / `imageViewer.ts`）の配置原則と一貫する。
- §18.1 に `paneRuntime.test.ts` の 4 項目（pane 切替 / tab 切替 / revision 更新 / tab close / split off 後の captured result 拒否、一致時だけ受理、同一 tab 両 pane で片 pane の runtime error を他 pane へ合成しない、shared / pane-local 合成）が追加され、§20 リスク表の「pane guard test」が実体を伴う軽減策になった。設計内部の不整合も解消している。
- §16 影響範囲へ `paneRuntime.ts` / `paneRuntime.test.ts` の 2 行が追加され、Phase 3 の成果物として追跡可能になった。

§9.5 の新設に伴い旧 §9.5「既存module」は §9.6 へ繰り下がったが、design 内に旧番号を参照する記述は残っていないことを確認した。

---

## 2. ドキュメント不足

恒久ドキュメント更新予定先（§17）そのものに欠落は無い。`README.md` / `markdown-viewer-tauri/README.md` / `docs/rules/project_overview.md` / `docs/architecture/*` / `docs/components/tauri_viewer/*` / `docs/rules/development_workflow.md` はいずれも実在し、split view の利用方法・状態・制約・手動確認を配置する先として妥当である。ADR 非追加の判断も `docs/adr/README.md` §2 の起票条件（2. 複数案件で再利用される可能性が高い）に照らし、Avalonia 展開（TODO-2026-011）で横断判断が成立してから再評価するという §17 末尾の記述と整合する。

初回レビューで指摘した「既に確定済みの近接契約との整合先が欠けている」点（指摘 3.4）は、Round 1 fix (`dd0dead`) で §17 の `development_workflow.md` 行へ「TODO-2026-021で確定したpane相対本文幅 / viewport基準gutterの既存項目と整合させる」が追記され、`common_pitfalls.md` 行も「複数pane Mermaid並行実行と生成ID、HTML handshake、pane-scoped DOM ID、iframe上separator drag」へ更新されて解消した。**未解決のドキュメント不足は無い。**

---

## 3. 改善提案

### 3.1 DOM ID の pane scope 化に伴う既存 IDREF の追随先が未整理

**severity**: Low
**工程**: Phase 2（設計追記）または Phase 3（実装時に反映）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§9.3へDocumentPane region / tabpanel / tabのpane-scoped IDを定義した。split separatorは両DocumentPane region、Explorer separatorは`explorer-pane preview-workspace`を参照し、single modeもprimary prefixへ統一する。

**ドキュメント記載**: §6 表「TabStrip ID | `tab-<id>` / `document-preview` | pane prefix付きで一意」。§9.3「tab: `tab-${paneId}-${tab.id}`、preview: `document-preview-${paneId}`」。§12.1 DOM 図。§13「separatorは`role="separator"`、`aria-orientation="vertical"`、両pane IDの`aria-controls`、min/max/nowを持つ」。

**根拠 / 差異**: 3 点が未解決のまま残る。

- `App.tsx:1075` の Explorer separator は `aria-controls="explorer-pane document-preview"` を持つ。`document-preview` が `document-preview-primary` / `-secondary` へ改名されると、この IDREF は dangling になる。設計 §12.1 の DOM 図には ExplorerSeparator が含まれるが、この参照先の変更に言及が無い（例えば `preview-workspace` へ id を与えて参照するのが自然）。
- §13 が split separator へ要求する「両pane IDの`aria-controls`」に対応する id が定義されていない。§9.3 が定義するのは preview（tabpanel）の id だけで、§12.1 の `role="region"` な DocumentPane 要素には id が振られていない。separator が tabpanel を指すのか region を指すのかで支援技術への意味が変わる。
- single mode でも同じ DocumentPane 経路を通す（§15）ため、single 表示時の id も `tab-primary-<id>` / `document-preview-primary` になるはずだが、明記が無い。既存の手動確認・将来の docs 記述と食い違わないよう確定させたい。

**推奨対応**: §9.3 へ (a) DocumentPane region の id（例: `document-pane-${paneId}`）、(b) split separator の `aria-controls` が参照する id、(c) Explorer separator の `aria-controls` の新しい参照先、(d) single mode でも primary prefix を使う旨、の 4 点を明記する。

**確認 (`dd0dead`)**: 推奨した 4 点がすべて §9.3 へ明記された。

- ID 一覧が「tab: `tab-${paneId}-${tab.id}`」「DocumentPane region: `document-pane-${paneId}`」「tabpanel preview: `document-preview-${paneId}`」の 3 層へ整理された（推奨 (a)）。
- 「split separatorの`aria-controls`は`document-pane-primary document-pane-secondary`」と確定し、separator が region を指すことが明示された（推奨 (b)）。§13 の「両pane IDの`aria-controls`」と対応が付いた。
- 「Explorer separatorの`aria-controls`は`explorer-pane preview-workspace`とし、PreviewWorkspaceへ固定ID `preview-workspace`を付ける」により、`App.tsx:1075` の dangling IDREF が解消される（推奨 (c)）。参照先を個別 pane ではなく preview workspace 全体としたのは、Explorer separator が preview 領域全体の幅を変えるという意味論と一致し妥当である。
- 「single modeでもprimary prefixを使い、旧`document-preview` IDは残さない」により、§15 の単一路線化と ID 契約が一致した（推奨 (d)）。
- 併せて「各tabの`aria-controls`は同paneのtabpanel previewを指す」が加わり、現行 `aria-controls="document-preview"`（`App.tsx:1982`）の pane 化先も確定した。

### 3.2 §11 の transient activation 根拠が実際の API 粒度と一致していない

**severity**: Low
**工程**: Phase 2（設計の根拠記述訂正）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§11を親Viewer document全体の`navigator.userActivation`契約へ訂正し、pane区別は`event.source + tab + revision`で行うことを明記した。duplicate guardはpane/iframe instance単位とし、1 clickは同paneで1回、両paneで別々にclickした場合は各paneで1回と定義した。

**ドキュメント記載**: §11「非active paneからのuser clickも、**そのiframe自身にtransient activationがあり**source検証を通るため許可する。active paneはpointer/focus captureで同時に更新されるが、security境界には使わない。」「各HtmlPreviewは固有iframe ref、ready flag、timeout、duplicate external-open guardを持つ。」

**根拠 / 差異**: 現行の activation 判定は `navigator.userActivation?.isActive === true`（`App.tsx:2202`）であり、これは親 document（Viewer 本体）の transient activation を返す。どの iframe 由来の操作かは区別しない。したがって「そのiframe自身にtransient activationがある」という根拠は API 粒度と一致していない。実際の許可条件は「Viewer document 全体に transient activation が生きている間」であり、pane 数とは無関係である。

security 境界そのものは弱まらない（`event.source` の一致・`origin === "null"`・tab / revision 一致・ready 済み・scheme allowlist が主境界であり、`documentPolicy.ts:78-109` の判定順は不変）。ただし根拠が誤ったまま実装へ渡ると、「pane ごとの activation 判定」を実装しようとして存在しない API を探す、あるいは逆に active pane 条件を security 判定へ混入させるといった誤りを誘発しうる。

併せて、duplicate external-open guard が `HtmlPreview` instance local（現行 `App.tsx:2172` の `lastExternalOpen`）である帰結として、同一 HTML tab を両 pane に表示した場合、同一 href が pane ごとに 1 回ずつ = 最大 2 回 OS ブラウザで開かれうる。これは設計の意図（pane runtime 分離）とは整合するが、利用者から見た「1 click で 1 回開く」という既存の手動確認項目（`docs/rules/development_workflow.md`「user-clicked `http(s)`だけがOS既定browserで1回開くこと」）とは意味が変わるため、明示が要る。

**推奨対応**: §11 の該当文を「transient activation は Viewer document 全体の状態であり pane / iframe を区別しない。したがって active pane 条件を security 判定へ持ち込む必要も余地も無く、pane 間の区別は `event.source` と tab / revision 一致で行う」旨へ訂正する。duplicate guard の粒度が pane 単位である帰結（同一文書を 2 pane 表示した場合の external open は pane ごとに 1 回）も §11 か §14 に 1 行加える。

**確認 (`dd0dead`)**: 誤った根拠が削除され、推奨とほぼ同文へ訂正された。

- 旧文「そのiframe自身にtransient activationがあり」が「transient activationは親Viewer document全体の`navigator.userActivation`状態であり、pane / iframeごとには区別できない。pane間の区別は`event.source`とselected tab / revision一致で行い、active pane条件をsecurity判定へ追加しない。非active pane由来のuser clickも既存policyをすべて通る場合だけ許可する」へ置換された。`App.tsx:2202` の実装粒度と一致する。
- duplicate guard の帰結が「duplicate external-open guardはHtmlPreview instance、すなわちpane単位とする。1 clickのmessage重複は同paneで1回に抑止し、同じ文書の同じhrefを利用者が両paneで別々にclickした場合は各paneで1回ずつopenできる」として明文化された。`docs/rules/development_workflow.md` の「1 click で 1 回開く」という既存手動確認項目と矛盾しない粒度（click 単位 = 1 回）に整理されている。
- `documentPolicy.ts` の判定順・context 項目は変更されておらず、security 境界が弱まらないという初回レビューの評価は維持される。

### 3.3 Mermaid 生成 id の document 内一意性が 2 pane 同時描画で検証されていない

**severity**: Low
**工程**: Phase 2（設計追記）／ Phase 4（手動確認の具体化）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§10.1へ同一Mermaid tabの2 pane表示でもgenerated IDがdocument内一意である要件と`deterministicIds`非採用を追記した。§17 / §19ではcommon pitfalls反映と、両SVGのmarker / clipPath / 配色 / themeを確認する手動scenarioを具体化した。

**ドキュメント記載**: §5.4、§10.1、§17「`docs/architecture/common_pitfalls.md`: 複数pane Mermaid並行実行、HTML handshake、**duplicate DOM ID**、iframe上separator drag」。§19-5「`sample_docs/plantuml.md` 等を使い、Mermaid + PlantUMLを両paneで表示し …」。

**根拠 / 差異**: §17 の duplicate DOM ID は TabStrip / preview の id を指しており、Mermaid が生成する id には触れていない。`markdown-viewer-tauri/package.json:18` の `mermaid ^11.15.0` は `run()` 内で各 node へ生成 id を割り当て、SVG 内の `marker` / `clipPath` / `<style>` セレクタがその id を参照する。split で**同一 Mermaid 文書を両 pane に表示**すると、同一 HTML document 内に同型の SVG が 2 組並ぶため、id が衝突した場合に `url(#…)` 参照や style が先に出現した要素へ解決され、片方の pane で矢印マーカーや配色が崩れる可能性がある。App 所有の直列 queue は競合実行を防ぐが、id の一意性を保証するものではない。

§19-5 の手動確認は「Mermaid + PlantUML を両 pane で表示」であり、Mermaid を片方、PlantUML を片方でも成立する読み方ができるため、この条件を確実には踏まない。

**推奨対応**: §10.1 へ「同一 tab を両 pane で描画した場合も、Mermaid 生成 id は document 内で一意でなければならない（`deterministicIds` は有効化しない）」旨を明記し、§19-5 を「**同一の** Mermaid 文書を両 pane に表示し、両方の SVG で marker / 配色 / theme が独立して正しく描画されることを確認する」へ具体化する。§17 の `common_pitfalls.md` 反映内容にも Mermaid 生成 id の項を含める。

**確認 (`dd0dead`)**: 要件・手動確認・恒久 docs の 3 箇所へ反映された。

- §10.1 末尾へ「同一Mermaid tabを両paneで描画した場合も、生成されるSVGのmarker / clipPath / style用IDは同一HTML document内で一意でなければならない。`deterministicIds`は有効化せず、直列queueでMermaidの既存ID採番を共有する。Phase 4では両paneの生成SVG内IDと`url(#...)`参照が衝突せず、marker / 配色 / themeが独立して正しく描画されることを確認する」が追加され、要件と検証時期が確定した。
- §19-5 が「同一のMermaid文書を両paneへ表示し、両SVGのgenerated ID / marker / clipPath / 配色 / themeが独立して正しく描画されることを確認する」へ書き換えられ、指摘した「片方 Mermaid・片方 PlantUML でも成立する」曖昧さが解消された。Mermaid + PlantUML 組合せの既存確認（source 復帰なし / PlantUML 再実行なし）も同項に残っている。
- §17 の `common_pitfalls.md` 行が「複数pane Mermaid並行実行と生成ID、HTML handshake、pane-scoped DOM ID、iframe上separator drag」へ更新され、恒久 docs 側の記載対象にも入った。

### 3.4 viewport 基準の既存 CSS と pane 相対 layout の相互作用が未記述

**severity**: Low
**工程**: Phase 2（設計追記）／ Phase 3（恒久ドキュメント反映）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§12.2へMarkdown本文幅はpane content box相対、gutter breakpointとtab `32vw`はwindow viewport基準の既存契約を維持すると明記した。§17 / §19へTODO-2026-021とのdocs整合と、viewport 760px超でpaneだけを狭める確認を追加した。

**ドキュメント記載**: §12.2 幅 policy、§16「`App.css` | preview grid、pane、active state、separator、狭幅、cursor」、§19-9 狭幅確認。

**根拠 / 差異**: TODO-2026-021（`docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/`）で、Markdown 本文幅は preview pane content box 基準、左右 gutter の 24px→14px 切替は **window viewport 基準**の `@media (max-width: 760px)`（`App.css:1080-1087`）であり「split view で個別 pane だけが狭くなっても gutter は切り替えない」ことが確定済みで、`docs/rules/development_workflow.md` の手動確認 list にも反映されている。本設計はこの近接契約に触れていないため、次が未確定のまま残る。

- split の各 pane で `.markdown-body`（`App.css:885`）の `calc(100% - 48px)` が pane content box に追従すること（追従自体は成立する）と、gutter breakpoint は viewport 基準のままであること。
- `.tab-item { width: min(220px, 32vw) }`（`App.css:796`）の `32vw` も viewport 基準であるため、pane 幅が半減しても tab 幅は縮まず、pane ごとの TabStrip の水平 overflow が single 時より早く発生する。§20 のリスク表「各paneに全tab表示して狭い | horizontal overflow維持」は結論としては同じだが、幅の基準が viewport であるという理由は書かれていない。

いずれも既存挙動であり本変更が壊すものではないが、§17 の恒久ドキュメント更新（`detail_design.md` / `development_workflow.md`）で TODO-2026-021 が確定させた記述と衝突しないよう、設計段階で立場を明示しておくのが望ましい。

**推奨対応**: §12.2 へ「各 pane の Markdown 本文幅は pane content box 相対で追従するが、gutter breakpoint と tab 幅（`32vw`）は window viewport 基準の既存契約を変更しない」と 1 段落追記し、§19 の手動確認へ「viewport 760px 超のまま split で pane を狭めても gutter は 24px のまま」を追加する。§17 の更新先に、TODO-2026-021 で追記済みの `development_workflow.md` 手動確認項目との整合維持を明記する。

**確認 (`dd0dead`)**: 推奨 3 点がそのまま反映された。

- §12.2 へ「各paneのMarkdown本文幅はpane content box相対の`calc(100% - 48px)`へ追従する。一方、24pxから14pxへのgutter切替は既存どおりwindow viewportの`@media (max-width: 760px)`基準とし、viewportが760px超のままsplitで個別paneだけが狭くなっても24px gutterを維持する。tab itemの`min(220px, 32vw)`もwindow viewport基準の既存契約を維持するため、狭いpaneではTabStripのhorizontal overflowがsingleより早く発生する」が追加され、TODO-2026-021 の確定契約と同じ立場が明示された。
- 直後の overflow 文が「各pane内のTabStrip / table / code / diagram / iframeへ閉じ込め」へ更新され、TabStrip の overflow も pane 内に閉じることが明記された。§20 リスク表の「horizontal overflow維持」と整合する。
- §19-9 へ「viewport 760px超のままsplitでpaneだけを狭めてもMarkdown gutterは24pxのまま、TabStripはpane内horizontal overflowになることを確認する」が追加され、`development_workflow.md` の既存項目（viewport 760px 超の Explorer resize で gutter 24px 維持）と同じ観点が split でも確認される。
- §17 の `development_workflow.md` 行に整合維持の注記が入り、Phase 3 で恒久 docs を更新する際の衝突が防止される。

### 3.5 境界条件 2 件が未定義（split on 時の primary 未選択 / pane unmount 時の image viewer）

**severity**: Low
**工程**: Phase 2（設計追記）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§8.1でprimary未選択時はsecondaryも`null`としthrowしない規則を定義した。§10.3でsplit off / pane unmount / pane未選択 / visual切断時にimage viewerを閉じ、focus originが切断済みならprimary regionへfallbackする規則を追加し、unit / manual観点へ反映した。

**ドキュメント記載**: §8.1「primaryのtabに隣接するopen tabから異なるIDをsecondary初期値として選ぶ。右隣、なければ左隣、なければ`null`。」§8.2 split off 手順。§10.3「別paneのactivateだけでviewerを閉じる必要はないが、発生元paneのtab/revisionが変わった場合は閉じる。」§20「focus復帰先unmount | connected確認後fallback pane region」。

**根拠 / 差異**:

- **(a) split on で primary selection が `null`**: 「primary の tab に隣接する」規則は primary が未選択の場合に定義されない。§8.6 で最後の tab を close すると両 pane 未選択のまま split mode が維持されるため、その後 split off → split on という経路や、tabs が空でない状態で primary だけ未選択という組合せ（指摘 1.1 の修正方針によっては新たに到達可能になる）で挙動が未定義になる。`splitView.ts` は「programming error は throw」（§7.3）という契約なので、未定義のまま実装すると throw と `null` 返却のどちらが正しいか実装者が判断できない。
- **(b) pane unmount 時の image viewer**: §10.3 は tab / revision 変化での close を定めるが、image viewer を開いたまま split off した場合（発生元が secondary なら DocumentPane と preview DOM ごと消える）、および発生元 pane が空になった場合の viewer の開閉が未定義。§20 の focus 復帰 fallback は「閉じた後にどこへ focus を返すか」であり、「閉じるべきか」を決めていない。現行実装は `imageViewerRequest.visual.isConnected` を mount 時に確認する（`App.tsx:1193`）が、表示中の DOM 切断は検知しない。

**推奨対応**: §8.1 へ「primary が未選択の場合 secondary も `null` とする（tab collection が空でない場合も同様）」など明示規則を 1 行追加する。§10.3 へ「split off・pane unmount・発生元 pane の未選択化のいずれでも、発生元 pane の image viewer は閉じ、focus は §20 の fallback 規則へ従う」を追記し、§18.1 か §19-8 の確認観点にも加える。

**確認 (`dd0dead`)**: (a) (b) とも推奨どおり明文化された。

- (a) §8.1 へ「primaryが未選択の場合は、open tabが残っていてもsecondary初期値を`null`とする。未選択は正当なempty stateとして扱い、隣接tab探索をthrowさせない」が追加された。§7.3 末尾の「空paneや空tab collectionは正当なUI stateであり、programming errorとしてthrowしない」と併せ、throw / `null` の判断基準が一意に決まる。§18.1 の split on test にも「primary未選択時はsecondaryも`null`」が追加された。
- (b) §10.3 へ「split off、pane unmount、発生元paneの未選択化、発生元visualのDOM切断時もviewerを閉じる。focusOriginが接続済みならそこへ戻し、接続されていなければ生存するprimary pane regionへfallbackする」が追加され、「閉じるべきか」と「どこへ focus を返すか」の両方が確定した。`imageViewer.ts` 側の契約は変更されず、判定は App 側に閉じるため §9.6 の「imageViewer.ts 原則変更なし」とも矛盾しない。
- §19-8 へ「secondary viewer表示中のsplit off / tab closeではviewerが閉じ、primary regionへ安全にfocus fallbackすることも確認する」が追加され、手動確認へ追跡された。

### 3.6 width policy の入力契約（未計測・非正値・ratio 書き戻し条件）が未確定

**severity**: Low
**工程**: Phase 2（設計追記）
**status**: 解決済み（2026-07-26 再確認、commit `dd0dead`）

**対応**: 設計§9.4へ`workspaceWidth: number | null`を受け、未計測・非finite・separator幅以下では`null`を返して50/50 CSS fallbackを使う関数契約を追加した。自動clampはratioへ書き戻さず、明示操作は可動域がある場合だけ更新、min=max時はno-opとし、§18.1へ境界testを追加した。

**ドキュメント記載**: §12.2「effective minimumは `min(240, floor((workspaceWidth - 6) / 2))`」「primary実幅boundsは `[effectiveMinimum, workspaceWidth - 6 - effectiveMinimum]`」「requested ratioは実幅clampとは別に保持し、狭幅で一時clampされても再拡大時に利用者のratioへ戻す」。§7.1「requested ratioはsession中の利用者指定を保持し、実幅clamp値をstateへ書き戻さない。」§7.3 `set-requested-ratio`「finiteかつ0より大きく1より小さいratioだけを保存する」。§14「split width計測前 | 50/50 CSS fallback」。

**根拠 / 差異**: 数式そのものは成立する（`W-6 ≥ 480` で min=240, max=W-246 ≥ min。`0 < W-6 < 480` で min=floor((W-6)/2) ≤ max=ceil((W-6)/2)）。未確定なのは入力契約である。

- `workspaceWidth` が未計測（`null`）または非正の場合の関数契約が §9.4 / §7.3 に無い。既存 Explorer policy は `number | null` を受け、非有限・0 以下を hard bounds へ落とす（`explorerPane.ts:13-25`）。また App 側は `width > 0` の場合だけ state へ反映する（`App.tsx:700-702`）。split policy を「非正値は throw」とするか「Explorer と同じく `null` 許容」とするかで、§14 の「計測前は CSS fallback」の実装形が変わる。`W ≤ 6` では `floor((W-6)/2) ≤ 0` となり負の幅を返すため、明示が無いと不具合を生む。
- 狭幅時に Home / End / pointer drag が requested ratio を上書きするかが未定義。§7.1 は「clamp 値を書き戻さない」、§12.2 は「Home / End は dynamic min / max」と述べており、狭幅で End を押した場合に requested ratio が clamp 由来の値で上書きされて「再拡大時に利用者の ratio へ戻る」性質が失われるかどうかが読み取れない。

**推奨対応**: §9.4 へ width policy 関数の signature（`workspaceWidth: number | null` を受ける／非正値の扱い）を明記し、§7.1 へ「自動 clamp は書き戻さないが、利用者の明示的 separator 操作（pointer / keyboard）は requested ratio を更新する」（または逆）を 1 文で確定させる。§18.1 の「通常幅と狭幅のdynamic bounds、requested ratio復元」test へ、未計測・極小幅・狭幅での明示操作後の再拡大を含める。

**確認 (`dd0dead`)**: 関数契約・書き戻し条件・境界 test の 3 点が確定した。

- §9.4 へ公開契約が追加された。`getSplitPaneWidthBounds(workspaceWidth: number | null): SplitPaneWidthBounds | null` は「未計測、非finite、separator幅以下は`null`を返し、Appは50/50 CSS fallbackを使う。外部layout計測の未確定値をprogramming errorとしてthrowしない」、`getPrimaryPaneWidth(requestedRatio, workspaceWidth)` は「boundsがある場合だけclamp済みpxを返す」。指摘した `W ≤ 6` の負値問題は「separator幅以下は`null`」で閉じている。§14 の「計測前は 50/50 CSS fallback」とも一致し、§7.3 の throw 契約とも棲み分けが付いた。
- 書き戻し条件が「自動clampはrequested ratioへ書き戻さない。pointer / keyboardによる利用者の明示操作は通常boundsに幅がある場合だけratioを更新し、狭幅でmin=maxの場合はno-opとして以前のrequested ratioを保つ」へ確定した（§9.4 と §12.2 の両方に同内容が記載され、記述が分散しても矛盾しない）。狭幅で End を押しても requested ratio が破壊されず、再拡大時に利用者の ratio へ戻るという §12.2 の主張が成立する。
- §18.1 の width test が「未計測 / 非finite / separator幅以下、通常幅、min=maxの狭幅、requested ratio復元。狭幅でpointer / keyboard操作してもratioを上書きしない」へ拡張され、境界と no-op の双方が自動検証対象になった。
- 既存 `explorerPane.ts` が `null` を hard bounds へ落とすのに対し、split policy は `null` を返して CSS fallback へ委ねる。両者の縮退規則が異なることは §5.5 の「数式共通化しない」判断と整合しており、意図的な差異である。

---

## 4. 受け入れ条件トレース確認

Round 1 fix (`dd0dead`) 反映後の状態で再評価した。初回 △ だった 5 行はすべて ✓ へ更新した。

| `docs/todo/todo.md` TODO-2026-006 完了条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| View メニューから single / 左右 2 pane split を切り替えられ、切替後も有効な表示対象と active pane が保たれる | §2.2、§7.1、§7.3 (`enable-split` / `disable-split`)、§8.1、§8.2、§13（`menuitemcheckbox`） | ✓ 整合。split off の条件付き引き継ぎ + 先頭 tab fallback（指摘 1.1）と split on の primary 未選択規則（指摘 3.5a）が確定し、全経路で有効な表示対象が保たれる |
| primary / secondary pane に同一 root 内の異なる open tab を選択して同時表示できる | §2.3、§5.1、§5.2、§9.3、§12.1 | ✓ 整合。tab data を複製せず pane-local selection で参照する構造が一貫している |
| Explorer 選択、tab activate、Reload、relative Markdown link は active pane を対象とし、他方の pane selection を意図せず変更しない | §8.3、§8.4、§8.5、§9.1 | ✓ 整合。`openOrActivateTab(paneId, path)`、Reload の active pane 限定、link の発生元 pane 伝播が明示されている |
| tab close、最後の tab close、root 変更、split off / on 後も各 pane が残存 tab または未選択状態へ一貫して復旧する | §7.3 (`disable-split` / `remove-tab` / `reset-root`)、§8.1、§8.2、§8.6、§8.7、§18.1 | ✓ 整合。指摘 1.1 の修正で split off 経路が閉じ、空 pane / 空 collection を throw させない契約も明示された |
| 各 pane で Markdown preview、相対画像、Mermaid、PlantUML、trusted HTML、anchor、独立 scroll、loading / error 表示が破綻せず、非同期結果が他 pane / tab へ混線しない | §5.3、§7.2、§9.5、§10、§11、§14 | ✓ 整合。TabStrip の shared / pane-local 合成規則（指摘 1.2）、`paneRuntime.ts` の identity guard（指摘 1.3）、Mermaid 生成 id の一意性要件（指摘 3.3）が揃った |
| split 表示でも HTML iframe の sandbox / CSP / root boundary / external link policy と Markdown の raw HTML 禁止を維持する | §11、§15、§16（Rust / Tauri config 変更なし）、§19-7 | ✓ 整合。`documentPolicy.ts` の判定順・`sandbox="allow-scripts"`・`html: false` を変更せず、activation の根拠記述も実 API 粒度へ訂正済み（指摘 3.2） |
| pane 幅変更または window / Explorer resize 後も preview が幅へ追従し、Mermaid が source 表示へ戻らず、PlantUML と HTML iframe が不必要に再読み込みされない | §10.2、§10.3、§11（iframe key = `paneId + tabId + revision`）、§12.2、§19-5/6/9 | ✓ 整合。既存の memoization / key 契約（`App.tsx:1103`、`App.tsx:2134`）と一致し、viewport 基準 CSS との関係も明記済み（指摘 3.4） |
| keyboard だけで split toggle、pane / tab 選択、pane 間移動、separator 操作へ到達でき、focus indicator と accessible name / role / state が確認できる | §9.3、§12.1、§13、§19-9/10 | ✓ 整合。pane-scoped ID 3 層、両 separator の `aria-controls` 参照先、single mode の prefix 統一が確定した（指摘 3.1） |
| single view の既存 Multi-tab、Markdown / HTML、image viewer、MenuBar / StatusBar、Settings、Recent Folders の操作が退行しない | §7.2、§15（single も同一経路）、§16、§18.2、§19-11 | ✓ 整合。HTML tab の Loading / Error 表示が合成規則で復元され（指摘 1.2）、image viewer の close / focus fallback も定義された（指摘 3.5b） |
| `npm test` / `npm run build` / `cargo check` が成功する（success_metrics） | §18.2（`cargo test` も追加）、§18.3 | ✓ 整合 |
| 手動確認（split on/off、左右別文書、active pane 切替、pane ごとの操作、tab close 復旧、root 変更、同時表示、独立 scroll、resize、Light / Dark、keyboard、security、single 回帰） | §19-1〜11 | ✓ 整合。指摘 1.1 / 3.3 / 3.4 / 3.5 に対応する観点が §19-1 / 5 / 8 / 9 へ追加された |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| global tab data + pane-local selection の採用判断 (§5.1) | ✓ 妥当。`OpenDocumentTab` は path 一意・revision 保持・PlantUML 結果 cache を含む（`App.tsx:66-77`）ため、pane 複製すると read と render が二重化する。不採用案表の理由と一致 |
| 旧 `activeTabId` / `pendingNavigation` を残さない単一路線化 (§7.1, §15) | ✓ 妥当。現行の 2 state（`App.tsx:128-129`）を `SplitViewState` へ置換し、single も同一経路で描画する方針は checkpoint 5「要求されていない後方互換レイヤーや旧経路を残さない」と一致 |
| `activeTab` / Explorer selected path / StatusBar / ErrorBanner の導出 (§7.1, §9.1) | ✓ 妥当。現行も `tabs.find(...)` による導出（`App.tsx:155`、`1060`、`1138`）で重複 state を持たない構造と一致 |
| pure policy module の分割 (§5.5, §9.4, §9.5) | ✓ 妥当。layout transition / width を `splitView.ts`、pane runtime identity と表示 state 合成を `paneRuntime.ts` へ分ける境界は責務が明確で、双方とも React / DOM / Tauri / Mermaid 非依存という制約が既存 policy module（`explorerPane.ts`、`documentPolicy.ts`、`imageViewer.ts`）の配置原則と一貫する |
| App 所有 Mermaid 直列 queue (§5.4, §10.1) | ✓ 妥当。現行は active tab 1 件の effect 内で `mermaid.initialize` + `run` を直接実行しており（`App.tsx:909-954`）、global config を共有する以上 2 pane の無制御並行は不可。module-global queue を採らず `useRef` で App instance に所有させる理由（test / remount / 複数 window での所有者曖昧化）も妥当 |
| PlantUML の tab 単位維持 (§10.2) | ✓ 妥当。現行 `loadTab` が tab 単位で `render_plantuml_diagrams` を 1 回だけ呼び結果を tab へ格納する（`App.tsx:518-545`）構造と一致し、pane resize / theme で再実行しないという契約も現行の依存配列と整合 |
| iframe key と theme 非 reload (§11) | ✓ 妥当。現行 key は `${activeTab.id}-${activeTab.revision}`（`App.tsx:1112`）で theme を含まない。`paneId` 追加は pane ownership 変化時だけ remount させる最小の拡張で、既存手動確認「Themeを切り替えてもiframeがreloadされず」と矛盾しない |
| `documentPolicy.ts` 契約不変 (§9.6, §11) | ✓ 妥当。`evaluateHtmlBridgeMessage` の判定順（source → origin `null` → tab/revision → shape → ready → activation → duplicate → scheme、`documentPolicy.ts:78-109`）は pane 概念を持たず、pane 選択中の tab / revision を context へ渡すだけで成立する。active pane を security 条件にしない判断は正しい |
| `imageViewer.ts` 非改変と交差型 (§9.6, §10.3) | ✓ 妥当。`ImageViewerRequest` は tab / revision / activation / focusOrigin / visual を持つ純粋な DOM policy 型で、`paneId` を App 側の交差型として付与すれば module へ split 依存を持ち込まずに済む。close / focus fallback 規則も App 側に閉じる |
| Explorer 幅 policy との非共通化 (§5.5, §9.4, §9.6, §12.2) | ✓ 妥当。`explorerPane.ts` は「preview 予約幅 320px を確保する外側 pane」（`explorerPane.ts:4, 13-25`）で、min の性質（固定 180px vs 動的 equal minimum）と未計測時の縮退規則（hard bounds vs `null` + CSS fallback）が異なる。数式共通化を避け pointer capture lifecycle の pattern だけ踏襲する判断は checkpoint 2「抽象化・共通化の結果が責務境界を壊していないか」と整合 |
| `DocumentPane` を `App.tsx` 内 React component とする例外 (§9.2) | ✓ 妥当。React hook を所有する framework component であることと、純粋 policy を持たせない境界が明記されており、checkpoint 2「フレームワーク契約で例外を採る場合、理由と境界が記録されているか」を満たす。既存 `TabStrip` / `HtmlPreview` / `MarkdownPreview` の配置とも一貫 |
| tab close の fallback 規則維持 (§8.6) | ✓ 妥当。現行の「close 前 index に対し右隣、なければ左隣」（`App.tsx:609`）を pane ごとへ適用する拡張で、既存契約を変えていない |
| root 変更時の split mode / ratio 維持 (§8.7) | ✓ 妥当。mode と ratio を session preference として維持し selection だけ clear する分離は、tab 破棄という既存挙動（`App.tsx:288-290`）と両立する |
| 不採用案の網羅性 (§5.6) | ✓ 妥当。tab への pane ID 埋め込み、collection 複製、single / split 二重 state、global TabStrip + move command、CSS 複製、pane 並行 Mermaid、arbitrary split tree、狭幅自動 single 化のいずれも理由が具体的で、要求範囲を超える複雑さの排除として一貫している |
| 非対象範囲の設定 (§3.2) | ✓ 妥当。TODO の non_scope（3 pane 以上、上下分割、drag and drop、reorder / pin、layout 復元、root 外 document、pane ごと theme、Avalonia、Rust / CSP 変更）と一対一で対応している |
| 失敗時動作の網羅 (§14) | ✓ 妥当。root scan 失敗時の全維持、pane 単位 error 帰属と TabStrip 表示、sandbox 緩和 fallback を作らない方針、programming error の throw は checkpoint 3（不要な fallback で不具合を隠さない）と一致。計測未確定値と空 pane を throw 対象から外した切り分けも、実 UI state と programming error の区別として妥当 |
| ADR 非追加判断 (§17 末尾) | ✓ 妥当。`docs/adr/README.md` §2 の起票条件（採用済み・複数案件で再利用・誤りやすい・coding_rules だけでは不足）に対し、現時点で Tauri component 固有であり Avalonia 展開時（TODO-2026-011）に再評価するという記述は対象外条件「案件固有の詳細設計」と整合 |
| 検証コマンド (§18.2, §18.3) | ✓ 整合。`docs/rules/development_workflow.md` の Tauri frontend / Rust check 節と一致し、Rust 差分が無い前提でも回帰確認として `cargo check` / `cargo test` を回す方針は妥当 |
| Round 1 fix による section 参照の整合 | ✓ 整合。§9.5 新設に伴い旧「既存module」節が §9.6 へ繰り下がったが、design 内に旧番号を参照する記述は残っていない。§16 影響範囲・§18.1 test 一覧・§5.5 採用理由も新 module 構成と一致する |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 | ブロッキング | Round 1 結果 |
| --- | --- | --- | --- | --- |
| 高 | 1.1 split off 時に active pane 未選択で primary の選択を失う | 利用者操作だけで表示中文書を失い、TODO 完了条件「split off / on 後も一貫して復旧する」を満たさない | 是 | 解決済み（`dd0dead`、§7.3 / §8.2 / §18.1 / §19-1） |
| 高 | 1.2 HTML tab の TabStrip 状態表示の導出元が未定義 | 既存 UI（Loading / Error 表示と error 配色）の退行であり、同一 tab を 2 pane 表示した場合の表示規則も未定 | 是 | 解決済み（`dd0dead`、§7.2 / §9.3 / §9.5 / §14 / §18.1） |
| 中 | 1.3 pane runtime guard が pure policy 外でテスト対象外 | §20 が最上位リスクとする race / 混線の軽減策が手動確認のみになり、リスク表と §18.1 が内部矛盾する | 是 | 解決済み（`dd0dead`、§5.5 / §9.5 / §16 / §18.1） |
| 低 | 3.1 DOM ID 改名に伴う IDREF の追随先未整理 | Explorer separator の `aria-controls` が dangling になり、split separator の参照先 id も未定義 | 否 | 解決済み（`dd0dead`、§9.3） |
| 低 | 3.2 transient activation の根拠記述が API 粒度と不一致 | security 境界は弱まらないが、誤った根拠が実装判断を誤らせうる。duplicate guard の粒度も明示が要る | 否 | 解決済み（`dd0dead`、§11） |
| 低 | 3.3 Mermaid 生成 id の document 内一意性 | 同一 Mermaid 文書の 2 pane 同時表示で marker / style の解決が崩れうる | 否 | 解決済み（`dd0dead`、§10.1 / §17 / §19-5） |
| 低 | 3.4 viewport 基準 CSS と pane 相対 layout の相互作用未記述 | 既存挙動だが TODO-2026-021 の確定契約と恒久ドキュメントで衝突しないよう立場を明示すべき | 否 | 解決済み（`dd0dead`、§12.2 / §17 / §19-9） |
| 低 | 3.5 境界条件 2 件（split on の primary 未選択 / pane unmount 時の image viewer） | pure policy が throw か `null` かを実装者が判断できず、viewer の開閉も未定 | 否 | 解決済み（`dd0dead`、§8.1 / §10.3 / §18.1 / §19-8） |
| 低 | 3.6 width policy の入力契約と ratio 書き戻し条件 | 数式は成立するが未計測・非正値・明示操作時の扱いが未確定で、実装差異を生む | 否 | 解決済み（`dd0dead`、§9.4 / §12.2 / §18.1） |

---

## 7. 残リスク / Phase 3・Phase 4 での注意点

指摘 9 件はすべて設計へ反映済みで、Phase 3 をブロックする残件は無い。以下は実装・検証時の注意点である（いずれも新規指摘ではない）。

- **separator の ARIA 値と計測前 frame**: §9.4 の `getSplitPaneWidthBounds` は未計測時に `null` を返すが、§12.2 / §13 は separator へ `aria-valuemin` / `aria-valuemax` / `aria-valuenow` を要求する。計測前の 1 frame をどう扱うか（separator を計測後に描画する、50/50 fallback から算出した px を暫定公開する等）は Phase 3 の実装判断で閉じる。focusable な `role="separator"` は値を持つべきなので、いずれかの方法で「値の無い separator」を残さないこと。
- **Mermaid 生成 id の実採番**: mermaid 11 の既定 id 採番は時刻由来のため、直列 queue でも同一ミリ秒内で衝突しうる。§10.1 は「document 内で一意でなければならない」という要件と Phase 4 確認を定めたので、衝突が観測された場合は pane ごとの id prefix 付与（node への事前 id 設定など）を Phase 3 で追加し、`deterministicIds` は有効化しない方針を守る。
- **ID 定義の記載位置**: §9.3（TabStrip 節）に DocumentPane region ID と `preview-workspace` ID が置かれている。Phase 3 で恒久 docs（`detail_design.md` / `interface_spec.md`）へ反映する際は、pane / layout 側の ID として整理し直すと参照しやすい。設計としての内容に不足は無い。
- **Reload の対象**: Reload は active pane の selected tab だけを対象とするため（§8.4）、active pane が未選択のときは tree scan だけが走る。既存挙動（active tab が無ければ再読込しない、`App.tsx:453`）の自然な拡張だが、Phase 4 では「Reload が対象とするのは active pane」であることを期待値として明示しておくと誤検知を避けられる。
- **Explorer の選択強調**: active pane の tab だけを対象とする（§9.1）ため、split 表示中に 2 文書を開いていても Explorer 上のハイライトは 1 件になる。TODO の要求範囲内。TODO-2026-007 の UX 評価で扱う候補として記録しておく。
- **pure policy の throw 範囲**: §7.3 の throw 対象は「存在しない pane ID や有限でない ratio」に限定され、空 pane・空 collection・未計測 width は除外された。Phase 3 では正当な stale event（close 済み tab の async 完了、消費済み navigation）が throw 経路へ入らないことを実装で担保する。
- **iframe 上の separator drag**: §12.3 の `split-resizing` class による cursor / user-select 固定は iframe 内部 document へは効かない。pointer capture により drag 継続自体は成立する見込みだが、Phase 4 の手動確認（§19-9）で iframe 上の cursor 表示に操作上の違和感が無いことを実機で確認する。

---

## 8. 結論

本設計は、`OpenDocumentTab[]` を文書データの正本として維持したまま表示選択だけを `SplitViewState` へ置換するという中核判断が明確で、global tab data と pane-local runtime の境界、App 所有の Mermaid 直列 queue、iframe ごとの ready handshake、純粋 policy module への集約、Explorer 幅 policy との非共通化、single 経路の一本化、security 境界の非緩和を、いずれも現行実ソースと一致する根拠に基づいて構成している。不採用案の理由付けと非対象範囲の設定も TODO と一対一で対応している。

初回レビューでは Medium 3 件・Low 6 件を指摘した。

### 再確認結果 (2026-07-26, commit `dd0dead`)

Round 1 fix の design 差分を `git show dd0dead` で確認し、9 件すべての反映を検証した。

- **1.1 (Medium) — 解決済み**: `disable-split` / §8.2 が「active pane が非 `null` の時だけ引き継ぎ、未選択なら primary 維持、両方未選択で tab が残る場合だけ先頭 tab へ fallback」へ確定。ordered tab IDs を action へ渡す入力契約と、空 pane / 空 collection を throw させない方針も明記された。§18.1 / §19-1 へ追跡済み。
- **1.2 (Medium) — 解決済み**: §7.2 へ TabStrip の 3 段合成規則（shared 優先 → 選択中かつ identity 一致時のみ pane runtime 反映 → 不一致は shared のみ）が追加され、同一 HTML tab の片 pane timeout が当該 pane の TabStrip だけを `Error` にすることまで明示。§9.3 の props に自 pane の `PanePreviewStatus` が加わり、§14 の timeout 行と §18.1 の test も更新された。
- **1.3 (Medium) — 解決済み**: `paneRuntime.ts` / `paneRuntime.test.ts` を新設し、`isPaneResultCurrent` と `resolvePaneTabPresentationState` を pure function として定義。DOM `isConnected` 判定だけを effect 側へ残す境界も明記され、§20 リスク表の「pane guard test」が実体を伴うようになった。
- **3.1 — 解決済み**: §9.3 に pane-scoped ID 3 層、split separator の `aria-controls`、Explorer separator の新参照先 `explorer-pane preview-workspace`、single mode の primary prefix 統一を明記。
- **3.2 — 解決済み**: §11 の activation 根拠を親 document 単位の `navigator.userActivation` へ訂正し、duplicate guard が pane 単位である帰結を明文化。
- **3.3 — 解決済み**: §10.1 に Mermaid 生成 id の document 内一意性要件と `deterministicIds` 非採用、§19-5 に同一 Mermaid 文書の両 pane 表示確認、§17 に common pitfalls 反映を追加。
- **3.4 — 解決済み**: §12.2 に「本文幅は pane content box 相対 / gutter breakpoint と tab `32vw` は viewport 基準を維持」を明記し、§19-9 と §17 へ TODO-2026-021 との整合を追加。
- **3.5 — 解決済み**: §8.1 に primary 未選択時の secondary `null` 規則、§10.3 に split off / pane unmount / 未選択化 / visual 切断時の viewer close と focus fallback を追加。
- **3.6 — 解決済み**: §9.4 に `workspaceWidth: number | null` を受け `null` を返す width policy 契約、自動 clamp 非書き戻し・明示操作の更新条件・min=max 時の no-op を確定し、§18.1 へ境界 test を追加。

対応による新たな齟齬、実装不能な契約、section 参照の破損は検出しなかった。受け入れ条件トレース（第 4 節）は初回 △ だった 5 行を含め **全 11 行が ✓** となった。

以上より本 Phase 2 設計を **承認 (Approved)** とし、Phase 3（実装・docs 反映）への進行を可とする。**未解決指摘は 0 件**。Phase 3 では第 7 節の注意点（separator ARIA 値の計測前 frame、Mermaid 生成 id の実採番、ID 定義の恒久 docs での整理、Reload 対象の期待値、pure policy の throw 範囲、iframe 上 drag）に留意すること。

---

## 9. 指摘対応 Round 1

| 指摘 | severity | 対応 | 状態 |
| --- | --- | --- | --- |
| 1.1 split off 時の primary selection 喪失 | Medium（ブロッキング） | §7.3 `disable-split` を条件付き引き継ぎ + 先頭 tab fallback へ確定、§8.2 を 5 手順へ再構成、ordered tab IDs の入力契約と throw 非対象を明記、§18.1 / §19-1 へ追跡 | 解決済み（再確認済み、`dd0dead`） |
| 1.2 TabStrip の HTML 状態表示の導出元欠落 | Medium（ブロッキング） | §7.2 へ shared / pane-local の 3 段合成規則、§9.3 props へ自 pane `PanePreviewStatus`、§14 timeout 行へ TabStrip 表示、§9.5 へ合成 policy、§18.1 へ test | 解決済み（再確認済み、`dd0dead`） |
| 1.3 pane guard の pure policy 外配置 | Medium（ブロッキング） | `paneRuntime.ts` / `paneRuntime.test.ts` 新設、`isPaneResultCurrent` / `resolvePaneTabPresentationState` 定義、§5.5 採用理由、§16 影響範囲、§18.1 test 4 項目 | 解決済み（再確認済み、`dd0dead`） |
| 3.1 DOM ID 改名の波及先未整理 | Low | §9.3 へ pane-scoped ID 3 層、両 separator の `aria-controls` 参照先、single mode prefix 統一を明記 | 解決済み（再確認済み、`dd0dead`） |
| 3.2 transient activation の根拠記述 | Low | §11 を親 document 単位の activation 契約へ訂正し、duplicate guard の pane 単位粒度を明記 | 解決済み（再確認済み、`dd0dead`） |
| 3.3 Mermaid 生成 id の一意性 | Low | §10.1 へ一意性要件と `deterministicIds` 非採用、§19-5 へ同一文書両 pane 確認、§17 へ pitfalls 反映 | 解決済み（再確認済み、`dd0dead`） |
| 3.4 viewport 基準 CSS との相互作用 | Low | §12.2 へ幅基準と breakpoint 基準の分離、§19-9 へ確認観点、§17 へ TODO-2026-021 との整合注記 | 解決済み（再確認済み、`dd0dead`） |
| 3.5 境界条件 2 件 | Low | §8.1 へ primary 未選択時の secondary `null` 規則、§10.3 へ viewer close / focus fallback 規則、§18.1 / §19-8 へ追跡 | 解決済み（再確認済み、`dd0dead`） |
| 3.6 width policy の入力契約 | Low | §9.4 へ `workspaceWidth` の nullable 契約と `null` 返却、書き戻し条件と no-op、§12.2 へ同内容、§18.1 へ境界 test | 解決済み（再確認済み、`dd0dead`） |

Round 1 の 9 件について、設計書 (`dd0dead`) への反映内容が推奨対応と整合し、新たな齟齬を生じさせていないことを確認した。未解決指摘は 0 件であり、総合判定は **承認 (Approved)**。Phase 3（実装・docs 反映）へ進行してよい。
