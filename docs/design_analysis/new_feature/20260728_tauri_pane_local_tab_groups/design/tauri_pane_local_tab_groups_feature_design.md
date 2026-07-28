# Tauri pane-local tab group / pane 間移動 設計

## 1. 背景・要求・完了条件

`TODO-2026-023` は、Tauri Viewer の primary / secondary pane が現在共有している global TabStrip を、pane ごとの ordered tab group へ置き換え、tab を明示操作で反対 pane へ移動できるようにする新機能である。`TODO-2026-024` の pane 間移動は、所属変更と fallback を同じ typed transition で扱う必要があるため本項目へ統合済みである。

現行 `TODO-2026-006` の Split View は次の基盤を提供している。

- `OpenDocumentTab[]` が path 一意の document data、revision、PlantUML cache の正本である。
- `SplitViewState` が mode、active pane、pane ごとの active tab / pending navigation を持つ。
- `PanePreviewStatus`、Mermaid DOM、HTML iframe handshake、image viewer は pane / tab / revision で分離される。
- ただし両 `TabStrip` は同じ `OpenDocumentTab[]` 全件を同じ順で表示し、close は global close である。

本変更後も global document data は共有する。一方、表示所属・表示順・選択は pane-local とし、global collection の順序を TabStrip 順序として使わない。

完了条件は `docs/todo/todo.md` の TODO-2026-023 を正とし、特に次を満たす。

- 各 TabStrip は自 pane の group に属する tab だけを表示する。
- Explorer / relative link から開いた document は active pane group へ追加・選択する。
- 同じ document ID を両 group が参照できるが、DOM runtime は共有しない。
- local close は他 pane groupを変更せず、どの group からも参照されなくなった document data だけを破棄する。
- move は source removal、source fallback、destination add / select、active pane 更新を 1 action で確定する。
- Reload、root change、split off / on、async result、focus / accessibility が新しい group model と整合する。

## 2. 対象ユーザー、ユースケース、操作導線

### 2.1 対象ユーザー

- primary に仕様書群、secondary に設計書群を置き、左右の作業文脈を分離したい利用者。
- Explorer / relative link から document を現在操作中の pane へ追加したい利用者。
- pointer、keyboard、支援技術から pane 間移動と local close を操作したい利用者。

### 2.2 基本導線

1. single view 起動時は primary group だけを表示する。
2. Explorer または relative link で document を開くと primary group 末尾へ一度だけ追加し、選択する。
3. `View > Split View` を有効にすると secondary group をそのまま表示する。初回は空であり、暗黙に primary の tab を複製・移動しない。
4. secondary pane を pointer / focus で active にして Explorer から document を開くか、primary の tab にある move button で移動する。
5. 同じ path を反対 pane で Explorer / relative link から開くと、global data は再利用し、その pane group に同じ tab IDを追加して選択する。
6. close button は操作元 pane group からだけ tab を外す。反対 group に同じ ID が残る場合、その document と表示は維持する。
7. move button は split mode だけに表示し、反対 paneへ移動した tab を選択してfocusを移す。
8. splitを無効にするとprimary groupだけを表示し、secondary groupはsession内で保持する。再度有効にすると以前のsecondary groupと選択を復元する。

### 2.3 明示的な互換性変更

現行split onはglobal順の隣接tabをsecondaryへ自動選択し、split offはactive secondary selectionをprimaryへ引き継ぐ。本機能ではgroup ownershipを暗黙に変更しないため、次へ置き換える。

- 初回split onのsecondaryは空とする。
- split offでsecondary tabをprimaryへコピー・移動しない。
- split off / onは両groupのordered IDsとactive tabを保持し、visible paneと`activePaneId`だけを切り替える。

これはpersisted dataや外部APIの互換性変更ではなく、pane-local group導入に伴う意図したUI仕様変更である。

## 3. 対象範囲と非対象

### 3.1 最小提供範囲

- `PaneState` のordered tab ID collectionとactive tab invariant。
- active paneへのadd-or-select、pane-local activate / close。
- split modeでのprimary / secondary間move button。
- global document cacheの参照有無に基づく破棄。
- single時secondary group保持、split再有効化時復元。
- local group順を使うTabStrip navigation、focus復帰、ARIA label。
- `splitView.ts` / `paneRuntime.ts` unit test、既存frontend / Rust回帰検証。
- component、architecture、利用方法、手動確認文書の同期。

### 3.2 非対象

