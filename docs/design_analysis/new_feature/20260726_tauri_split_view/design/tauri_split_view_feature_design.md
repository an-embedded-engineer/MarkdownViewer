# Tauri Split view 導入 設計

## 1. 背景・要求・完了条件

`TODO-2026-006` は、Tauri 版 Markdown Viewer の単一 preview workspace を、single view と左右 2 pane split view の間で切り替えられるようにする新機能である。利用者は同一 root 内の仕様書、設計書、Markdown、trusted HTML、Mermaid、PlantUML を並べ、タブ切替による文脈喪失を減らしながら比較できる。

先行する `TODO-2026-005` は `OpenDocumentTab[]` と単一 `activeTabId` を導入し、文書データと表示選択を分離できる土台を作った。`TODO-2026-017` は同じ tab model を Markdown / HTML の discriminated union へ拡張した。本変更はこの tab collection を文書データの正本として維持し、表示 layout だけを pane-aware state へ置き換える。

完了条件は `docs/todo/todo.md` の TODO-2026-006 を正とする。設計上は特に次を満たす。

- View menu から single / 左右 2 pane split を切り替えられる。
- primary / secondary pane は同一 root の open tab を独立に選択でき、異なる文書を同時表示できる。
- Explorer、Reload、relative Markdown link、ErrorBanner、StatusBar は active pane を対象とする。
- tab close、root 変更、split on / off で無効な tab ID を残さない。
- Markdown、Mermaid、PlantUML、trusted HTML、anchor、scroll、loading / error、image viewer の pane 間混線を防ぐ。
- HTML sandbox / CSP / root boundary / message policy と Markdown `html: false` を維持する。
- pointer と keyboard の両方で pane 選択と separator 操作ができる。

## 2. 対象ユーザー、ユースケース、操作導線

### 2.1 対象ユーザー

- 同一 root 内の2文書を並べて比較する利用者。
- Markdownの説明と Mermaid / PlantUML の図、または Markdown と trusted HTML の描画結果を同時に参照する利用者。
- mouse / trackpad だけでなく keyboard と支援技術から tab / pane を操作する利用者。

### 2.2 基本導線

1. 利用者が複数文書を open tab として開く。
2. View menu の `Split View` を有効にする。
3. primary pane は現在の single view 選択を維持し、secondary pane は別の open tab があれば最も近い別 tab を初期選択する。別 tab がなければ未選択とする。
4. 各 pane の TabStrip から表示する tab を選ぶ。両 pane が同一 tab ID を参照することも許可するが、`OpenDocumentTab` 自体は複製しない。
5. pointer down、focus、TabStrip 操作のいずれかで pane を active にする。Explorer、Reload、relative Markdown link、StatusBar / ErrorBanner は active pane に従う。
6. pane separator を pointer drag、ArrowLeft / ArrowRight、Home / End で操作して左右幅を変更する。
7. `Split View` を無効にすると、その時点の active pane の選択を single view の primary pane へ引き継ぐ。

### 2.3 tab と pane の関係

- tab collection は root 内で path 一意の global collection とする。
- 各 pane は global collection を同じ順序で表示する TabStrip と、pane 固有の selected tab ID を持つ。
- tab を pane へコピー・移動する model は導入しない。TabStrip から選ぶ操作は同じ tab identity への参照を切り替えるだけである。
- tab close は global close であり、両 pane の TabStrip から当該 tab を削除する。
- tab switch 後の scroll 位置保存は導入しない。split 表示中に同時表示されている2つの DOM は、それぞれ独立した scroll container を持つ。

## 3. 対象範囲と非対象

### 3.1 対象範囲

- typed split layout state、active pane、pane ごとの selected tab / pending navigation。
- View menu の split toggle。
- 左右2 pane grid、pane separator、active pane 表示。
- pane-aware TabStrip、DocumentPane、Markdown / HTML preview runtime。
- Explorer、Reload、relative link、tab close、root change、StatusBar / ErrorBanner、image viewer の統合。
- split state と幅 policy の frontend unit test。
- Tauri component docs、architecture docs、開発・手動確認ルール、利用者向け README の更新。

### 3.2 非対象

