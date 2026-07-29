# Tauri TabStrip 状態表現・scroll・drag move UX改善 設計

## 1. 背景・要求・完了条件

`TODO-2026-026`は、pane-local tab group導入後のTauri版TabStripを、preview領域を圧迫しないcompactな1行表示へ更新し、状態識別、overflow時の操作継続、pointerによるpane間移動を改善する新機能である。

現行実装には次の基盤がある。

- `SplitViewState`はprimary / secondaryのordered tab IDsとactive tabを保持する。
- `move-tab` actionはsource removal / fallbackとdestination dedupe add / selectをatomicに更新する。
- `resolvePaneTabPresentationState`はshared load stateとpane-local HTML / Mermaid runtimeを`ready | loading | rendering | error`へ合成する。
- TabStripは58px固定高、横overflow、roving tab、ArrowLeft / ArrowRight / Home / End、矢印move button、close buttonを持つ。
- active tabのactivate buttonだけを`scrollIntoView`対象にしているため、右側のmove / close buttonが画面外に残る場合がある。
- Loading / Rendering / Errorのvisible textが2行目を占有し、状態とscrollbarの組み合わせがTabStripを過度に高く見せる。

完了条件は`docs/todo/todo.md`のTODO-2026-026を正とし、特に次を満たす。

- ready / active / loading / rendering / errorをcompactな1行tabとaccessible stateで識別できる。
- TabStripは通常、empty、状態遷移、overflowを通じて40px固定高を維持する。
- overflow中にactivateまたはfocusしたtab item全体がTabStripの表示範囲へ入る。
- pointer drag moveは既存の矢印moveと同じ`move-tab` action、focus、runtime guardを使い、cancel時はstateを変えない。
- Light / Dark、`prefers-reduced-motion`、single / split、狭幅、Markdown / HTML / Mermaid / PlantUMLを回帰させない。

## 2. 対象ユーザー、ユースケース、操作導線

### 2.1 対象ユーザー

- 多数のtabを左右paneに分け、preview面積を保ちながら状態を判別したい利用者。
- pointerでtabを直接反対paneへ移動しつつ、keyboardや支援技術でも同じ操作結果へ到達したい利用者。

### 2.2 状態確認とscroll導線

1. tab名は1行だけ表示し、状態のvisible textは置かない。
2. readyなactive tabはaccentの上端線とactive背景、errorは赤い上端線、loading / renderingは別variantの上端indicatorで表す。
3. activate buttonのaccessible nameへ状態名を加え、loading / renderingでは`aria-busy=true`を公開する。
4. pointerがTabStrip shell内に滞在する時、または明示的なkeyboard入力後にTabStrip内へfocusがある時だけhorizontal scrollbar thumbを視認可能にする。pointer click由来のfocusだけでは表示を維持しない。scrollbarの占有寸法は常に一定とし、preview上端を動かさない。
5. active tab変更またはtab item内のactivate / move / close controlへのfocusで、tab item外枠全体をTabStrip内へrevealする。

### 2.3 drag move導線

1. split表示中、tab名を表示するactivate button上でprimary pointerを押す。
2. 6 CSS px以上移動した時だけdragを開始する。閾値未満のpress / releaseは従来どおりtab activate clickとして扱う。
3. drag開始後はsource item、pointer追従preview、反対paneのTabStrip drop targetを視覚表示し、live statusでcancel方法を通知する。
4. pointerが反対paneのTabStrip上にある状態でreleaseすると、drop時に再判定したdestinationを明示して`moveTab(sourcePaneId, destinationPaneId, tabId)`を1回だけ呼ぶ。
5. `Escape`、`pointercancel`、`lostpointercapture`、source unmount、split解除、drop target外releaseではcancelし、tab stateを変更しない。
6. move完了後は既存処理によりdestinationのactivate buttonへfocusする。cancel後は接続済みsource activate buttonにfocusを維持する。

矢印move buttonは残す。dragを実行できないkeyboard / assistive technology利用者に同じtyped transitionを提供する正規導線であり、fallback扱いの別仕様にはしない。

## 3. 対象範囲と非対象

### 3.1 最小提供範囲

- 40px固定高の1行TabStripと状態indicator。
- ready / loading / rendering / errorのvisual / accessible mapping。
- pointer滞在 / keyboard入力由来focus時だけ視認可能なhorizontal scrollbar。
- tab item全体を対象にしたhorizontal reveal policy。
- Pointer Eventsによるprimary / secondary間drag move、drop feedback、cancel。
- 既存move buttonと`move-tab` reducerの再利用。
- pure policy test、frontend build / test、Rust回帰check、手動UI matrix。
- component、architecture、pitfall、development workflow文書の同期。

### 3.2 非対象

- 同一pane内reorder、drop位置による挿入順変更。
- pin、複数選択、一括move / close、3pane以上への一般化。
- drag stateやTabStrip scroll位置の永続化。
- 実数のrender progressとpercentage表示。
- 矢印move buttonの廃止、keyboard drag mode、deprecatedな`aria-grabbed` / `aria-dropeffect`の追加。
- Rust command、custom protocol、capability、CSP、trusted HTML security boundaryの変更。
- Avalonia版への水平展開。

### 3.3 後続拡張

- TODO-2026-025の上下splitでは、drop target解決をpane ID基準のまま再利用し、方向依存の矢印・geometryだけを適応する。
- 同一pane reorderが必要になった場合はdestination indexを持つ別typed actionとして設計する。本機能の`move-tab`へ曖昧なoptional indexを先行追加しない。