- drag and drop、group内reorder、pin、複数選択、一括move / close。
- 3 pane以上、任意split tree、pane生成 / 削除。
- group、active tab、split layoutの再起動後永続化。
- tabごとのscroll位置復元。
- Avalonia実装、上下split。上下・左右方向はTODO-2026-025で扱う。
- Rust command、custom protocol、capability、CSP、settings schemaの変更。

## 4. 採用案・不採用案・判断理由

### 4.1 採用: global document data + pane-local ordered ID references

```text
OpenDocumentTab[]                    SplitViewState
  tab-1: spec.md cache       <----- primary.orderedTabIds = [tab-1, tab-3]
  tab-2: design.md cache     <----- secondary.orderedTabIds = [tab-2, tab-1]
  tab-3: notes.html cache           primary.activeTabId = tab-3
                                    secondary.activeTabId = tab-1
```

同じ `tab-1` は両groupに存在できる。document read、revision、PlantUML cacheは1件だけだが、Mermaid DOM、HTML iframe、pending navigation、scroll、image viewerはpaneごとに生成する。

### 4.2 採用: group stateを`splitView.ts`へ統合

ordered IDs、selection、move、close、split toggleは同じinvariantを共有するため、既存`splitView.ts`のtyped pure policyを拡張する。別の`tabGroups.ts`を追加してlayout stateを二重管理したり、`App.tsx` event handlerへ配列操作を散らしたりしない。

TypeScript policy moduleのexported pure functionは既存project patternであり、React componentやmutable module-global stateを追加するものではない。UI event用の場当たり的なmodule-global functionやclass wrapperは追加せず、状態遷移をdiscriminated union reducerへ集約する。

### 4.3 採用: local close + unreferenced cache eviction

closeは最初にsource pane groupからIDを外す。次stateの両groupにIDが残らない場合だけ`OpenDocumentTab[]`からdataを削除する。これにより、同じdocumentを表示する他paneのtab、preview、loading / errorを意図せず閉じない。

### 4.4 採用: inline move button

split modeの各tab itemへ、反対pane方向を示すmove buttonを追加する。

- primary: symbol `→`、`aria-label="Move <name> to secondary pane"`。
- secondary: symbol `←`、`aria-label="Move <name> to primary pane"`。
- active tabのactivate buttonからTab移動するとmove、closeへ到達できる。
- 非active tabは既存roving tab操作でactiveにしてからbuttonへ到達する。
- move完了後はdestinationのtab activate buttonへfocusする。

context menuは新しいpopup lifecycle、keyboard model、outside click処理を必要とし、1操作の最小提供範囲を超えるため採用しない。drag and dropも非対象とする。

### 4.5 不採用案

| 案 | 不採用理由 |
| --- | --- |
| `OpenDocumentTab`へ単一`paneId`を持たせる | 同じdocumentを両paneで開けず、cacheとlayout責務が混ざる |
| paneごとに`OpenDocumentTab[]`を複製する | read / revision / PlantUML resultの正本が二重化し、path一意契約を失う |
| global tabsからpane別にfilterするだけ | pane-local順序、同一ID両group、local closeを表現できない |
| closeをglobalのまま維持する | 反対paneのgroupが意図せず減り、受け入れ条件に反する |
| split off時にsecondaryをprimaryへmergeする | group ownershipと順序を暗黙変更し、再split時の文脈を失う |
| split on時にsecondaryへ隣接tabを自動copyする | 利用者が開く／移動する前に所属が増え、pane-local group契約が曖昧になる |
| move専用のReact stateを追加する | reducerと二重の正本になり、close / split / rootとの競合を生む |
| invalid IDをfilterして継続する | 内部state不整合を隠す不要fallbackになる |

## 5. Before / After

| 観点 | Before | After |
| --- | --- | --- |
| TabStrip内容 | 両paneともglobal tabs全件 | paneのordered IDsに属するtabだけ |
| TabStrip順 | global insertion order | pane-local insertion order |
| active tab | pane-local | pane-local、かつ必ずown group member |
| Explorer / link open | global追加 + pane選択 | global再利用/追加 + active group末尾追加・選択 |
| close | global dataと両pane選択を削除 | source groupだけ削除、unreferenced時だけglobal破棄 |
| move | なし | typed atomic transition + destination focus |
| split on | secondaryへ隣接global tabを選択 | secondary groupをそのまま復元、初回はempty |
| split off | active secondaryをprimaryへ引継ぎ、secondary clear | groupを変更せずprimary表示へ戻す |
| runtime | pane / tab / revision guard | 同契約を維持しgroup遷移でもstale結果を拒否 |

## 6. 型・invariant・状態モデル

### 6.1 `PaneState`