- 3 pane 以上、上下分割、任意 split tree、nested split。
- drag and drop、pane 間 move command、tab reorder、pin。
- tab / pane / split ratio の再起動後復元。
- tab switch 後の scroll position 復元。
- root 外 document、編集、未保存状態、pane ごとの theme。
- Avalonia 実装。`TODO-2026-011` で Tauri UX 評価後に扱う。
- Rust command、custom protocol、capability、CSP の変更。

## 4. 最小提供範囲、初期値、後続拡張

最小提供範囲は左右2 pane固定、各 pane に同じ global tab collection の TabStrip、1本の可変 separator、active pane に対する既存 command routing とする。

初期値:

| state | 初期値 |
| --- | --- |
| mode | `single` |
| active pane | `primary` |
| primary tab | 現行 single view の active tab |
| secondary tab | split on 時に primary と異なる最も近い tab。なければ `null` |
| requested split ratio | `0.5` |
| split ratio persistence | session memory のみ |

後続拡張は `TODO-2026-007` の Tauri UX 評価で必要性を判定する。上下分割、3 pane 以上、drag and drop、layout persistence を先取りする generic split tree は作らない。一方、pane ID と pane selection を tab data から分離するため、将来 pane 数を増やす場合も `OpenDocumentTab` の schema を変更せず拡張できる。

## 5. 採用案・不採用案・判断理由

### 5.1 採用: global tab data + pane-local selection

```text
OpenDocumentTab[]                 SplitViewState
  tab-1 Markdown cache      <---- primary.activeTabId = tab-1
  tab-2 HTML preview URL    <---- secondary.activeTabId = tab-2
  tab-3 PlantUML result           activePaneId = secondary
                                  mode = split
```

文書 read と PlantUML render の結果は tab 単位で共有し、pane は表示対象と DOM runtime だけを所有する。同一 tab を両 pane で選んでも filesystem read や PlantUML command を重複実行しない。

### 5.2 採用: 各 pane に TabStrip を置く

各 pane が自分の selected tab を直接示し、keyboard focus と `aria-controls` の対応を局所化できる。単一の global TabStrip + pane assignment command より操作結果が見えやすく、drag and drop を導入せず要件を満たせる。

### 5.3 採用: pane runtime を tab load state から分離

`OpenDocumentTab.loadState` は document open と共有 PlantUML render の状態を表す。Mermaid DOM変換、HTML iframe ready handshake、pane固有 anchor、DOM error は `PanePreviewStatus` と pane state で管理する。

同じ HTML tab を両 pane へ表示した場合、2つの iframe は別々に handshake する。最初に ready になった iframe が global tab を ready にしてしまう旧方式は採用しない。Mermaid error も失敗した pane だけへ帰属させる。

### 5.4 採用: App 所有の Mermaid 直列 queue

Mermaid は global configuration を使うため、2 pane の `mermaid.run()` を無制御に並行実行しない。`App` の `useRef(Promise.resolve())` が queue を所有し、DocumentPane は `{ paneId, tabId, revision, theme, nodes }` を渡して処理を enqueue する。実行前後に DOM connection と pane/tab/revision を再確認し、stale task は結果を適用しない。

module-global queue は test / remount /複数window間で所有者が曖昧になるため作らない。

### 5.5 採用: 専用 `splitView.ts` の純粋 policy

layout transition と幅計算を `App.tsx` の event handler に散らさず、typed action と純粋関数を `src/splitView.ts` に集約する。React component state、DOM、Tauri API は同moduleへ持ち込まない。

Explorer幅 policyとの数式共通化は行わない。Explorerはpreview予約幅を確保する外側pane、split separatorは残りpreview workspaceを2分する内側layoutで、最小値と狭幅時の縮退規則が異なる。pointer capture / keyboard eventのReact配線だけは既存Explorer実装のpatternを踏襲する。

### 5.6 不採用案