## 4. 採用案・不採用案・判断理由

### 4.1 採用: Pointer Events + explicit pointer capture

既存のExplorer / split separator / image viewerが使用するPointer Eventsに合わせ、tab activate buttonで`setPointerCapture(pointerId)`を使用する。capture中もsource要素外のmove / upを受け取れ、`pointercancel`と`lostpointercapture`で終了を一意に扱える。

drop対象はcapture中の`event.target`では判定できないため、`document.elementFromPoint(clientX, clientY)`から`[data-tab-drop-pane]`を探索する。sourceと異なるpaneかつsplit modeの場合だけvalid targetとする。preview iframe内部はdrop targetにせず、destination TabStripを明示的な操作面とする。

標準上、pointer captureはpointer位置の通常hit test先ではなくcapture要素へeventをretargetし、`pointerup` / `pointercancel`後に暗黙解除されるため、`elementFromPoint`によるdrop target判定と`lostpointercapture` cleanupを分ける。[W3C Pointer Events](https://www.w3.org/TR/pointerevents/#pointer-capture)

### 4.2 不採用: native HTML Drag and Drop

native DnDは`draggable`、`DataTransfer`、UA drag image、`dragstart` / `dragover` / `drop`の別event modelを導入する。今回の移動は同一React tree内のtyped ID操作であり、OS / 外部applicationとのdata transferを必要としない。標準自身もdrag operationの具体的UXを規定せず、WebView間でfeedbackやcancelの差を増やすため採用しない。[WHATWG HTML Drag and Drop](https://html.spec.whatwg.org/dev/dnd.html)

### 4.3 採用: TabStrip専用pure policy module

新規`tabStrip.ts` / `tabStrip.test.ts`へ次の副作用なしpolicyを置く。

- `getTabRevealDelta(viewportStart, viewportEnd, itemStart, itemEnd, padding, leadingPeekStart?, trailingPeekEnd?): number`
- `hasExceededTabDragThreshold(startX, startY, currentX, currentY): boolean`
- `resolveTabDropPane(sourcePaneId: PaneId, candidatePaneId: string | null, mode: ViewMode): PaneId | null`

DOM ref、pointer capture、focus、`elementFromPoint`、React stateは`TabStrip` / `App`に残す。exported pure functionは既存の`splitView.ts` / `paneRuntime.ts`と同じTypeScript policy module patternであり、mutable module-global stateは追加しない。class wrapperはstateを持たず責務を明確にしないため追加しない。

### 4.4 採用: manual horizontal reveal

現在の`Element.scrollIntoView({ inline: "nearest" })`は既定でancestor scroll containerを順に処理するため、TabStrip以外のscrollを巻き込む余地がある。またrefがactivate buttonなのでaction controlsを含むitem外枠を保証しない。

変更後はTabStripとtab itemの`getBoundingClientRect()`からpure policyでdeltaを計算し、`strip.scrollBy({ left: delta, behavior: "auto" })`だけを実行する。CSSOM View標準の`container: "nearest"`へ依存せず、対象containerをコード上でTabStrip 1つに固定する。[CSSOM View scrollIntoView](https://drafts.csswg.org/cssom-view/#dom-element-scrollintoview)

### 4.5 採用: scrollbar geometry固定 + thumb visibility切替

`overflow-x: scroll`と6pxのscrollbar寸法を使い、通常時はthumb / trackをtransparentにする。scroll elementを同寸のouter shellで包み、native scrollbarを含むshell矩形をpointer境界にする。pointer enter / leaveとwindow capture `pointermove`からpointer stateを管理し、window keydown / pointerdownとshell内focusからkeyboard modality stateを管理する。`pointerInside || keyboardFocusInside`をpure policyで求め、単一の表示classだけをthumb着色条件に使う。`:focus-within`、`:hover`、`:has(:focus-visible)`はいずれもUAのfocus / native scrollbar hit-test / repaintに依存した残留が確認されたため表示条件に使わない。Tauriの対象WebViewで共通利用できるWebKit scrollbar pseudo-elementへ実装を一本化し、`scrollbar-width` / `scrollbar-color`は併記しない。

window `pointermove`の双方向同期はnative eventごとにlayoutを読まず、最新座標をrefへ保持してanimation frameごとに最大1回だけouter shell矩形を読む。split時もpaneごとに1 frame 1回へ上限を設け、pointer event頻度によるforced layout増加を避ける。outer shell外への`pointerleave`では保留中frameと座標を破棄してからpointer stateをclearし、iframeへ移動した後に古い領域内座標が再適用されないようにする。

scrollbar自体の追加・除去や`overflow-x: auto | hidden`切替は行わない。classic scrollbarではtransparentなtrackを含め常に同じ6px内部寸法を確保し、overlay scrollbar環境でもTabStrip外寸40pxを維持する。overflowがない場合も透明trackの領域は保持するがthumbは生成されず、不要なbarは視認できない。これによりtab追加・closeがoverflow境界を跨いでもtab itemの内寸を34pxから変えない。

### 4.6 不採用案一覧

| 案 | 不採用理由 |
| --- | --- |
| state visible textを残してfontだけ縮小 | 1行compact化と状態によらない高さを満たさない |
| active / error / renderingごとにTabStrip高さを変える | pane間段差とpreview layout shiftを再発させる |
| activate buttonだけをrevealする | move / closeが画面外に残る既知問題を解消しない |
| `scrollIntoView`へ`container: "nearest"`を追加するだけ | 型・WebView対応差があり、item外枠と対象containerを明示できない |
| drag専用にpane arraysを直接更新する | `move-tab` reducerと二重のstate transitionになる |
| destination preview pane全体をdrop targetにする | HTML iframe上のhit test差が増え、意図しないdrop範囲が広すぎる |
| pointermoveごとにApp stateを更新する | App全体とpreviewを高頻度rerenderし、描画性能とDOM runtimeを不必要に揺らす |
| drag cancel時に矢印moveへfallback実行する | cancelなのにstateが変わり、利用者意図を破る |

## 5. Before / After

| 観点 | Before | After |
| --- | --- | --- |
| TabStrip高さ | 58px固定、state textを2行目表示 | 40px固定、name 1行 + 上端indicator |
| active | accent上端線 | ready時accent上端線 + active背景、busy/error時はactive背景を維持 |
| loading / rendering / error | visible text、error下端線 | 上端variant + accessible name、busyは`aria-busy` |
| scrollbar | 常時thin style、OS依存で可視 | overflow時にpointer滞在 / keyboard入力由来focusだけthumb可視、geometry不変 |
| auto scroll target | activate button | move / closeを含むtab item外枠 |
| scroll実行範囲 | `scrollIntoView`のancestor chain | TabStripの`scrollLeft`だけ |
| pane間move | 矢印button | 矢印button + pointer drag、同じ`move-tab` |
| drag cancel | なし | Escape / pointercancel / lost capture / invalid releaseでno-op |

## 6. 状態・表示・accessibility契約

### 6.1 状態mapping

`resolvePaneTabPresentationState`の戻り値は変更しない。新規`resolveTabAccessibilityState`を`paneRuntime.ts`へ置き、visual stateと同じ入力からaccessible label suffixとbusy状態を一意に返す。

| presentation | 上端indicator | activeとの併用 | accessible suffix | `aria-busy` |
| --- | --- | --- | --- | --- |
| `ready` | inactiveはなし、activeはaccent 2px full | active背景・文字色 | なし | `false` / 属性省略 |
| `loading` | muted accent 2px full | active背景を維持 | `Loading` | `true` |
| `rendering` | accent segmentのindeterminate animation | active背景を維持 | `Rendering` | `true` |
| `error` | error color 3px full | active背景を維持 | `Error` | 属性省略 |

error / loading / rendering indicatorがactive上端線より優先されるため、同じedgeへ複数線を重ねない。activeかどうかは背景、文字色、`aria-selected`で独立に識別できる。色だけに依存しないようrenderingはmotionまたはreduced-motion pattern、errorは太さ、activeは背景を併用する。

### 6.2 reduced motion

通常のrenderingはpseudo-elementの短いsegmentを左から右へ反復する。これは実progressではなくindeterminateであり、percentageや`aria-valuenow`を持たない。

`@media (prefers-reduced-motion: reduce)`ではanimationを停止し、accent系のrepeating patternを固定表示する。loadingは静的full line、renderingはpattern、errorは赤いsolid lineとして区別を維持する。

### 6.3 accessible nameとfocus model

- activate buttonへ`aria-label`を設定し、readyならdisplay name、その他は`<display name>, Loading|Rendering|Error`とする。visible `.tab-name`がaccessible nameの先頭と完全一致する順序を維持し、音声操作のname-in-name要件を守る。
- `title`はfull pathを維持するがaccessible stateの正本にはしない。
- role `tab`、`aria-selected`、`aria-controls`、roving `tabIndex`は維持する。
- loading / renderingだけ`aria-busy=true`をrole `tab`へ付ける。
- move / close buttonの既存labelとfocus順を維持する。
- drag中の視覚previewは`aria-hidden=true`かつ`pointer-events:none`とする。
- visually hiddenなpolite live statusへ、開始時`Dragging <name>. Drop on the <pane> tab strip or press Escape to cancel.`、valid target変更時、cancel / completion時の短い結果を通知する。
- deprecatedなdrag ARIA属性は追加せず、keyboard / assistive technologyの操作はmove buttonへ一本化する。

## 7. layoutとscroll設計

### 7.1 CSS geometry

- `--tab-strip-height: 40px`へ一括更新する。
- `.document-pane`のgrid rowは同じvariableを参照し続ける。
- `.tab-item`はstretchし、indicator用pseudo-elementを持つ`position: relative`とする。
- `.tab-activate`は1行中央揃え、`.tab-state`要素と2行gridを削除する。
- move / close各30px、single itemのmin width 130px、split itemのmin width 160pxは維持する。
- `.tab-strip`は`overflow-x: scroll`とWebKit pseudo-elementによる6pxのtransparent trackを常時持つ。`scrollbar-width`は併用しない。content control領域は外寸40pxからborderと実測scrollbar寸法を差し引いた領域を使い、indicator 2〜3pxをoverlayしてbutton layoutを押し下げない。
- `.app-shell`とdark theme側へ`--tab-indicator-loading` / `--tab-indicator-rendering` / `--tab-indicator-error`のsemantic tokenを追加する。component ruleへ固定RGBを書かず、Light / Darkの`--chrome-bg`とactive時`--panel-bg`の双方で視認できる値を各theme定義へ置く。error tokenは`--error-text`を参照してよい。
- drag開始は`pointerType === "mouse"`だけを対象とし、`.tab-activate`へ`touch-action: none`を付けない。touch / penでは従来のhorizontal pan、tap activate、move buttonを維持する。

### 7.2 reveal policy

`getTabRevealDelta`はTabStrip content viewportとitem外枠のleft / rightを比較する。

1. item全体がpadding込みで入っている場合は0。
2. item左端がviewport左端より外れ、前tabがある場合は、選択item全体に加えて前tabの右半分を表示する。先頭tabならitem左端をpadding位置へ合わせる。
3. item右端がviewport右端より外れ、次tabがある場合は、選択item全体に加えて次tabの左半分を表示する。末尾tabならitem右端をpadding位置へ合わせる。
4. itemと隣接tab半分を同時に収められない場合はitem全体を優先する。item幅自体がviewport幅を超える将来条件では左端を優先し、frameごとの左右往復を起こさない。
5. 非finiteまたは隣接peekがitem内を指すgeometryはprogramming / DOM integration errorとして`getTabRevealDelta`がthrowする。呼び出し側はcatchして0へfallbackせず、DOM rect不整合を顕在化させる。

revealは次で呼ぶ。

- `activeTabId`またはtabs membership変更後の`requestAnimationFrame`。
- `.tab-item`の`onFocusCapture`。activate / move / closeのどこへTab移動しても同じitemを対象にする。
- destination move後のfocus処理。focusより先にDOMを取得し、focus captureと同じrevealを通す。

TabStrip / Appが実行するroving navigation、close後、move後、pane fallbackのprogrammatic focusはすべて`focus({ preventScroll: true })`を使う。UA focusing stepsによるancestor scrollを抑え、水平位置は`getTabRevealDelta` + `strip.scrollBy`だけが変更する。現行roving契約では非active tabを矢印キーでactivateした後、active item内のactivate → move → closeへTab移動した時に`onFocusCapture` revealが働く。

pointerによる単なるhoverでは自動scrollしない。利用者のmanual scroll位置を不要に変更しないためである。

## 8. drag stateとevent lifecycle

### 8.1 transient state

dragはsession-only UI stateであり`SplitViewState`へ追加しない。

```ts
type TabDragSession = {
  pointerId: number;
  sourcePaneId: PaneId;
  tabId: string;
  displayName: string;
  startClientX: number;
  startClientY: number;
  phase: "pending" | "dragging";
  dropPaneId: PaneId | null;
  captureElement: HTMLButtonElement;
};
```

- mutable current session、pointer座標、click抑止identityは`App`のReact `useRef`に置く。`TabStrip` componentは`App.tsx`内に維持し、pure policyだけを`tabStrip.ts`へ分ける。
- React stateは`dragging`開始、drop target変更、終了時だけ更新し、pointermoveごとのApp rerenderを避ける。
- pointer追従previewは`.app-shell`のsiblingとしてReact root直下に1つだけmountし、`position: fixed`と専用DOM refの`transform: translate(...)`で追従する。`aria-hidden=true` / `pointer-events:none`を維持し、pane / app shellの`overflow:hidden`でclipさせず、`elementFromPoint`のdrop判定にも混入させない。document dataやpreview DOMは変更しない。

### 8.2 start

- split mode、`pointerType === "mouse"`、primary pointer、button 0、未開始session、activate button本体からのpointerdownだけを受理する。touch / penはdrag sessionを開始せず、horizontal pan、tap activate、move buttonへ委ねる。
- move / close buttonからは開始しない。
- pending開始時にpointer captureを設定するが、閾値到達まではdrag feedbackと`preventDefault`を有効にしない。
- 6px閾値到達時にdraggingへ遷移し、`{ pointerId, sourcePaneId, tabId }`でscopedなclick抑止identity、source / preview feedback、`.app-shell.tab-dragging` class、live statusを有効化する。
- drag開始時にsource paneをactive化するが、source tab selectionはmove完了まで変更しない。non-active tabの直接dragを許可する。

### 8.3 move / target

- pointer coordinateで`elementFromPoint`し、closest `[data-tab-drop-pane]`のdatasetから`string | null`のcandidate paneを得る。viewport外や対象なしで`elementFromPoint`が`null`の場合もinvalid targetとする。
- source自身、single mode、DOMから外れたpane、unknown valueはinvalid targetとする。
- targetが変わった時だけReact presentation stateとlive statusを更新する。
- destination TabStripはoutline / inset background、source itemはopacity、app cursorは`grabbing`でfeedbackする。

### 8.4 drop / cancel / cleanup

- pointerupの`clientX` / `clientY`で`elementFromPoint`と`resolveTabDropPane`を再実行し、その結果がvalidな時だけdestinationを明示して`moveTab`を1回呼ぶ。sessionの`dropPaneId`はfeedback表示専用であり、drop確定には使わない。
- move実行前にlatest `splitViewRef`でsplit modeとsource membershipを再確認する。内部不整合は既存reducerがthrowし、drag専用fallbackで吸収しない。
- invalid target上のpointerupはcancelでno-op。
- dragging中だけ`document`へcapture phaseの`keydown` listenerをeffectで登録する。Escapeでは`preventDefault`と`stopPropagation`を行ってdrag cancelを優先し、captureを安全にreleaseする。cleanupでlistenerを必ず解除し、menu等の別document-level Escape handlerを同じeventでは実行させない。
- `pointercancel` / `lostpointercapture` / unmount / split解除はno-op cleanupする。
- drag成立後のsource activate buttonには`onClickCapture`を置き、click抑止identityが同じsource tabなら`preventDefault` / `stopPropagation`してidentityを消費する。時間依存のscheduled clearは行わない。Escapeは物理button release後にclickを生成し得るためidentityを維持し、matching clickが消費するか、clickが来なければsession終了後の次のprimary pointerdownがclearする。pointercancel / source unmountを伴うunexpected lost captureはclickを生成しないため同期clearする。drag中に追加pointerdownが来てもidentityをclearしない。pointerup後のimplicit `lostpointercapture`はsessionが既にfinalize済みなのでno-opとし、identityを早めにclearしない。
- cleanupはsession ref、presentation state、`.app-shell.tab-dragging` classに対応するReact state、preview transform、live status、keydown listenerを一つの経路で解除する。click抑止identityだけは前項のevent順序に従ってclearする。lost capture後の二重cleanupはcurrent pointer ID不一致なら何もしない。
- move後のsource item unmountは正常であり、destination focusは既存`moveTab`の`requestAnimationFrame`経路を使う。

## 9. component・module責務

### 9.1 `App.tsx`

- cross-pane drag session、drag preview、live status、latest split state照合を所有する。
- `moveTab(sourcePaneId, destinationPaneId, tabId)`をpointer dropとmove buttonの唯一のintegration pointとして再利用する。move buttonは2 pane UI上の反対paneを明示して渡し、dragはdrop再判定結果を渡す。reducer契約は不変とする。
- pointermoveごとにdocument / tab / preview React stateを更新しない。
- split解除、root reset、該当tab close / moveによるsession無効化をeffectでcleanupする。
- dragging中のdocument capture keydown、App root直下のfixed `.tab-drag-layer` / preview、app shell classをReact lifecycleで管理する。`document.body.classList`は変更しない。

### 9.2 `TabStrip`

- strip DOM ref、activate button refs、item refsをpaneごとに所有する。
- active / focus itemのrevealを`tabStrip.ts` policyへ接続する。
- tab itemへpresentation class、accessible state、drag source classを付ける。
- rootへ`data-tab-drop-pane=<paneId>`とdrop target classを付ける。
- pointer eventをcoordinatorへ渡すが、pane membershipを直接更新しない。
- programmatic focusは`focus({ preventScroll: true })`、source activate click抑止はidentity付き`onClickCapture`を使い、通常clickとdrag成立後clickを分離する。

### 9.3 `tabStrip.ts`

- geometry、threshold、candidate drop pane判定だけをtyped pure functionとして提供する。
- DOM、React hook、mutable session、`document`、`window`へ依存しない。
- reorderや複数pane一般化を先行実装しない。

### 9.4 `paneRuntime.ts`

- `resolvePaneTabPresentationState`を状態合成の正本として維持する。
- presentation stateからaccessible suffix / busyを返すpure mappingを追加する。
- drag sessionやscroll geometryは責務外とする。

### 9.5 `splitView.ts`

- 既存`move-tab` actionとinvariantを変更しない。
- drag専用action、destination index、compatibility actionを追加しない。
- 既存testでsource fallback、destination dedupe / select、single拒否、runtime guardを回帰確認する。

### 9.6 `App.css`

- compact fixed height、indicator、scrollbar、drag source / target / preview、reduced motionを定義する。
- state / hover / focus切替でgrid rowやouter heightを変更しない。
- Light / Dark双方の`.app-shell`へTabStrip用semantic tokenを定義し、component ruleには固定RGBを追加しない。
- fixed drag previewのsibling layerにもtheme tokenを供給するため、Lightは`.app-shell, .tab-drag-layer`、Darkは`:root[data-theme="dark"] .app-shell, :root[data-theme="dark"] .tab-drag-layer`の共通selectorを使う。previewが参照する`--panel-bg` / `--chrome-bg` / `--text` / `--muted` / `--border` / `--accent`とTabStrip indicator tokenをLight / Dark双方で明示定義し、sibling間のCSS variable継承には依存しない。

## 10. データ・サービス・永続化・migration

- `OpenDocumentTab[]`、`SplitViewState`、Rust command、settings schemaは変更しない。
- drag sessionとscroll positionはsession内DOM状態であり永続化しない。
- migrationは不要。旧TabStrip CSS / `.tab-state` DOMを一括置換し、互換classや二重render経路を残さない。
- trusted HTML iframe、Mermaid queue、PlantUML cacheへ新しいdataを渡さない。

## 11. 互換性と既存機能統合

- tab activate / close、roving arrow navigation、Home / End、move buttonの意味を維持する。
- move結果は既存`move-tab`なのでsource fallback、destination selection、active pane、pending navigation、pane runtime guard、image viewer close条件を変更しない。
- single viewではmove buttonとdragを提供せず、通常のactivate / close / scrollだけを提供する。
- tab item ID、tabpanel `aria-labelledby`、pane-scoped DOM IDを維持する。
- StatusBar / ErrorBanner routingはactive pane / selected tabの既存導出を維持する。
- Rust / HTML security境界へ影響しない。iframeはdrop target外でありsandbox変更もない。

## 12. 失敗時・境界条件

| 条件 | 動作 |
| --- | --- |
| tabs empty | 40px固定高のempty strip。scroll / drag対象なし |
| itemが完全表示済み | reveal delta 0、scroll位置不変 |
| left / right部分欠け | item外枠とpaddingが入る最小deltaだけscroll |
| split解除中のpending / dragging | session cancel、state変更なし |
| source tab close / root reset | session cancel、detached elementへfocusしない |
| invalid drop target release | cancel、`move-tab`を呼ばない |
| pointercancel / lost capture | cleanup、`move-tab`を呼ばない |
| destinationに同じtab IDあり | existing `move-tab`がdedupeし既存位置を維持、選択・focus |
| sourceがnon-active | source active tab維持、destinationでdragged tab選択 |
| active sourceが最後の1件 | sourceはempty / unselected、destination選択 |
| reduced motion | rendering animation停止、static patternで識別 |
| item幅がviewport超過 | left edge優先、無限revealループを避ける |
| reveal geometryが非finite | pure policyがthrowし、silent 0 / nullへfallbackしない |
| programmatic focus | `preventScroll:true`でancestorを動かさず、TabStripだけmanual reveal |
| drag成立後のsource click | matching `onClickCapture`で抑止。成功dropでunmountしclickが無い場合は次のpointerdownでstale identityをclear |
| focus target欠落 | existing destination pane focus + console error。silent no-opにしない |

## 13. テスト設計

### 13.1 `tabStrip.test.ts`

- fully visible / left clipped / right clipped / exact edge / paddingのreveal delta。
- item widthがviewport以下 / 超過の場合のdeterministic alignment。
- NaN / Infinityを含む非finite geometryがthrowすること。
- 6px未満、exact threshold、超過、diagonalのdrag threshold。
- primary→secondary、secondary→primary、same pane、single、`string | null`のunknown / absent candidateのdrop target判定。

### 13.2 `paneRuntime.test.ts`

- ready / loading / rendering / errorのlabel suffixと`aria-busy` mapping。
- shared state優先とpane-local runtime合成の既存testを維持する。
- 同じtabを両paneで表示した時、片pane errorが他paneへ混線しない。

### 13.3 `splitView.test.ts`

- existing `move-tab`のactive / non-active source fallback。
- destination empty / nonempty / same ID dedupe / pending navigation。
- single mode拒否、sourceとdestination同一拒否、source nonmember拒否。
- move後のsource result拒否 / destination result受理をpane runtime testで維持する。

### 13.4 自動検証

```bash
cd markdown-viewer-tauri
npm test -- --run
npm run build

cd src-tauri
cargo fmt -- --check
cargo check
cargo test
```

Rust差分は予定しないが、Tauri application全体の回帰確認としてRust check / testを実行する。

## 14. ユーザー確認matrix

1. ready / active / loading / rendering / errorの上端indicatorとaccessible state。
2. Light / Darkと`prefers-reduced-motion`で色・pattern・active背景が識別可能。loading / rendering / error tokenがinactiveの`--chrome-bg`とactiveの`--panel-bg`の双方で視認できる。
3. primary / secondary、empty、overflow、状態遷移で40px固定高とpreview上端が一致。
4. overflowなしではbarが見えず、overflow時はpointerがshell内にある場合またはkeyboard入力由来focusがある場合にthumbが現れる。pointer click後にtabへfocusが残ったままpreviewへpointerを移すとthumbが隠れ、keyboard focus中はpointerが領域外でも表示を維持し、pointer clickまたはTabStrip外へのfocus移動で隠れる。対象WebViewでWebKit pseudo-elementのtrack実寸が6pxであることを確認し、tabをoverflow境界前後で増減してもitemの見た目高さとpreview上端が変わらない。
5. 矢印キーで先頭・中間・末尾tabをactivateし、Tabでactive item内のactivate → move → closeへ移動してitem全体が見える。focus時にpreview / Explorer / shellが縦横に動かない。
6. primary→secondary、secondary→primaryのactive / non-active tab drag。
7. destination same ID、source最後のtab、invalid target release、Escape cancel。非active sourceをdrag中にEscapeし、source上でmouse buttonをreleaseしてもselectionが変わらない。
8. drag後とmove button後のsource fallback、destination selection、focus、StatusBar / ErrorBanner一致。move後のfocusでもpreview / Explorer / shellが動かない。
9. keyboardだけでroving navigation、move button、closeへ到達できる。
10. narrow window、split resize、Explorer resize中のoverflow / drag feedback。
11. Markdown / HTML / Mermaid / PlantUML表示中のmoveとruntime guard。
12. HTML iframe上へ外れたrelease、split解除、tab close、root changeによるcancel。
13. invalid drop cancel後、Escape cancel後、成功drag直後に別tabをclickし、最初の1回でactivateされる。source unmount有無を確認し、drag中の追加pointerdownでもsource click抑止identityが失われない。
14. mouse dragが成立し、touch / penはdragを開始せずhorizontal pan、tap activate、move buttonを維持する。

## 15. 恒久ドキュメント更新予定

Phase 3では次の既存確定記述を検索・置換し、新旧仕様を並存させない。行番号は設計時点の目安であり、置換は記述内容で照合する。

| file / 現行箇所 | 現行記述 | 置換後の要旨 |
| --- | --- | --- |
| `docs/components/tauri_viewer/detail_design.md` Multi-tab末尾（現行約474行） | state label / scrollbarによらない58px固定高 | 40px固定高、1行name、上端indicator、transparent 6px track、item全体reveal、Pointer Events drag lifecycle |
| `docs/components/tauri_viewer/interface_spec.md` Tab move（現行約12行） | split時はactive tabの矢印buttonだけで移動 | 矢印buttonに加えてmouse dragを提供。pointerはnon-active tabも直接drag可能、keyboardはactive tab controlsを使う |
| `docs/components/tauri_viewer/interface_spec.md` TabStrip focus（現行約59行） | activate buttonとactive tab controlsだけがTab順、非activeは矢印でactivate | keyboard契約は維持し、pointer dragだけが非active tabを直接扱う。programmatic focusは`preventScroll` |
| `docs/components/tauri_viewer/interface_spec.md` TabStrip height / state（現行約62行） | name 1行 + state 2行目、58px固定高 | state visible textを廃止し、40px固定高 + visual / accessible indicator + hover / focus scrollbarへ置換 |
| `docs/rules/development_workflow.md` TabStrip手動確認（現行約177行） | 58px固定高と2 pane段差確認 | 40px、state / reduced motion、overflow境界、item reveal、drag / cancel / click抑止matrixへ置換 |
| `docs/components/tauri_viewer/basic_design.md` TypeScript policy一覧 | `tabStrip.ts`なし | reveal / threshold / drop narrowingを扱うpure policyを追加 |
| `docs/components/tauri_viewer/README.md` file map / module表 | `tabStrip.ts` / testなし | 新規policy / testのパスと責務を追加し、利用方法・mouse drag制約も記録 |
| `docs/architecture/code_patterns.md` Tauri frontend pattern | TabStrip interaction policyなし | 単一`move-tab` integration、pure policy、high-frequency pointer coordinateをrefで扱うpatternを追加 |
| `docs/architecture/common_pitfalls.md` pane-local tab group | captured drag / reveal注意なし | capture中の`elementFromPoint`、pointerup再判定、click identity cleanup、`preventScroll`、fixed preview、scrollbar geometryを追加 |
| `docs/tests/README.md` frontend tests | `tabStrip.test.ts`なし | pure geometry / threshold / drop / accessibility mappingとDOM手動検証の境界を追加 |
| `docs/history/` | 本機能履歴なし | Phase 4-bで実装・検証結果を追加 |

ADRは追加しない。Pointer EventsとTabStrip policyは現時点ではTauri component固有の案件詳細であり、`docs/adr/README.md`の複数案件で再利用される採用済み横断判断という起票条件を満たさない。Avalonia展開または複数componentで共通原則になった時に再評価する。

## 16. リスクと軽減策

| リスク | 影響 | 軽減策 |
| --- | --- | --- |
| pointer capture中はevent targetがsource固定 | destination判定不能 | `elementFromPoint` + typed pane datasetで判定 |
| clickとdragの競合 | drag後にsource activate | 6px thresholdとdrag成立時のone-shot click抑止 |
| pointermoveでApp全体rerender | preview DOM性能 / 再描画 | 座標はref / preview style、target変更時だけstate更新 |
| source unmountでcapture喪失 | stale drag / double move | lost capture、identity effect、pointer ID付きcleanup |
| scrollbar実装差 | thumb常時表示 / layout差 | WebKit pseudo-elementへ一本化、fixed outer height、対象WebViewでtrack実寸確認 |
| indicatorが色だけに依存 | 状態識別困難 | 太さ、motion / pattern、active背景、accessible name |
| reduced motionでrendering不明 | loadingとの混同 | static repeating patternを使用 |
| scrollがouter paneを動かす | preview / shell位置変化 | manual strip-only delta、item外枠ref |
| drag targetを広げすぎる | accidental move | destination TabStripだけをvalid targetに限定 |
| DOM lifecycleをunit testできない | capture / focus / click cleanup regression | pure policyを自動testし、DOM event順・CSS・focusは§14手動matrixを必須にする |

## 17. 実装順序

1. `tabStrip.ts` / testへreveal、threshold、drop target pure policyを追加する。
2. `paneRuntime.ts` / testへaccessible mappingを追加する。
3. TabStripのitem refs、1行DOM、manual revealを実装する。
4. CSS fixed height、indicator、scrollbar、reduced motionを実装する。
5. App / TabStripへdrag session、feedback、live status、cleanupを接続する。
6. 自動test / buildと恒久docsを同じPhase 3差分で更新する。
7. implementation review後、手動matrixへ進む。

## 18. 要求traceability

| TODO受け入れ条件 | 設計節 |
| --- | --- |
| visible textなしで状態識別 | §6 |
| error / rendering / reduced motion | §6.1–6.2 |
| compact固定高、段差なし | §7.1 |
| pointer滞在 / keyboard入力由来focus時だけscrollbar可視 | §4.5、§7.1、§19–21 |
| tab item全体を自動表示 | §4.4、§7.2 |
| pointer dragとmove整合、cancel no-op | §8、§11–12 |
| keyboard / assistive technology導線 | §2.3、§6.3 |
| Light / Dark、single / split、content回帰 | §11、§14 |
| test / build / Rust check | §13 |

## 19. Phase 4-a feedback: scrollbar focus modality

2026-07-29のユーザ動作確認では、固定高、状態indicator、pane間drag move、右端tabのitem全体revealは期待どおりと確認された。一方、overflowしたTabStripでtabをpointer clickした後、pointerをpreviewへ移動してもhorizontal scrollbar thumbが残ることが報告されたため、Phase 4-aをNGとしてPhase 3へ差し戻す。

原因はthumb表示条件に`:focus-within`を使っていたことにある。pointer clickしたbuttonはpointerが領域外へ移動してもfocusを保持するため、`:focus-within`が継続する。表示条件を`:hover`または`:has(:focus-visible)`へ変更し、pointer操作では領域を離れた時に隠しつつ、keyboard操作ではTabStrip内focus中の視認性を維持する。scrollbar geometry、reveal、drag、tab focus自体は変更しない。

## 20. Phase 4-a feedback Round 2: native scrollbar hover残留

Round 1修正後の再確認でも、TabStripとpreviewの間をpointerで上下に往復するとthumbが残る場合と消える場合があり、素早い移動ほど残りやすいと報告された。scrollbar付近で一旦停止してからpreviewへ移動すると消えやすい傾向は、native scrollbar pseudo-elementと`:hover`のstate / repaintがpointer移動と同期しないことを示す。Phase 4-aを引き続きNGとしてPhase 3へ再差し戻しする。

pointer表示のsource of truthをCSS `:hover`からReact stateへ移す。pointer enterでrefとstateを同期して有効化し、window captureの`pointermove`はref有効中だけclient座標をstrip矩形と比較する。領域外の最初のmove、pointer leave、window blurでrefとstateを無効化し、CSSはそのclassだけを参照する。listenerは常設して高速enter / leave間の登録raceを避けるが、ref無効時は即returnして通常時のlayout readを避ける。keyboard表示の`:has(:focus-visible)`、6px track、40px外寸、reveal、drag lifecycleは変更しない。

## 21. Phase 4-a feedback Round 3: native boundaryとfocus ORの分離

Round 3再確認では、thumbが逆に常時表示され、native scrollbar位置へpointerを置いた時だけ一瞬消える場合があると報告された。境界policyのtrue / falseは正しいが、表示条件がpointer classと`:has(:focus-visible)`のORだったため、pointer classをclearしてもUAがfocus-visibleと判定する限り表示が残った。またnative scrollbar自身をscroll elementの境界に含めたことで、scrollbar上への移動がpointer leaveとして観測される場合があり、一瞬だけ消える症状につながった。

scroll elementを40px固定高のouter shellで包み、native scrollbarを含むshell全体をpointer境界にする。keyboard表示はUA selectorを廃止し、window keydown / pointerdownでlast input modalityを管理する。shell内focus時にkeyboard入力由来の場合だけkeyboard stateを有効化し、pointerdownでは同期的に解除する。pointer stateとkeyboard stateは`shouldShowTabScrollbar`のOR policyで単一classへ集約する。これにより表示のsource of truthをすべて明示stateへ移し、UA selectorとnative scrollbarのhit-testを論理判定から除外する。

## 22. Phase 4-a feedback Round 4: 実WebView診断

outer shellと単一表示classへ集約した後も実WebViewの症状が変わらず、window `pointermove`ごとの矩形再判定とnative scrollbar上の擬似leave無視を追加しても改善しなかった。このため、次の修正を推測で重ねず、React state、実DOM class、pointer座標の矩形判定、focus、CSS pseudo-elementのcomputed styleを同時に観測する一時診断をStatusBarへ追加する。

診断結果から、state / classが表示を指示している場合はevent lifecycleを、state / classが非表示なのにthumbが見える場合はnative scrollbarのstyle適用またはrepaintを次の修正対象とする。診断UIは原因確定と再確認後に除去する。

診断buildでは症状が再現しなかったため、診断処理の有無を変数として分離する。最初にStatusBarの診断表示と採取処理を除去したbuildを再確認し、その後の別段階で`View`メニューから切り替える汎用の複数行デバッグ領域を設計・実装する。汎用領域はErrorBannerとStatusBarの間に配置し、通常時は非表示、明示切り替え時だけlayoutへ参加させる。TabStrip診断はその最初の情報providerとして接続する。

## 23. 診断OFF / ON比較用デバッグパネル

診断除去buildで症状が再発したため、`View > Debug Information`のcheckable itemから診断の採取と表示を同時に切り替える。OFF時はパネルを描画せず、TabStrip providerもanimation frame、layout read、computed style read、debug eventを実行しない。ON時だけErrorBannerとStatusBarの間へ最大180pxのscroll可能な複数行領域を確保し、provider IDごとのtitleとline配列を表示する。

TabStrip providerはprimary / secondary別にstate、DOM class、生の矩形判定、hover / focus、thumb computed background、overflow、active element、最終event / pointer座標を4行で発行する。表示器はprovider固有の形式を解釈せず、今後ほかの診断情報を追加できる汎用entryとして保持する。この段階では診断ONによる症状消失を修正完了とは扱わず、OFFで再現後にONへ切り替えた瞬間の値と描画変化を原因特定へ使う。

OFF / ON比較で、一度診断をONにするとOFFへ戻しても正常描画が継続した。診断が行うlayout / computed style readまたはパネル挿入によるresizeがnative scrollbarの初回paintを確定させたと判断する。通常経路では`isScrollbarVisible`またはtab数が変わった次のanimation frameに、overflow時だけstrip layoutと`::-webkit-scrollbar-thumb`のcomputed backgroundを1回読む。この明示flushをWebKit native scrollbar repaint workaroundとし、表示stateやgeometryは変更しない。