```ts
export type PaneState = {
  orderedTabIds: string[];
  activeTabId: string | null;
  pendingNavigation: PendingPaneNavigation | null;
};
```

`SplitViewState`の`mode`、`activePaneId`、`primary`、`secondary`、`requestedSplitRatio`は維持する。

### 6.2 必須invariant

1. 1つの`orderedTabIds`内に同じIDを2回含めない。
2. `activeTabId`は`null`、または同じpaneの`orderedTabIds` memberである。
3. `pendingNavigation`がある場合、その`tabId`は`activeTabId`と一致する。
4. 各ordered IDはglobal `OpenDocumentTab[]`に実在する。
5. 各global tabは少なくとも1つのpane groupから参照される。不可視cacheは残さない。
6. 同じIDがprimaryとsecondaryの両方に存在することは正当である。
7. single modeではsecondary groupを保持できるが、`activePaneId`は必ずprimaryである。
8. `orderedTabIds`が非空のpaneは必ず非`null`の`activeTabId`を持つ。`activeTabId === null`はgroupが空の場合だけ正当である。

1〜3、7〜8とmode / pane actionの整合は`splitView.ts`が守る。4〜5はAppがglobal tabsとreducer resultを同時更新するintegration boundaryで守る。内部programming errorはthrowし、欠落IDを黙ってfilterしない。stale async responseだけは既存revision guardでignoreする。

### 6.3 初期値とmigration

- `createInitialSplitViewState(): SplitViewState`は引数を廃止し、single、active primary、両group empty、ratio 0.5を返す。
- root open後のinitial document: primaryへadd-or-selectする。
- stateはsession-onlyでpersistしていないためschema migrationは不要。
- 旧`PaneState`とのruntime compatibility layerは作らず、新schemaへ一括置換する。

## 7. Typed action設計

`SplitViewAction`は次へ更新する。

| action | 入力 | membership / selection契約 | pending navigation契約 |
| --- | --- | --- | --- |
| `open-tab` | paneId, tabId, optional anchor | groupになければ末尾追加し選択・pane activate。既存memberなら重複せず選択。singleでsecondary指定はthrow | anchorがあれば`{ tabId, anchor }`、なければ`null`へ置換 |
| `select-tab` | paneId, tabId | memberだけ選択・pane activate。非member、またはsingleでsecondary指定はthrow | 常に`null` |
| `activate-pane` | paneId | split中のsecondary、またはprimaryをactive化。singleでsecondary指定はthrow | 変更しない |
| `enable-split` | なし | group / selectionを変更せずmode split、active primary | 変更しない |
| `disable-split` | なし | group / active tabを変更せずmode single、active primary | primaryは維持、secondaryだけ`null` |
| `close-pane-tab` | paneId, tabId | source groupから削除。activeならsource順の右、なければ左、なければnullへfallback。nonmember、またはsingleでsecondary指定はthrow | active tabを閉じた場合だけ`null`。non-active closeでは維持 |
| `move-tab` | sourcePaneId, destinationPaneId, tabId | split限定。source削除、destination末尾へdedupe追加・選択、destination activate | sourceはactive tabを移した場合だけ`null`。destinationはselectionが変わる場合`null`、既に同tabを選択中なら維持 |
| `reset-root` | なし | mode / ratio維持、両group / selection clear、active primary | 両pane`null` |
| `consume-navigation` | paneId, tabId, anchor | selectionを変更しない | identity一致時だけ`null`。不一致stale eventはsame stateを返す |
| `set-requested-ratio` | ratio | 既存finite 0..1 exclusive validation | 変更しない |

`move-tab`はsourceとdestinationが異なり、tabがsource memberであることを要求する。destinationに既に同じIDがある場合は追加せず、既存位置を維持して選択する。sourceのtabがactiveでなければsource active / pendingは維持する。active tabを移す場合だけsource fallbackを計算する。

`close-pane-tab`と`move-tab`のfallbackはsourceの変更前順序を基準に、対象indexの右隣、なければ左隣、なければ`null`とする。global順序は使わない。

`enable-split` / `disable-split`から現行`orderedTabIds` payloadを削除する。現行`findAdjacentTabId(activeTabId, orderedTabIds)`はexportを廃止し、source group内のclose / move fallbackだけに使うprivate helperとして維持する。global順のsecondary初期選択には使わない。現行`remove-tab`にある「非active paneのpendingがclosed IDならclear」というguardはinvariant 3の下で到達不能になるため残さない。

## 8. 状態遷移と失敗時動作

### 8.1 Explorer / relative link open