| 案 | 不採用理由 |
| --- | --- |
| tabごとにpane IDを埋め込む | 1 tabを両paneで参照できず、document identityとlayout責務が混ざる |
| paneごとにtab collectionを複製する | read/cache/errorの正本が二重化し、同一path重複とclose同期が発生する |
| single用stateを残してsplit用stateを追加する | `activeTabId` / `pendingNavigation` の二重経路になり同期漏れを生む |
| global TabStrip + move-to-pane command | 最小操作でpaneごとの選択が見えず、assignment UIが追加で必要になる |
| CSSだけで同じpreview DOMを複製する | ref、Mermaid、HTML handshake、anchor、image viewerを分離できない |
| Mermaidをpaneごとに並行実行する | global initialize / generated ID / DOM変換の競合を制御できない |
| arbitrary split treeを先に作る | 2 pane要件を超える状態・focus・resize complexityを持ち込む |
| 狭幅時に自動でsingleへ戻す | window resizeだけで利用者のmodeが変わるため不意な状態変更になる |

## 6. Before / After

| 観点 | Before | After |
| --- | --- | --- |
| layout | single previewのみ | single / 左右2 pane |
| 表示選択 | global `activeTabId` | paneごとの `activeTabId` + global active pane |
| navigation | global `pendingNavigation` | paneごとの pending navigation |
| preview ref | 単一 `previewRef` | DocumentPaneごとの ref |
| Mermaid | active tab 1件のeffect | App-owned queueで最大2 paneを直列処理 |
| HTML ready/error | tab global state | iframe/paneごとのruntime state |
| error / status | global active tab | active paneのtab + pane runtime |
| scroll | 1 container | paneごとに独立container |
| TabStrip ID | `tab-<id>` / `document-preview` | pane prefix付きで一意 |

## 7. 型と状態モデル

### 7.1 split layout

```ts
export type PaneId = "primary" | "secondary";
export type ViewMode = "single" | "split";

export type PendingPaneNavigation = {
  tabId: string;
  anchor: string;
};

export type PaneState = {
  activeTabId: string | null;
  pendingNavigation: PendingPaneNavigation | null;
};

export type SplitViewState = {
  mode: ViewMode;
  activePaneId: PaneId;
  primary: PaneState;
  secondary: PaneState;
  requestedSplitRatio: number;
};
```

`SplitViewState` は `App` の唯一の表示選択stateとし、旧 `activeTabId` / `pendingNavigation` は削除する。`activeTab`、Explorer selected path、StatusBar file、ErrorBannerは `tabs + splitViewState` から導出し、重複stateを持たない。requested ratioはsession中の利用者指定を保持し、実幅clamp値をstateへ書き戻さない。

### 7.2 pane preview runtime

```ts
type PanePreviewPhase =
  | "idle"
  | "rendering-mermaid"
  | "loading-html"
  | "ready"
  | "error";

type PanePreviewStatus = {
  tabId: string;
  revision: number;
  phase: PanePreviewPhase;
  errorMessage: string | null;
};
```

`Record<PaneId, PanePreviewStatus | null>` をAppで保持する。callback適用時は `paneId + tabId + revision` と現在selectionを照合する。tab switch、Reload revision更新、tab close、root成功、pane unmount時にstale statusをclearする。

shared tab stateとpane runtimeの表示優先順位:

1. app config error
2. root operation error
3. active tabのdocument open / PlantUML error
4. active paneのMermaid / HTML / external-open error

loading priority:

1. root loading
2. app config operation
3. active tab document loading
4. active tab PlantUML rendering
5. active pane HTML handshake
6. active pane Mermaid rendering
7. ready

### 7.3 split state action

`splitView.ts` は少なくとも次のactionを扱う。

- `select-tab`: paneをactiveにし、tab IDと任意anchorを設定する。
- `activate-pane`: selectionを変えずactive paneだけを変更する。
- `enable-split`: primaryを維持し、別tab候補をsecondaryへ設定する。
- `disable-split`: active paneのselectionをprimaryへ移し、active paneをprimaryにする。
- `remove-tab`: closed IDを参照するpaneだけ、既存close規則のfallback IDへ置換する。
- `reset-root`: modeとrequested ratioは維持し、両pane selection/navigationをclear、active paneをprimaryへ戻す。
- `consume-navigation`: pane / tab / anchor一致時だけpendingをclearする。
- `set-requested-ratio`: finiteかつ0より大きく1より小さいratioだけを保存する。