1. `tabsRef.current`からpath一致を探す。
2. 既存ならdocument loadを再実行せず`open-tab`をactive paneへ適用する。
3. 未openならglobal tabを追加してから同じ`open-tab`を適用し、`loadTab`を開始する。
4. group内既存IDは位置を変更しない。新規membershipだけ末尾へ追加する。
5. `open-tab`はanchorがあれば同paneのpending navigationへ設定し、anchorがなければ既存pendingを必ずclearする。

### 8.2 Local activate / close

- TabStripは自paneのordered listだけをroving navigationに使う。
- activateはmembershipを変えない。
- closeは`close-pane-tab`適用後の両group参照集合を調べる。
- unreferencedならglobal tabを削除し、そのtab / revisionのlate async resultは`updateTabIfCurrent`で無視する。
- 他groupに残る場合はglobal tab、revision、shared load stateを維持する。
- pane preview statusのstale判定は`isPanePreviewStatusCurrent`を使う既存generic effectを唯一の正本とし、close handlerでは直接clearしない。現行`closeTab`のclosed IDに一致するstatusを両paneから無条件clearする処理は削除する。
- active image viewerのoriginが閉じたsource pane / tabなら既存identity effectで閉じる。

### 8.3 Move

1. split modeのsource TabStripからmoveを発火する。
2. reducerがsource removal / fallbackとdestination dedupe add / selectをatomically返す。
3. global tabは必ずdestinationから参照されるため削除しない。
4. pane preview statusのstale判定は`isPanePreviewStatusCurrent`を使う既存generic effectへ一本化し、move handlerで独自のidentity比較や直接clearを行わない。destinationが移動対象を既に選択中ならstatusと既存DOM / iframeはcurrentのまま維持され、selectionが変わったdestinationだけ新しいpreviewを生成する。
5. `requestAnimationFrame`後に`tab-<destination>-<tabId>`へfocusする。React commit timingなどで要素を取得できない場合だけ、focus可能なdestination pane regionへ戻してdevelopment consoleへintegration errorを記録する。sourceの消滅要素へfocusを戻さない。
6. move前にdestinationにも同IDがあれば、sourceだけから外し、destinationの既存item位置を維持して選択する。
7. image viewerは既存identity effectへ従う。origin paneのselectionが変わるsource active moveまたはdestination selection変更では閉じる。destinationが既に同tabを選択中でorigin identityも変わらないviewerは維持する。

### 8.4 Split on / off

- enable: ordered IDs / selectionを変更せず、mode split、active primary。secondary runtimeはmount後に再確立する。
- disable: ordered IDs / active tabsを変更せず、mode single、active primary。hidden secondaryのpending navigationはreducerでclearし、runtime statusはmode不一致を検出する既存generic effectでclearする。toggle handlerから直接clearしない。
- secondary-only document dataはsingle中もgroupから参照されるためglobal cacheに残す。
- split再有効化時はsecondaryのactive tabと順序を復元するが、old DOM runtime stateは復元しない。
- primary groupが空でsecondary groupだけが非空のままsplit offした場合、primary previewは件数に応じて`No document selected in this pane. <N> document(s) remain in the secondary pane. Enable Split View to access them.`と回復方法を表示する。groupを暗黙mergeせず、利用者がsplitを再有効化して復帰できることを明示する。

### 8.5 Reload

- active pane（primaryまたはsecondary）のselected global tab 1件だけrevisionを増やす。
- 同じIDが両groupでselectedなら両pane previewが同じnew revisionへ更新される。
- shared document / PlantUML stateは両groupに共通、Mermaid / HTML handshake statusは両paneでclear・再生成する。
- group membershipと順序は変更しない。

### 8.6 Root change

- scan成功後だけglobal tabsをemptyにし、`reset-root`で両groupをclearする。
- modeとrequested ratioは維持する。
- initial documentをprimary groupへ追加する。split modeが維持されていてもsecondaryはemptyから始める。
- scan失敗時は旧root、global tabs、groups、DOMを維持する。

## 9. React componentと責務分割

### 9.1 `App`

- global `OpenDocumentTab[]` / refsと`SplitViewState`を組み合わせる唯一のintegration owner。
- `openOrActivateTab`を`open-tab` actionへ接続する。
- `closeTab`をpane-local closeへ変更し、次stateのreference setからglobal evictionを判断する。
- `moveTab`でtyped actionとdestination focusを調停する。close / move handlerはpane runtime statusを直接clearせず、既存generic effectへ委ねる。
- `resolveGroupTabs<T extends { id: string }>(orderedTabIds: string[], tabs: T[]): T[]`を`useMemo`からprimary / secondaryそれぞれ1回だけ呼び、解決済みviewを`DocumentPane`へ渡す。missing IDのthrowはこのApp integration boundaryに限定する。
- Reload、root、StatusBar / ErrorBanner、Explorer selected pathはactive paneのactive IDから導出する。
- global tabs orderをTabStrip UI orderとして使用しない。

### 9.2 `splitView.ts`

- group invariant、typed transitions、adjacent fallback、reference set導出、既存width policyを担当する。
- React、DOM、Tauri、`OpenDocumentTab`の具体型へ依存しない。
- generic `resolveGroupTabs<T extends { id: string }>(orderedTabIds: string[], tabs: T[]): T[]`を提供する。ID不在はthrowし、silent filterしない。
- `createInitialSplitViewState`は引数なしへ変更し、`enable-split` / `disable-split`のglobal ordered payloadを削除する。`findAdjacentTabId`はsource group fallback用private helperへ縮小する。
- existing exported pure policy styleを維持し、mutable module-global stateや重複reducerを追加しない。

### 9.3 `DocumentPane`

- Appで`PaneState.orderedTabIds`順に解決済みの`OpenDocumentTab[]` viewを受ける。render内でglobal collectionとの再解決を行わない。
- selected tabは解決済みgroup viewからだけ選び、global listから任意IDを直接選ばない。
- `TabStrip`へlocal tabs、move callback、split modeを渡す。
- Markdown / HTML preview lifecycleは既存pane / tab / revision contractを維持する。

### 9.4 `TabStrip`

- local tabsだけをrenderし、ArrowLeft / ArrowRight / Home / Endをlocal順へ適用する。
- tab itemはsplit時にactivate / move / closeの3領域、single時にactivate / closeの2領域とする。
- local close後はsource fallback tab、なければsource pane regionへfocusする。
- move後はdestination tabへfocusする。
- labelへpane名を含め、同名documentが両paneにあっても操作対象を識別できるようにする。
- invariant 8によりlocal tabsが非空ならactive tabも必ず存在するため、現行`activeTabId === null && index === 0`のroving tabindex fallbackは削除し、旧経路として残さない。

### 9.5 `paneRuntime.ts`

pane result guardとpresentation合成の責務は変更しない。`activeTabId`がmembership invariantを満たすため、追加のglobal membership fallbackは不要である。次を追加testで固定する。

- active tab move後、source captured resultは拒否しdestination current resultだけ受理する。
- split off中は保持されたsecondary selectionのresultを拒否する。
- split再有効化後もrevision一致が必要である。
- 同じIDが両groupにある時のpane-local error合成を維持する。

## 10. Async renderingとsecurity境界

### 10.1 Markdown / Mermaid / PlantUML

- global source / PlantUML cache共有を維持する。
- Mermaid render IDは`paneId + tabId + revision + index`、queueはApp instance ownerのままとする。
- moveはDOM ownership変更であり、source taskは`isPaneResultCurrent` / `isConnected`でstaleとなる。destinationは新規taskをqueueする。
- group操作だけでPlantUML commandを再実行しない。

### 10.2 trusted HTML

- iframe key `paneId + tabId + revision`、source照合、opaque origin、ready、activation、duplicate、scheme policyを維持する。
- move時はsource iframeをunmountし、destination iframeが新しいhandshakeを行う。
- 同じHTML IDがdestinationに既に表示中の場合、destination iframeは同じkeyのため不要にremountしない。sourceだけunmountする。
- active paneやgroup membershipをsecurity許可条件へ追加しない。selection / revisionはlifecycle guard、security boundaryは既存`documentPolicy.ts`を正とする。
- sandbox、CSP、root boundary、capabilityを緩和するfallbackは追加しない。

## 11. Accessibility、focus、visual design

- 各pane `role="tablist"`は自groupだけを含み、`aria-label`へPrimary / Secondaryを含める。
- tab activate buttonの`aria-selected` / `aria-controls` / pane-scoped DOM IDを維持する。
- move buttonはsplit時だけ存在し、方向だけでなくdocument名とdestination paneをaccessible nameに含める。
- close buttonは`Close <name> in <primary|secondary> pane`としlocal closeを明示する。
- active tabだけmove / closeを通常Tab順へ含め、非active tabはroving activate buttonから操作する。
- move後focusはdestination activate button、close後focusはsource fallback activate button、emptyならsource pane region。
- focus移動でdestination paneがactiveになる。StatusBar / ErrorBanner / Explorer highlightも同destination tabへ更新する。
- CSSはsingle時2列、split時3列を使う。split時だけ`.tab-item`の`min-width`を3列分の160pxへ引き上げ、document名領域を確保する。`width: min(220px, 32vw)`のwindow viewport基準、horizontal overflow、focus-visible、loading / error表示は維持する。
- symbolは視覚補助であり、意味は`aria-label` / `title`を正とする。