存在しないpane IDや有限でないratioなどprogramming errorはthrowし、不正入力をfallbackで補正しない。close済みasync completionやnavigation consumeのような正当なstale eventはguardでignoreする。

## 8. 状態遷移とデフォルト動作

### 8.1 split on

1. current primary selectionを維持する。
2. primaryのtabに隣接するopen tabから異なるIDをsecondary初期値として選ぶ。右隣、なければ左隣、なければ`null`。
3. mode=`split`、activePaneId=`primary`。
4. secondary pending navigation / runtimeはclearする。

### 8.2 split off

1. active paneのselectionとpending navigationをprimaryへ引き継ぐ。
2. secondaryをclearする。
3. mode=`single`、activePaneId=`primary`。
4. secondaryのDocumentPane、iframe、Mermaid adapterをcleanupする。

split offでsecondary HTMLをprimaryへ引き継ぐ場合、pane ownershipが変わるためiframe remountと新しいready handshakeを許容する。theme、Explorer resize、pane resize、active pane変更だけではiframe keyを変えずreloadしない。

### 8.3 Explorerと新規tab

- Explorer選択はactive paneを対象に`openOrActivateTab(paneId, path)`を呼ぶ。
- pathがopen済みならcollectionを増やさず、そのpaneだけを当該IDへ切り替える。
- 未openならloading tabをglobal collectionへ追加し、active paneへ選択する。
- 他方paneのselectionは変更しない。

### 8.4 Reload

- root tree scanは従来どおりglobal操作とする。
- scan成功後、active paneのselected tabだけrevisionを増やして再読込する。
- 同一tabが両paneに表示されている場合は共有tab revisionが変わるため両paneが新しい内容を描画する。pane runtimeは両方clearし、各paneでMermaid / HTML handshakeを再実行する。
- scan失敗時はroot、tabs、split state、pane DOMを維持する。

### 8.5 relative Markdown link / anchor

- click handlerは発生元pane ID、発生元tab ID、発生元preview refを受ける。
- `#anchor` は発生元paneのDOMだけをscrollする。
- relative Markdown linkは同じpaneで既存tabをactivateまたは新規tabをopenし、pending navigationも同じpaneへ保存する。
- pending anchorはpane + tab + revision一致後に80ms timerで消費し、他方paneをscrollしない。

### 8.6 tab close

- close対象をglobal collectionから1回だけ削除する。
- close前indexに対し右隣、なければ左隣をfallbackとする既存規則を維持する。
- closed IDを選択していた全paneだけfallbackへ移す。他tabを表示するpaneは維持する。
- closed IDに属するpending navigation、pane runtime、image viewerをclearする。
- 最後のtab closeでは両paneを未選択にする。split mode自体は維持し、両paneにempty stateを表示する。
- closeを起動したTabStripは、そのpaneのfallback tab、なければpane regionへfocusを戻す。

### 8.7 root変更

- root scan成功時だけtabsをclearし、`reset-root`を適用する。
- split modeとrequested split ratioはsession preferenceとして維持する。
- 新rootの初期documentはprimaryへopenする。secondaryは未選択とし、利用者が比較対象を選ぶ。
- root scan失敗時は旧root、tabs、layout、runtimeをすべて維持する。

## 9. React component と責務分割

### 9.1 App

- root / tabs / settings / split layout / pane runtimeの正本。
- Tauri command呼び出し、tab load、global close、root change。
- active paneからExplorer selected path、StatusBar、ErrorBannerを導出する。
- Mermaid queueをApp instanceの`useRef`で所有する。
- split / Explorer separatorのpointer stateを別refで所有する。

### 9.2 `DocumentPane`

React componentとして `App.tsx` 内に置く。React hookを所有するframework componentであり、モジュール直下functionの原則に対する明示的例外である。純粋policyは持たせない。

責務:

- pane固有preview refとregion markup。
- pane固有TabStripとpreviewの結合。
- Markdown click / anchor / image viewer eventの発生元pane付与。
- Mermaid task enqueue、image viewer DOM adapterのdecorate / cleanup。
- HTML iframeのpane-local ready / error callback。
- focus / pointer captureでactive paneを通知する。

trusted HTML iframe内のeventは親React treeへbubbleしないため、iframe要素自身の`focus` callbackでもpaneをactiveにする。keyboard / pointerでiframe browsing contextへ入った時にfocus通知できることをmacOSで確認し、platform差で通知されない場合もexternal-link bridge受信時は発生元paneをactiveにする。cross-origin iframe DOMへ直接accessする方式は採らない。

### 9.3 `TabStrip`

`paneId`、pane selection、preview IDをpropsで受ける。同じglobal tabsを表示するがDOM IDを次のようにpane scopeへ変更する。

- tab: `tab-${paneId}-${tab.id}`
- preview: `document-preview-${paneId}`
- tablist label: `Primary pane open documents` / `Secondary pane open documents`

pane selectionが`null`でもtabsが存在する場合、先頭tabをroving focus target (`tabIndex=0`, `aria-selected=false`) としてkeyboardから到達可能にする。選択中tabとそのclose buttonだけを通常のTab順へ含める既存契約は維持する。

### 9.4 `splitView.ts`

- split state transition。
- adjacent tab選択。
- requested ratioから実幅 / ARIA boundsを計算するwidth policy。
- keyboard keyから次ratioを計算するpolicy。

React、DOM、Tauri、Mermaidへ依存しない。`splitView.test.ts`で直接検証する。

### 9.5 既存module

- `documentPolicy.ts`: source / opaque origin / tab / revision / ready / activation / duplicate / scheme検証を維持する。`HtmlPreview`は自身のpaneで現在選択されているtab ID / revisionをcontextへ渡し、active paneか否かをsecurity条件にしない。
- `imageViewer.ts`: transform / DOM adapter policyを維持する。App側requestに`paneId`を交差型で付与し、moduleへsplit依存を持ち込まない。
- `explorerPane.ts`: outer Explorer width policyを維持し、split widthとの不自然な数式共通化をしない。

## 10. Mermaid、PlantUML、Markdown DOM

### 10.1 Mermaid

1. DocumentPane mount / tab revision / theme / PlantUML結果変更時にpane ref内の`.mermaid` nodesを収集する。
2. pane runtimeを`rendering-mermaid`へする。
3. App queueへtaskをenqueueする。
4. task開始時にcaptured pane/tab/revisionが現在stateと一致し、nodesがconnectedの場合だけ、captured themeで`mermaid.initialize`して`mermaid.run({ nodes })`を実行する。
5. 成功時に同paneのimage viewer adapterを再decorateし、pane runtimeをreadyへする。
6. 失敗時は同pane runtimeだけerrorへする。
7. cleanup時はtaskをcancel扱いにし、adapterとlistenerを解除する。実行中Promise自体を中断するfallbackは追加せず、結果guardでstale適用を防ぐ。

### 10.2 PlantUML

- source抽出、Rust command、結果cacheはtab単位のまま変更しない。
- 1 tabのPlantUML commandは1回だけ実行し、両paneは同じSVG結果を各DOMへ描画する。
- tab revision guardを維持する。
- pane resize / themeだけでPlantUML commandを再実行しない。

### 10.3 Markdown / image viewer

- 各paneのMarkdownPreviewは固有refを持ち、`dangerouslySetInnerHTML` memoizationを維持する。
- theme / revisionによるkey更新以外のApp renderでは描画済みMermaidをsourceへ戻さない。
- image viewer requestには発生元`paneId + tabId + revision`を保持する。
- modal表示中は既存どおりbackgroundをinertにする。
- keyboard起点は発生元button、pointer起点は発生元paneのpreviewへfocusを戻す。別paneのactivateだけでviewerを閉じる必要はないが、発生元paneのtab/revisionが変わった場合は閉じる。

## 11. trusted HTML とセキュリティ境界