## 12. Error handlingとデフォルト動作

| 条件 | 動作 |
| --- | --- |
| open済みIDを同paneで再open | 重複追加せず選択、既存位置維持 |
| open済みIDを反対paneでopen | global data再利用、destination group末尾追加・選択 |
| destinationに同IDがあるmove | sourceだけ削除、destination既存位置維持・選択 |
| active source tab move / close | source local順の右→左→null fallback |
| non-active source tab move / close | source active / pendingを維持 |
| 最後のsource tab move | source empty、destination選択、destination active |
| 最後の唯一参照tab close | 両groupから参照なし、global data破棄 |
| shared tabの片pane close | 他pane membership / data / runtime維持 |
| split off時にprimary empty / secondary nonempty | groupをmergeせずprimaryへhidden secondary件数と`Enable Split View`の回復案内を表示 |
| move時のimage viewer | origin paneのselectionが変わる場合だけ既存identity effectで閉じ、identity不変なら維持 |
| invalid pane / duplicate internal IDs / nonmember select | throwしてprogramming errorを顕在化 |
| close済み / reload前async完了 | tab / revision / pane guardでignore |
| destination focus element欠落 | destination pane regionへfocusしdevelopment consoleにintegration error。データ遷移はrollbackしない |

## 13. 互換性、単一路線、拡張性

- Rust command、`OpenDocumentTab` data schema、settings JSON、protocol URLは変更しない。
- `PaneState`だけを新schemaへ一括変更し、旧global TabStrip解釈やglobal close actionを互換経路として残さない。
- single / splitとも同じpane-local group reducer、`DocumentPane`、`TabStrip`を使う。
- group persistenceは追加せず、migrationも不要。
- TODO-2026-025の上下splitは同じprimary / secondary groupをlayout方向に依存せず再利用できる。
- 3 pane / split tree用のgeneric graphは先取りしないが、move actionはsource / destinationを明示し、方向symbol以外のstate transitionは左右layoutに依存させない。
- ADRは追加しない。本判断は現時点でTauri component固有であり、横断判断の起票条件を満たさない。TODO-2026-025またはTODO-2026-011で同じgroup modelを採用した時点で、複数案件へ再利用する採用済み判断としてADR起票条件を再評価する。

## 14. 影響範囲

| 対象 | 予定変更 |
| --- | --- |
| `markdown-viewer-tauri/src/splitView.ts` | `createInitialSplitViewState`引数廃止、ordered IDs、group actions、pending規則、generic resolver、reference helper、split payload削除、private adjacent fallback |
| `markdown-viewer-tauri/src/splitView.test.ts` | 既存initial / split toggle / selection testをgroup schemaへ置換し、add / close / move / root / pending / invalid invariant testを追加 |
| `markdown-viewer-tauri/src/App.tsx` | open、local close、cache eviction、move、App境界のgroup view解決、hidden secondary案内、focus integration。close / toggleの直接runtime clearを削除 |
| `markdown-viewer-tauri/src/App.css` | split時move buttonを含むtab item grid / hover / focus |
| `markdown-viewer-tauri/src/paneRuntime.test.ts` | 引数付きinitial stateと非member select前提をgroup membership helperへ書換え、move / retained secondary / same ID両groupのguard回帰を追加 |
| `paneRuntime.ts` | 原則変更なし。型変更に伴う参照調整のみ |
| `documentPolicy.ts`, `imageViewer.ts` | 変更なし |
| `src-tauri`, Tauri config / capabilities | 変更なし |
| 恒久docs | group ownership、local close、move、split toggle、keyboard / manual verificationを同期 |

## 15. 恒久ドキュメント更新・置換対象