- 各HtmlPreviewは固有iframe ref、ready flag、timeout、duplicate external-open guardを持つ。
- `open_document`がvalidated `previewUrl`を返した時点でshared tabのdocument loadを`ready`にし、iframe mount後の`loading-html` / ready / timeoutはpane runtimeだけで管理する。旧`markHtmlReady` / `markHtmlError`によるglobal tab更新は削除する。
- `event.source` はそのpaneのiframe `contentWindow` と完全一致させる。
- `origin="null"`、selected tab ID、revision、message shape、ready、transient activation、duplicate、HTTP(S) schemeの既存policyをすべて通す。
- 非active paneからのuser clickも、そのiframe自身にtransient activationがありsource検証を通るため許可する。active paneはpointer/focus captureで同時に更新されるが、security境界には使わない。
- ready / timeout / external-open failureはpane runtimeへ反映し、他paneの同じtabをerrorにしない。
- iframe keyは`paneId + tabId + revision`とする。theme、active pane、split ratio、Explorer widthでは変更しない。
- `sandbox="allow-scripts"`、CSP、custom protocol、root boundary、capabilityは変更しない。
- HTML sourceをReact stateへ返すfallback、`allow-same-origin`、remote capability、external network sourceは追加しない。

## 12. layout と separator

### 12.1 DOM

```text
workspace
├── Explorer
├── ExplorerSeparator
└── PreviewWorkspace
    └── PreviewGrid (single | split)
        ├── DocumentPane primary
        ├── SplitSeparator (split only)
        └── DocumentPane secondary (split only)
```

DocumentPaneは `role="region"` と `aria-label="Primary document pane"` / `aria-label="Secondary document pane"` を持つ。active paneは`data-active="true"`とaccent borderで示し、色だけでなくpane label / focus stateからも識別できる。

### 12.2 幅 policy

- separator幅: 6px。
- preferred pane minimum: 240px。
- requested ratio初期値: 0.5。
- keyboard step: 16px。
- preview workspaceの実幅をResizeObserverで取得する。
- effective minimumは `min(240, floor((workspaceWidth - 6) / 2))` とし、狭いwindowでは左右を等幅まで縮める。
- primary実幅boundsは `[effectiveMinimum, workspaceWidth - 6 - effectiveMinimum]`。
- requested ratioは実幅clampとは別に保持し、狭幅で一時clampされても再拡大時に利用者のratioへ戻す。
- Home / Endはdynamic min / max、ArrowLeft / ArrowRightは16px移動とする。
- `aria-valuemin` / `aria-valuemax` / `aria-valuenow` はclamp後px値を公開する。

極端に狭くboundsが同値になる場合はseparator操作で値を変えないが、modeを自動変更しない。overflowは各pane内のtable / code / diagram / iframeへ閉じ込め、app shell全体へ移さない。

### 12.3 pointer

Explorer separatorと同じpointer capture lifecycleを使うが、resize stateは`SplitResizeState`として分離する。iframe上へpointerが移動してもcaptureによりdragを継続する。resize中はapp shellへ`split-resizing` classを付け、全descendantのcursorとuser-selectを固定する。

## 13. accessibility とfocus

- View menuの`Split View`は`role="menuitemcheckbox"`と`aria-checked`を持つ。
- paneへpointer downまたはfocusが入った時、そのpaneをactiveにする。
- Tab順でprimary TabStrip、separator、secondary TabStripへ到達できる。
- separatorは`role="separator"`、`aria-orientation="vertical"`、両pane IDの`aria-controls`、min/max/nowを持つ。
- active pane outline、tab `aria-selected`、unique `aria-controls` / `aria-labelledby`を維持する。
- keyboardによるtab switchは各pane内でArrowLeft / ArrowRight / Home / Endを使う。隣paneのselectionは変えない。
- tab close後は操作元paneのfallback tabへfocusする。最後のtabならpane regionへ戻す。
- pane local loadingはactive paneだけ`aria-live="polite"`、errorはactive paneのglobal ErrorBanner (`role="alert"`)を正本とし、non-active paneでは視覚表示だけにして二重読み上げを避ける。
- modal表示中のbackground inert、Settings / image viewer focus trapを維持する。

## 14. error handling と失敗時動作