| 文書 | 置換・追記方針 |
| --- | --- |
| `README.md` | Tauri機能比較へpane-local group / local close / move概要を追記 |
| `markdown-viewer-tauri/README.md` | 各paneで所属・順序を持つ説明へ置換し、open先、local close、move button、keyboard、split off中のhidden secondary保持と回復方法を記載。現行「各paneから独立に選択」だけの説明を拡張 |
| `docs/rules/project_overview.md` | global document data + pane-local ordered reference groupへ概要を更新 |
| `docs/architecture/overview.md` | state source of truth、open / local close / eviction / atomic move flowへ更新 |
| `docs/architecture/code_patterns.md` | ordered reference group、unreferenced cache eviction、typed atomic move、generic stale runtime effectをpattern化 |
| `docs/architecture/common_pitfalls.md` | global close混入、silent missing-ID filter、split toggle時の暗黙merge、handler独自runtime clear、focus / stale resultを追記 |
| `docs/components/tauri_viewer/README.md` | global dataとpane-local groupの責務、`splitView.ts` / App / CSSの役割を更新 |
| `docs/components/tauri_viewer/basic_design.md` | `SplitViewState` / `PaneState` data model、local close / eviction、move、split保持を更新 |
| `docs/components/tauri_viewer/detail_design.md` | `DocumentPane`が「同じglobal tabsを受ける」という記述を、Appで解決済みのpane-local ordered viewを受ける契約へ置換 |
| `docs/components/tauri_viewer/interface_spec.md` | `Tab close`のglobal削除記述をlocal close + last-reference evictionへ置換。`## TabStrip 表示`の同一global collection / global open順をpane-local所属・挿入順へ節単位で書換え。`## Split View 表示`のsecondary隣接自動選択とactive secondary→primary引継ぎを、group保持・初回empty・hidden secondary案内へ節単位で置換 |
| `docs/rules/development_workflow.md` | 現行split toggle確認の「secondary隣接選択 / active secondary引継ぎ」を§17-2 / 9の初回empty・group保持・primary empty回復へ置換。現行close確認を§17-3 / 5のlocal close・shared membership・last-reference evictionへ置換し、move / same document / keyboard / focus項目を追加 |

`interface_spec.md`と`development_workflow.md`は旧仕様への追記ではなく、TODO-2026-006で確定したglobal TabStrip baselineを本機能の承認済みpane-local group仕様へ明示的に置換する。相反する合否基準を残さない。

## 16. テスト設計

### 16.1 既存testの移行方針

- `createInitialSplitViewState(activeTabId)`を使う`splitView.test.ts` 9箇所と`paneRuntime.test.ts` 9箇所は、引数なしinitial stateとgroup membership込みの共通test helperへ書き換える。
- `enable-split` / `disable-split`へglobal ordered IDsを渡す`splitView.test.ts` 13箇所と`paneRuntime.test.ts` 3箇所はpayloadを削除する。
- split width、ratio、keyboard、pane / tab / revision guard、shared / pane runtime合成testは意味を維持して新state helper上へ移す。
- secondary隣接自動選択、active secondary→primary引継ぎ、group未登録IDを直接`select-tab`するtestは旧仕様のため削除し、secondary group保持、nonmember throw、`open-tab`で同じIDを両groupへ登録するtestへ置換する。
- test file内に`stateWithPaneTabs({ primary, secondary, activePaneId?, mode? })`相当の共通helperを置き、actionの積み上げでfixture意図を不透明にしない。

### 16.2 `splitView.test.ts`

- empty single初期stateとprimary initial add。
- open-tabの末尾追加、same group dedupe、other group shared ID追加、anchor設定。
- local orderでのselect、nonmember select / invalid secondary activation throw。
- close activeの右→左→null fallback、close non-activeのselection維持、他group不変。
- reference setとunreferenced判定。shared IDの片pane closeではreferencedのまま。
- move destination absent / present、active / non-active source、source last tab、destination selection / active pane、pending clear。
- singleでmove拒否、same pane move拒否、nonmember move拒否。
- disable / enableで両group order / active保持、activePane primary、secondary pending clear。
- root resetでmode / ratio維持、両group clear。
- pending保持中のopen / select / active close / non-active close / moveで§6.2 invariant 3が維持される。
- duplicate ID、active nonmember、nonempty group + null active、single secondary open / select / close / activate / moveなどinternal invariantの拒否。
- generic group resolverのlocal順解決とmissing ID throw、reference set導出。
- 既存split width bounds / pointer ratio / keyboard testsの回帰。

### 16.3 `paneRuntime.test.ts`

- move後source captured result拒否、destination result受理。
- secondary selection保持中もsingle modeではresult拒否。
- split再有効化とrevision一致時だけsecondary result受理。
- same document両groupでpane-local errorが混線しない。
- shared loading / rendering / error precedenceの回帰。

### 16.4 既存test / build

```bash
cd markdown-viewer-tauri
npm test -- --run
npm run build

cd src-tauri
cargo fmt -- --check
cargo check
cargo test
```

Rust差分は予定しないが、frontend / Tauri境界とsecurity回帰のためRust check / testも実行する。`git diff --check`も必須とする。

## 17. ユーザ動作確認観点

1. singleで複数documentを開き、primaryだけに追加されlocal順で表示される。
2. 初回split onでsecondaryがemptyとなり、secondaryをactiveにしてExplorer / relative linkから開くとsecondaryだけが増える。
3. primary / secondaryの追加、activate、closeが他pane TabStripを意図せず増減・選択しない。
4. 同じMarkdown / HTML pathを両paneへopenし、global read / PlantUML cache共有とMermaid / iframe runtime分離を確認する。
5. shared tabを片paneでcloseしても他pane表示が維持され、最後のmembershipをcloseした時だけdocumentが全体から消える。
6. primaryからsecondary、secondaryからprimaryへpointerでmoveし、source fallback、destination selection、active pane、focus、StatusBar / ErrorBanner、Explorer highlightを確認する。image viewer表示中はorigin selectionが変わるmoveで閉じ、identity不変のdestination viewerは維持されることも確認する。
7. keyboardだけでtab activate、move、closeへ到達し、accessible nameとfocus indicatorを確認する。
8. destinationに同documentが既にあるmoveでduplicateが生じず、destinationの既存順を維持する。
9. split offでprimaryを表示しsecondary groupを保持し、split再有効化でsecondary順 / active tabが復元される。primary empty / secondary nonemptyでsplit offした場合はhidden件数と`Enable Split View`案内が表示され、再有効化で復帰する。
10. Reload、relative anchor、root change、loading / error中close / moveでstale結果が混線しない。
11. same Mermaid、Markdown + HTML、HTML + HTMLでready / timeout / external openとsecurity boundaryを確認する。
12. single / split separator、image viewer、MenuBar / Settings / Recent Folders、responsive widthの既存回帰を確認する。split時のtabは160px minimumでmove / close controlと判別可能なellipsis名を保ち、`min(220px, 32vw)`のviewport基準とpane内horizontal overflowが維持される。

## 18. リスクと軽減策

| リスク | 軽減策 | follow-up条件 |
| --- | --- | --- |
| global dataとgroup IDの不整合 | reducer invariant、missing ID throw、reference helper unit test | 実運用で不整合が出た場合はbugfix起票 |
| local closeでinvisible cacheが残る | 次stateの両group reference setからatomicにevict | cache量が問題化した場合は計測TODO |
| move中のasync result混線 | generic stale status effect、pane / tab / revision guard、DOM connection checkへ判定を一本化 | engine固有raceはbugfix |
| split off中secondary cacheがmemoryを使う | 最大2group、document dataは共有、session-only | 大規模documentで問題ならsuspend / evictionを別設計 |
| split off中primaryが空でsecondaryだけ非空 | primary empty stateへhidden件数と`Enable Split View`案内を表示 | UX評価でより直接的な復帰導線が必要なら別TODO |
| inline buttonでtab幅が狭い | split時だけminimum 160px、`min(220px, 32vw)`とhorizontal overflowは維持 | compact tab / overflow menuはUX follow-up |
| move後focus先mount timing | requestAnimationFrame後にpane-scoped ID、欠落時だけdestination pane regionへfocus、manual keyboard test | WebView固有問題はfocus coordinatorを別途設計 |
| initial secondary emptyが既存操作と異なる | docs / manual scenarioで明示し、暗黙ownershipを排除 | UX評価でexplicit seed操作が必要なら別TODO |
| same HTML destination既存時の不要remount | stable pane + tab + revision keyとdedupe transition | lifecycle差異はmanual fixtureで検証 |

## 19. Follow-up

- `TODO-2026-025`: primary / secondary group modelを維持した上下・左右split方向対応。
- drag and drop、reorder、pin、bulk move / close、group persistenceは利用価値が確認された場合だけ別TODO化する。
- Avaloniaへ反映する場合はNativeWebView lifecycleとViewModel collection境界に合わせ、機械的移植しない。

## 20. レビュー観点

- global document dataとpane-local ordered ID referencesのinvariantがopen / close / move / root全経路で閉じているか。
- local closeとunreferenced cache evictionが同じID両group、loading中close、最後のmembershipで一貫するか。
- moveがsource fallback、destination dedupe / selection、active pane、pending navigation、runtime、focusをatomically扱えるか。
- split off / onでgroup ownershipを暗黙変更せず、hidden secondaryのasync resultを拒否できるか。
- reducer / App / DocumentPane / TabStrip / paneRuntimeの責務分割に重複やsilent fallbackがないか。
- HTML security、Mermaid queue、PlantUML cache、image viewer identityを弱めていないか。
- keyboard / ARIA / focus設計がinline move controlとpane-local roving orderを網羅するか。
- unit testと手動matrixがTODOの受け入れ条件、境界値、回帰を追跡できるか。