| 失敗 | 動作 |
| --- | --- |
| root scan失敗 | 旧root / tabs / layout / DOMを維持しroot error表示 |
| document open失敗 | global tab error。選択している各paneでerror表示 |
| PlantUML失敗 | tab errorとdiagram単位errorを共有し、他tabへ混線させない |
| Mermaid失敗 | 発生pane runtimeだけerror。他paneの同tabは維持 |
| HTML handshake timeout | 発生iframe/paneだけerror。sandboxを緩和するfallbackなし |
| external URL open失敗 | 発生paneだけerror。unsupported schemeは既存policyでopenしない |
| closed / reloaded tabのasync完了 | pane + tab + revision guardでignore |
| invalid layout programming input | pure policyがthrow。暗黙fallbackで隠さない |
| split width計測前 | 50/50 CSS fallback。計測後にtyped policyの値へ収束 |

pane errorが発生しても他paneの閲覧とtab選択を妨げない。global App errorは既存優先順位どおり全体に表示する。

## 15. 互換性・migration・単一路線

- `OpenDocumentTab`、Rust command response、settings JSON、Recent Folders、custom protocol URLは変更しない。
- `activeTabId` / `pendingNavigation` を互換用に残さず、`SplitViewState`へ置換する。
- single modeも同じDocumentPane / SplitViewState経路で描画し、旧single専用handlerを並存させない。
- persisted schema変更がないためmigrationは不要。
- root変更時のtab破棄、path一意、Reload revision、tab close隣接規則は維持する。
- tab scroll position非保持という既存制約は維持する。

## 16. 影響範囲

| 対象 | 変更 |
| --- | --- |
| `markdown-viewer-tauri/src/App.tsx` | split state統合、DocumentPane、pane-aware routing、Mermaid queue、HTML/image runtime、MenuBar |
| `markdown-viewer-tauri/src/App.css` | preview grid、pane、active state、separator、狭幅、cursor |
| `markdown-viewer-tauri/src/splitView.ts` | typed transition / width policy（新規） |
| `markdown-viewer-tauri/src/splitView.test.ts` | state / width / close / root / navigation test（新規） |
| `documentPolicy.ts` | 原則変更なし。props命名調整が必要な場合も判定契約は不変 |
| `imageViewer.ts` | 原則変更なし。split依存はApp側交差型へ閉じ込める |
| Rust / Tauri config | 変更なし |
| component / architecture / workflow docs | user操作、状態、制約、検証を同期 |

## 17. 恒久ドキュメント更新予定先

- `README.md`: Tauri feature概要と比較表。
- `markdown-viewer-tauri/README.md`: `View > Split View` の利用方法、制約、keyboard操作。
- `docs/rules/project_overview.md`: Tauri 2 pane表示の概要。
- `docs/architecture/overview.md`: split stateとpreview flow。
- `docs/architecture/code_patterns.md`: shared tab data / pane runtime / Mermaid queue pattern。
- `docs/architecture/common_pitfalls.md`: 複数pane Mermaid並行実行、HTML handshake、duplicate DOM ID、iframe上separator drag。
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`: split手動確認matrix。

ADRは追加しない。今回の判断はTauri component固有であり、複数案件に再利用される横断的採用判断にはまだ達していない。Avalonia反映仕様の確定後に横断判断が成立した場合、`TODO-2026-007` で起票要否を再評価する。

## 18. テスト設計

### 18.1 frontend unit test

`splitView.test.ts`:

- single初期state。
- split on時のsecondary隣接tab、1 tab時`null`、active primary。
- paneごとのselect / pending navigation / consume guard。
- split off時にactive secondary selectionをprimaryへ引継ぐ。
- close active / non-active / 両pane同一tab / 最後のtabのfallback。
- root resetでmode / ratio維持、selection clear。
- invalid / stale actionのthrowまたはignore契約。
- ratio 0.5、pointer ratio、16px key、Home / End。
- 通常幅と狭幅のdynamic bounds、requested ratio復元。

既存test:

- `documentPolicy.test.ts`: HTML source / origin / revision / activation contractの回帰。
- `imageViewer.test.ts`: transform / activation / intrinsic size回帰。
- `explorerPane.test.ts`: outer pane resize回帰。

### 18.2 build / backend regression

```bash
cd markdown-viewer-tauri
npm test -- --run
npm run build

cd src-tauri
cargo check
cargo test
```

Rust差分は予定しないが、frontend contractとbundle境界の回帰確認として既存Rust testを実行する。

### 18.3 static check

```bash
git diff --check
```

## 19. ユーザ動作確認観点

1. View menuからsplit on / offし、primary維持、secondary初期選択、active secondaryからsingleへ戻る挙動を確認する。
2. primary / secondaryで別Markdownを選び、各paneを独立scrollする。
3. pointer / focusでactive paneを変え、Explorer、Reload、relative Markdown link、anchor、StatusBar、ErrorBannerが対象paneだけへ反映されることを確認する。
4. active / non-active tab close、両paneで同一tab、最後のtab、root変更成功 / 失敗でselectionが復旧することを確認する。
5. `sample_docs/plantuml.md` 等を使い、Mermaid + PlantUMLを両paneで表示し、theme / window / Explorer / split resize後もMermaid sourceへ戻らずPlantUML commandを不要に再実行しないことを確認する。
6. Markdown + trusted HTML、HTML + HTMLを表示し、各iframe handshake、fragment、HTTP(S) external open、Theme非reload、resize非reloadを確認する。
7. `sample_docs/html_fixture/malicious.html` でroot外resource、external network、popup、form、download、Tauri IPCが引き続き拒否されることを確認する。
8. 両paneの通常画像 / Mermaid / PlantUMLからimage viewerをpointer / keyboardで開き、close時に発生元paneへfocusが戻ることを確認する。
9. split separatorをpointer、ArrowLeft / ArrowRight、Home / Endで操作し、iframe上でもdrag継続、ARIA値、focus維持、狭幅 / 再拡大を確認する。
10. Tabだけで両paneのTabStripとseparatorへ到達し、tab role / active pane indicator / focus indicator / unique controls関係を確認する。
11. single modeで既存Multi-tab、Markdown / HTML、MenuBar / StatusBar、Settings、Recent Folders、Explorer resize、image viewerが退行しないことを確認する。

## 20. リスクと軽減策

| リスク | 軽減策 | follow-up条件 |
| --- | --- | --- |
| Mermaid global state競合 | App-owned直列queue、pane/tab/revision guard | queueでもengine固有不具合が出る場合はrenderer isolationを別TODO化 |
| 2つの巨大DOM / HTML iframeのmemory増加 | 最大2 pane固定、tab data / PlantUML cache共有 | UX評価で閾値やactive-only描画を検討 |
| 各paneに全tab表示して狭い | horizontal overflow維持、paneごとに到達可能 | dropdown / compact tabsはTODO-2026-007で評価 |
| narrow windowでpaneが読みにくい | dynamic equal minimum、modeを勝手に変えない | vertical splitは別TODO |
| close / root / Reloadのstate race | pure transition、tab revision、pane guard test | 再現するraceはbugfix起票 |
| duplicate HTML表示のhandshake混線 | iframe source一致 + pane runtime分離 | platform固有message問題はissue化 |
| focus復帰先unmount | connected確認後fallback pane region | screen reader実機問題はUX評価へ |
| separator dragがiframeで途切れる | pointer capture、resize class | platform差があればoverlay方式を再設計 |

## 21. follow-up

- `TODO-2026-007`: Tauri先行UX評価、tab density、split minimum、pane indicator、Settingsとの統合評価。
- `TODO-2026-011`: 確定仕様をAvaloniaのGrid / NativeWebView制約へ合わせて水平展開。
- 3 pane、上下分割、drag and drop、layout persistence、scroll復元は必要性が確認された場合だけ個別TODO化する。

## 22. レビュー観点

- global tab dataとpane-local runtimeの境界が一貫し、同一tabを両paneで表示しても状態が混線しないか。
- open / close / Reload / root / split toggleの全遷移で無効tab IDが残らないか。
- Mermaid queueの所有者、stale guard、cleanupが実装可能か。
- HTML message policyをactive pane条件で弱めたり、同一tabの別iframe sourceを誤受理したりしないか。
- TabStripを2つ描画してもDOM ID、ARIA、focus returnが一意か。
- Explorer幅policyとの過剰共通化を避けつつ、resize lifecycleの重複が許容範囲か。
- single modeに旧経路を残さず同じstate / componentへ収束できるか。
- unit testと手動matrixが受け入れ条件、失敗系、security回帰を追跡できるか。
