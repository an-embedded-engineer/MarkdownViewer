# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 設計

## 1. 背景と目的

Tauri版のMarkdown本文はpreview pane幅へ追従し、通常画像とPlantUML SVGは本文幅以下へ縮小される。Mermaid / PlantUML containerには横scrollもあるが、巨大なUMLは全体表示時に文字が小さくなり、細部を読むには不十分である。

本変更では、Markdown preview内の通常画像、描画済みMermaid SVG、描画済みPlantUML SVGをクリックまたはkeyboard操作でmodal overlayへ開き、文書layoutを変えずにzoom / panできるようにする。

## 2. 要求と完了条件

| ID | 要求 | 設計上の対応 |
| --- | --- | --- |
| AC-1 | 通常画像、Mermaid、PlantUMLをpointer / keyboardから開ける | 描画完了した3種のvisualをpointer targetにし、keyboard用の隣接buttonをDOM adapterが付与する |
| AC-2 | 初期fit、zoom、pan、fit/resetで細部へ到達できる | viewport中央基準のtransform modelとpointer captureを使う |
| AC-3 | 安全な倍率範囲と一貫した複数入力、倍率表示 | fit倍率から800%までclampし、button / wheel / keyを同じpolicyへ集約する |
| AC-4 | modal close、背景抑止、focus復帰 | `aria-modal`、focus trap、app shellの`inert`、Escape / close / backdrop、origin復帰を使う |
| AC-5 | Theme / resize / tab / Reload境界で混線しない | requestへtab ID / revisionを保持し、境界変更時に破棄する。resizeはfit/custom mode別に再計算する |
| AC-6 | 通常表示と既存操作を退行させない | overlay外の既存CSS、Mermaid effect、PlantUML command、link処理を維持する |
| AC-7 | trusted HTML / Rust境界を変えない | Markdown React DOMだけを対象とし、iframe DOM・protocol・backendは変更しない |
| AC-8 | 自動・手動検証を完了する | Vitest policy test、frontend build、cargo check、専用fixtureによる手動scenarioを定義する |

## 3. 現行仕様と変更後仕様

### 3.1 Before

- `.markdown-body img`と`.plantuml-diagram svg`は`max-width: 100%`で縮小する。
- `.mermaid`と`.plantuml-diagram`は必要時に要素内横scrollする。
- Mermaidは`mermaid.run`がReact管理外でsource div内をSVGへ変換する。
- PlantUMLはRust commandの結果HTMLとして`.plantuml-diagram > svg`を挿入する。
- `handlePreviewClick`はanchorだけをevent delegationで処理する。

### 3.2 After

- 通常画像、成功済みMermaid、成功済みPlantUMLを共通のimage viewer pointer targetと隣接keyboard buttonで表現する。
- visual clickまたは隣接button activate時はapp shell上へmodal overlayを表示する。
- viewerは`Zoom out`、倍率表示、`Zoom in`、`Fit`、`100%`、`Close`を提供する。
- viewport上のwheel / trackpad、drag、keyboardでも同じtransform policyを操作する。
- overlayを閉じると選択visualに対応する隣接buttonへfocusを戻す。buttonが既にDOMから外れていればactive Markdown previewへ戻す。
- overlayを開いていない時の縮小、要素内scroll、link、anchor挙動は維持する。

### 3.3 既存linkとの優先順位

画像がMarkdown linkの子である場合、画像領域のpointer clickはviewer openを優先し、eventを`preventDefault`してlink navigationを同時実行しない。link自身へのkeyboard操作はnavigation、DOM adapterがlinkの外側へ置く隣接viewer buttonのkeyboard操作はviewer openとなり、利用者が両操作を選択できる。画像以外のlink textは既存契約を維持する。1入力でoverlayとnavigationを同時発火させず、nested interactive contentも作らないための意図した仕様差分である。

## 4. 対象範囲

### 4.1 対象

- `markdown-viewer-tauri/src/App.tsx`
  - image viewer stateとlifecycle調停
  - Markdown visual decoration、click event delegation
  - `ImageViewerDialog`
- `markdown-viewer-tauri/src/imageViewer.ts`
  - source解決とintrinsic size判定
  - fit、zoom、pan、resize時のpure transform policy
  - 描画完了visualのpointer markerとkeyboard用buttonを付与するDOM adapter
- `markdown-viewer-tauri/src/imageViewer.test.ts`
- `markdown-viewer-tauri/src/App.css`
- `sample_docs/image_viewer.md`
- Tauri Viewer component docsと手動確認手順

### 4.2 非対象

- sandboxed trusted HTML iframe内の`img` / `svg` / Canvas
- Avalonia版
- 画像編集、download、別window、印刷
- zoom / pan状態のtab間共有または永続化
- Rust command、filesystem、asset protocol、HTML bridge
- Settings dialogの共通modal component化

## 5. 採用案

### 5.1 生成済みvisualのDOM clone

選択された`HTMLImageElement`または`SVGSVGElement`を表示時だけ`cloneNode(true)`で複製し、viewer canvasへappendする。元nodeの移動や置換は行わない。

採用理由:

- MermaidがReact外で生成した現在のSVGをそのまま保持できる。
- PlantUML commandを再実行せず、tab cache済みSVGを利用できる。
- SVGを文字列へserializeして`dangerouslySetInnerHTML`で再parseする経路を増やさない。
- 通常画像は同じasset URLを参照するだけでbinary dataを複製しない。
- overlay close時にclone subtreeを破棄すれば、追加memoryの生存期間を限定できる。

clone側にはviewer固有のsizeと`aria-hidden="true"`を設定する。clone直後にgenerator由来の`width` / `height`属性とinline `max-width` / `width` / `height`を除去し、resolverが確定したintrinsic pixel sizeをstyleへ明示する。この正規化はinline styleへCSS specificityで対抗せず、`ImageViewerDialog`のclone前処理として行う。PlantUMLのinline backgroundは図の生成結果として保持し、Dark themeでも白いdiagram canvasとtheme色の周辺viewerを表示する。

Mermaid clone内のroot / marker / style IDは書き換えない。同一document内に一時的な重複IDが存在するが、viewer open中だけであり、内部`url(#...)`とscoped styleを壊すID rewriteより影響が小さいため許容する。

script実行やnetwork URLの再解決を新たに行うsourceは受け付けず、既存Markdown rendererが生成した3種だけをresolverのselector allowlistで扱う。

### 5.2 中央基準transform model

viewer contentはviewport中央へ置き、`translate(offsetX, offsetY) scale(scale)`を適用する。policyは次の型付きstateを正本とする。

```text
ImageViewerTransform
  scale: number
  offsetX: number
  offsetY: number
  mode: "fit" | "custom"

ImageViewerGeometry
  intrinsicWidth: number
  intrinsicHeight: number
  viewportWidth: number
  viewportHeight: number
  padding: number
```

DOM eventやReact state更新は`App.tsx`、数値計算は`imageViewer.ts`のpure export関数へ分離する。invalid dimension、非有限値、0以下の倍率はprogramming errorとして`RangeError`にし、不正値をsilent fallbackで隠さない。

### 5.3 Modal overlay

`ImageViewerDialog`を`main.app-shell`のsiblingに描画し、fixed backdropでwindow全体を覆う。表示中はapp shellに`inert`を適用し、pointer interceptionだけに依存せず背景focus / activationも抑止する。

dialogは次を持つ。

- `role="dialog"`、`aria-modal="true"`
- source種別とaccessible nameを含むtitle
- 操作説明を指す`aria-describedby`
- toolbar controls
- focus可能なpan / zoom viewport
- close button
- keyboard focus trap

初期focusはviewportへ置き、close後はrequestが保持する隣接buttonへ戻す。close handlerはrequestをnullにするだけとし、focus復帰は次のpassive effectまたは0ms deferでapp shellの`inert`解除後に行う。buttonが`isConnected`ならfocusし、unmount済みならactive previewへfallbackする。このfallbackはDOM lifecycle上必要なfocus回復だけであり、別の表示経路を残す互換fallbackではない。

背景scrollは既存の`html, body, #root { overflow: hidden }`、fixed backdrop、backdropの`overscroll-behavior: contain`により`.preview-pane`へscroll chainを渡さない。追加のbody style書換えは行わない。

Settings dialogは保存中close抑止や初期focus先が異なる。今回共通modal componentへ置き換えると既存設定UIの回帰範囲が広がるため、共通化しない。focus可能要素列挙の小規模重複は許容し、将来3個目のmodalが必要になった時点で独立refactoringを検討する。

## 6. Source triggerと解決規則

### 6.1 通常画像

Markdown-It image ruleは既存のrelative resource解決、`loading="lazy"`、alt、著者指定titleを変更しない。`title`をviewer説明で上書き・追記せず、title未指定時も新しいtooltipを付けない。

描画後のDOM adapterは`img.complete && naturalWidth > 0 && naturalHeight > 0`を満たす画像だけへpointer markerを付け、内容非依存のaccessible labelを持つ隣接buttonを追加する。button labelはaltがあれば`Open image in image viewer: <alt>`、空altなら`Open Markdown image in image viewer`とする。通常画像は`img`をactivation hostとし、その直後へbuttonを挿入する。linked imageは画像を含む最も近い`a`をactivation hostとし、その直後（`a`の外側）へbuttonを挿入してnested interactive contentを作らない。lazy imageが未loadなら一度だけ`load` / `error`を監視し、load成功後にdecorate、error時はdecorateせずconsoleへ原因を記録する。

decorationはvisualごとのdata markerでidempotentにし、Appの無関係な再描画やMermaid effect再評価でbuttonを重複追加しない。Markdown HTML差替え / unmount時はeffect cleanupがload listenerとadapter管理buttonを除去し、React外DOMの生存期間をpreview revisionへ限定する。

#### 6.1.1 共通decoration hostとkeyboard button

adapterはpreview revision内で一意なopaque IDを発行し、visualへ`data-image-viewer-id`と`data-image-viewer-kind`、buttonへ同じ`data-image-viewer-id`と`data-image-viewer-trigger`を付ける。pointer targetから解決する場合も同一preview root内のID一致buttonを`focusOrigin`に採用する。buttonから解決する場合は逆にID一致visualを採用する。cleanupはadapterが発行したIDを単位としてmarker、listener、buttonをまとめて除去する。

buttonはactivation hostの直後に置くが、通常時は共通のvisually-hidden CSS（`position: absolute`、1px四方、clip、負margin、overflow hidden）で文書flowとpointer hit testから外す。これによりinline画像を含む段落を含め、decoration前後で本文の行組み、diagramのborder / padding、横scroll幅を変えない。

buttonがkeyboard focusを受けた時だけ、DOM adapterは`requestAnimationFrame`後にvisualと`.preview-pane`の`getBoundingClientRect()`を読み、viewport内へclampしたvisual右上座標をCSS custom propertyへ設定する。`:focus-visible`ではbuttonを`position: fixed`の操作pillとしてvisual右上へ重ね、clip / 1px寸法 / 負marginを解除し、明瞭なoutlineと`Open image viewer`の可視文言を表示する。focus中だけcapture phaseのpreview scrollとwindow resizeを監視して座標を更新し、blur / cleanupでlistenerを除去する。visualが既にdisconnectならbuttonを除去してactive previewへfocusを戻す。通常時は`pointer-events: none`、focus可視時だけ`pointer-events: auto`とするため、画像やlinkのpointer操作を遮らない。

### 6.2 Mermaid

fence ruleが生成する`.mermaid` source containerへinteractive属性を事前付与しない。`mermaid.run`成功後、`data-processed="true"`とinner SVGを確認してDOM adapterを実行する。adapterはinner SVGをvisual、`.mermaid`をactivation host / pointer targetとしてmarkし、内容非依存の`Open Mermaid diagram in image viewer` buttonを`.mermaid`の直後へ追加する。buttonをcontainer内へ入れないため、既存border / padding / horizontal scroll領域を変えない。source text状態はTab順にもpointer cursor対象にもならない。

### 6.3 PlantUML

成功結果`result.ok === true`が返す既存`.plantuml-diagram`をそのままactivation host / pointer targetとし、viewer専用wrapperは追加しない。DOM adapterが`.plantuml-diagram > svg`とvalid sizeを確認した後にpointer markerを付け、`Open PlantUML diagram in image viewer` buttonを`.plantuml-diagram`の直後へ追加する。buttonをcontainer内へ入れないため、既存border / padding / horizontal scroll領域を変えない。pending / error HTMLはdecorateしない。

Mermaid / PlantUML SVG内に`a`がある場合、そのanchor clickはviewer resolverより先に既存link処理へ渡す。diagramの非anchor領域clickと隣接buttonだけがviewerを開くため、SVG linkとviewer操作を両立する。

### 6.4 Resolver契約

`resolveImageViewerSource(eventTarget, tabId, revision)`はdecorated marker / buttonのselector allowlistからoriginとvisualを決定し、次を返す。

```text
ImageViewerRequest
  kind: "image" | "mermaid" | "plantuml"
  accessibleName: string
  intrinsicWidth: number
  intrinsicHeight: number
  visual: HTMLImageElement | SVGSVGElement
  focusOrigin: HTMLButtonElement
  tabId: string
  revision: number
```

SVG intrinsic sizeは正の`viewBox.width / height`、次に明示width / height、最後に正のrendered bounding boxの順で決める。通常画像は`naturalWidth / naturalHeight`を正本とする。

DOM adapterは候補値を読む薄い層とし、候補から優先順位・正値検証を行う`resolveIntrinsicSize` pure policyへ渡す。resolverはactive preview root配下かつ同じ`data-image-viewer-id`を持つallowlist済みvisual / buttonの組だけを受理する。allowlist外target、ID不一致、重複IDは`null`を返して既存link処理へ渡す。visualや全size候補が不正ならinteractive decoration自体を付けず、document path / kindを含む`console.warn`を1回記録するため、利用者にdead controlを提示せず開発時の原因追跡性を残す。

## 7. Zoom仕様

### 7.1 Fit

available sizeを`viewport - 2 * padding`とし、次で求める。

```text
fitScale = min(
  1,
  availableWidth / intrinsicWidth,
  availableHeight / intrinsicHeight
)
```

初期状態と`Fit`操作は`scale=fitScale`、offset 0、mode `fit`とする。小画像は100%を超えて拡大しない。

### 7.2 100% / Reset

`100%`はnatural sizeへ戻すreset操作で、`scale=1`、offset 0、mode `custom`とする。ただし将来fitScaleが1を超える設計へ変わっても範囲外にならないよう共通clampを通す。

### 7.3 倍率範囲

- minimum: 現在geometryの`fitScale`
- maximum: 8.0（800%）
- button step: 1.25倍 / 0.8倍
- wheel / trackpad: native non-passive listenerでdelta量を共通zoom factorへ正規化する
- 表示倍率: natural sizeを100%とした整数percent

fitより縮小して周囲に無意味な空白を増やす操作は許可しない。800%はSVG文字とraster pixelの双方を確認でき、極端なtransform値を避ける上限として採用する。境界到達時は対応するZoom out / Zoom in buttonをdisabledにする。

wheelはReactのpassive合成eventを使わず、viewport refへ`addEventListener("wheel", handler, { passive: false })`をeffectで登録する。全wheel eventを`preventDefault`し、`ctrlKey || metaKey`を含むtrackpad pinchもimage zoomとして処理してWebView全体のbrowser zoomを防ぐ。`deltaMode`はpixel=1、line=16px、page=viewport heightへ換算し、normalized deltaを`[-100, 100]`へclampした後、`factor = exp(-normalizedDelta * 0.002)`とする。これにより1 eventの変化を約0.82倍から1.22倍へ制限する。listenerはeffect cleanupで必ず解除する。

### 7.4 Zoom中心

- toolbar buttonとkeyboard: viewport中央
- wheel / trackpad: pointer位置

pointer位置zoomでは、zoom前にpointer下にあったimage座標がzoom後も同じviewport位置に残るようoffsetを補正し、その後pan boundsへclampする。

## 8. Pan仕様

- primary pointerだけを受け付け、`setPointerCapture`でdragを継続する。
- pointer ID、開始座標、開始offsetをrefに保持する。
- `pointermove`で差分を加算し、policyでclampする。
- `pointerup` / `pointercancel` / lost captureでdrag stateを必ずclearする。
- contentがavailable viewport以下の軸はoffset 0へ固定する。
- contentが大きい軸は端へpaddingを残した状態まで移動できる。
- viewportは`touch-action: none`、idle時`grab`、drag中`grabbing`を示す。
- Arrow keyは48px、Shift+Arrowは160px移動する。
- viewer paddingは通常24px、window viewport 760px以下は12pxとし、geometry / testも同じ値を使う。

offset上限は次とする。

```text
maxOffsetX = max(0, (intrinsicWidth * scale - availableWidth) / 2)
maxOffsetY = max(0, (intrinsicHeight * scale - availableHeight) / 2)
```

## 9. Keyboardとfocus

| Key | 操作 |
| --- | --- |
| Enter / Space on adjacent viewer button | native button activationでviewerを開く |
| `+` / `=` | zoom in |
| `-` | zoom out |
| `0` | 100% reset |
| `f` / `F` | fit |
| Arrow | pan 48px |
| Shift+Arrow | pan 160px |
| Escape | close |
| Tab / Shift+Tab | dialog内focus loop |

viewportには短いvisible instructionを置き、toolbar buttonは英語labelと`aria-label`を一致させる。倍率のvisible `output`は各eventで更新するが、screen reader用`aria-live="polite"` textはzoom入力停止250ms後にdebounce更新し、wheel中の過剰通知を避ける。

## 10. Event delegationとstate lifecycle

### 10.1 Preview event順序

`handlePreviewClick`はanchor targetを先に判定する。SVG内anchorなら既存link処理へ渡し、それ以外は`resolveImageViewerSource`へ問い合わせる。requestが得られ、document selectionがcollapsedならprevent / stopしてviewerを開く。text selection中はviewerを開かない。requestがなければ既存anchor処理をそのまま実行する。

keyboard openはDOM adapterが追加するnative buttonのclick eventを同じdelegationへ渡す。Space / Enterのscroll抑止とactivationはnative buttonへ委ね、custom `onKeyDown`とsynthetic clickを重複実装しない。

### 10.2 State所有

`App`が`ImageViewerRequest | null`を所有する。transform、geometry、pointer dragはdialog内部の一時state / refとし、tab stateへ保存しない。

### 10.3 破棄条件

- explicit close
- backdropのpointer down / upがbackdrop自身で完結
- Escape
- active tab ID変更
- active tab revision変更
- document typeがMarkdown以外へ変化
- focusOriginまたはvisualがDOMから外れたことをclose時に検出

overlay中はapp shellがinertなため通常のtab / Reload / Theme操作はできず、Theme変更でviewerを閉じる分岐は追加しない。async completionなど外部state更新でrequestのtab / revisionと不一致になった場合はeffectで閉じる。PlantUML非同期完了はrevisionを変えずMarkdown DOMを差し替える場合があるが、cloneは独立しているためviewerを継続し、close時にorigin detachを検出してpreviewへfocusを戻す。

### 10.4 Window resize

`ResizeObserver`でviewer viewport geometryを更新する。

- mode `fit`: 新geometryでfitを再計算してcenterへ戻す
- mode `custom`: 現scaleを新しい`[fitScale, 8]`へclampし、offsetだけ新boundsへclampする

これによりfit表示は常に全体を保ち、拡大閲覧中は可能な範囲で利用者の倍率と位置を維持する。

## 11. コンポーネント責務と依存方向

```text
App
  -> MarkdownPreview event delegation
  -> imageViewer DOM adapter / source resolver (DOM -> typed request)
  -> ImageViewerDialog (modal lifecycle / DOM clone / input adapter)
       -> imageViewer pure policy (geometry / wheel / intrinsic candidates)

Markdown renderer / Mermaid / PlantUML cached HTML
  -> existing rendered DOM
  -> allowlisted clone only
```

- `imageViewer.ts` pure exports: DOMやReactへ依存しないfit / zoom / pan / wheel / intrinsic candidate policy。
- `imageViewer.ts` DOM adapter exports: Markdown preview DOMの3種allowlist、load後decoration、source候補読取だけを担当する。
- `ImageViewerDialog`: React lifecycle、focus、ResizeObserver、pointer capture、clone appendを担当する。
- `App`: active tab / revisionとの整合とopen / closeを調停する。

`imageViewer.ts`は既存`documentPolicy.ts` / `explorerPane.ts`と同じ「責務名を持つ専用module + 型付きexport関数 + 専用Vitest」とする。export関数はmodule lexical scopeに閉じ、汎用global namespaceへ公開しない。class stateを持たないpure計算をstatic-only classへ包むより既存frontend policy慣行を優先する例外である。React componentとhook lifecycleはframework contract上module scopeが必要なため、既存`App.tsx`のcomponent形式を継続する。

## 12. 採用しない案

### 12.1 CSS hover拡大だけ

viewport外へはみ出し、pan、keyboard、focus、close契約を提供できないため不採用。

### 12.2 新規window / OS browser

Tauri window権限、lifecycle、theme、asset URL境界が増え、文書閲覧中の一時確認として過剰なため不採用。

### 12.3 SVG再生成

Mermaid / PlantUMLをviewer openごとに再実行すると遅延、theme差、Java process増加が生じるため不採用。

### 12.4 SVG outerHTMLの再注入

serialize / parseと`dangerouslySetInnerHTML`の新規経路が必要で、cloneより安全性・保守性が劣るため不採用。

### 12.5 外部pan/zoom library

必要操作が限定的で、dependency、bundle、API lifecycle、security reviewの追加コストが大きいため不採用。typed pure policyで十分に検証可能である。

### 12.6 trusted HTMLも同時対応

opaque-origin sandbox iframeへ親Reactからアクセスできず、bridge拡張はsecurity boundary変更になるため不採用。必要性が確認された場合は独立spec-changeで扱う。

## 13. 互換性と移行

- 永続data / config変更はなくmigration不要。
- Rust / TypeScript command model変更なし。
- 通常時のpreview layout、image scaling、著者指定image titleを維持する。
- Mermaid effectの依存条件とstable `dangerouslySetInnerHTML` objectを維持する。
- PlantUML success HTMLは内側を変更せず、frontend候補wrapperと描画後decorationだけを追加する。
- external / relative / anchor link処理は画像領域pointer clickのviewer優先規則以外を維持し、linked imageのanchor keyboard navigationを残す。
- HTML iframe security contractは変更しない。

## 14. エラーハンドリング

- resolver対象外: 既存event処理へ戻す。pending / broken image / SVG dimension不明: interactive decorationを付けず、load成功時だけ再decorateし、失敗はconsoleへ1回記録する。
- invalid transform input: `RangeError`としてtestで顕在化し、silent defaultを使わない。
- clone append前にrequest visualがdisconnect: viewerを閉じ、active previewへfocusを戻す。
- ResizeObserver / pointer cleanup: effect cleanupでobserver、listener、pointer stateを破棄する。
- image asset load errorは既存Markdown画像表示の責務を維持し、新しいnetwork / filesystem fallbackは追加しない。

## 15. 性能とmemory

- viewer open時にだけ対象visualを1回cloneする。
- zoom / panはCSS transformだけを更新し、SVG再生成やRust invokeを行わない。
- pointermove state更新は1 transform objectに限定する。必要ならrequestAnimationFrame coalescingを実装時に計測するが、測定なしに複雑化しない。
- close / source変更でcloneとobserverを即時破棄する。
- 巨大SVGは一時的にDOM subtreeが2組になる。viewer用途では許容し、長時間cacheしない。

## 16. CSS方針

- `.image-viewer-backdrop`: fixed、app全体より上のz-index、theme別半透明背景。
- `.image-viewer-dialog`: viewport内全域に近いgrid。header / toolbar / canvas / instruction。
- `.image-viewer-viewport`: overflow hidden、overscroll-behavior contain、position relative、focus outline、touch-action none。
- `.image-viewer-content`: absolute center、transform origin center、max-width解除。
- cloneされた`img` / `svg`: DOM clone前処理でgenerator由来のinline sizeを正規化し、intrinsic pixel sizeを明示する。
- decorated visual: `cursor: zoom-in`。通常のimage sizingは変更しない。
- 隣接viewer buttonの通常状態: `.markdown-body`のtypography継承を打ち消すため`appearance: none`、`box-sizing: border-box`、明示font / line-height / margin / padding / border / background / colorを設定し、visually-hidden + non-reflow + `pointer-events: none`とする。
- 隣接viewer buttonの`:focus-visible`: visual右上のclamp済み座標へfixed配置した可視pillへ切り替え、1px以上のtheme対応outlineを出す。clip、overflow、寸法、marginを通常値へ戻し、`pointer-events: auto`とする。diagram containerのoverflowには入れない。
- 760px以下ではtoolbarをwrapし、viewerの操作領域を確保する。

## 17. 自動テスト

`imageViewer.test.ts`で少なくとも次を検証する。

1. 大画像 / 小画像 / 縦長画像と24px / 12px paddingのfit scale。
2. invalid / zero / non-finite geometryが`RangeError`になる。
3. zoom in / outがfitと800%でclampされる。
4. center zoomのoffset。
5. pan clampが発動しないgeometryでpointer anchor zoomの同一image座標が維持される。
6. 片軸だけoverflowする場合のpan clamp。
7. Arrow / drag相当deltaのpan clamp。
8. 100% resetがcenterとcustom modeを返す。
9. fit mode resizeは新fit、custom mode resizeはscale保持とoffset clamp。
10. `deltaMode`別wheel正規化、delta clamp、factor範囲。
11. intrinsic candidateのviewBox優先、invalid viewBox時width / height、次にbounding box、全候補不正時null。

既存`documentPolicy.test.ts`、`explorerPane.test.ts`も全件実行する。DOM event / focus / cloneは現在jsdom dependencyがないため新規test dependencyを増やさず、TypeScript buildと手動確認で検証する。

## 18. 手動確認scenario

`sample_docs/image_viewer.md`に既存`sample_docs/images/avalonia-markdown-viewer-architecture.png`を参照する通常画像、横長・縦長Mermaid、巨大PlantUMLを配置し、次を確認する。新規binary画像資産は追加しない。

1. 3種のvisualをclick、隣接viewer buttonへTab移動し、対象visual右上へ可視pillとfocus outlineが出ることを確認してEnter / Spaceで開く。描画前Mermaid / pending PlantUMLがTab順へ入らないことも確認する。
2. 初期fitで全体が見え、倍率が表示される。
3. toolbar、wheel / trackpad、`+` / `-`でfitから800%まで操作する。
4. drag、Arrow、Shift+Arrowで四隅と中央へ到達し、端で空白が過剰に露出しない。
5. `Fit`と`100%`が定義どおりcenterへ戻る。
6. backdrop、close、Escapeで閉じ、inert解除後に選択visualの隣接buttonへfocusが戻る。
7. Tab / Shift+Tabがdialog外へ出ず、背景Explorer / tab / previewが操作されない。overlay上のwheelで背後previewがscrollしない。
8. overlay表示中にwindowを拡大縮小し、fit / custom modeが仕様どおり更新される。
9. Light / Darkでtoolbar、背景、diagramが読める。
10. close後にTheme、tab切替、Reloadを行い、再度開いて前回transformが残らない。
11. 通常text link、anchor、relative Markdown link、画像以外のpreview scroll、`sample_docs/image_link.md`の著者指定tooltipが退行しない。linked imageの画像領域clickはviewer、anchor keyboard操作はnavigation、隣接buttonはviewerとなる。inline画像を含む段落の行組み、Mermaid / PlantUMLのborder・padding・横scroll幅がdecoration前後で変わらない。
12. trusted HTML fixtureが従来どおり表示され、画像viewer decorationがiframeへ侵入しない。

## 19. 検証コマンド

```bash
cd markdown-viewer-tauri
npm test -- --run
npm run build

cd src-tauri
cargo check
cargo fmt -- --check
```

## 20. 恒久ドキュメント更新予定

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`
- `docs/tests/README.md`（fixture / test catalogへ追加が必要な場合）
- `docs/history/`（Phase 4完了記録）

本変更はTauri Viewer局所のfrontend interaction契約であり、既存のiframe sandbox / custom protocol / typed bridge判断を変更しないためADRは起票しない。

## 21. リスクとfollow-up

| Risk | 対応 |
| --- | --- |
| 巨大SVG cloneの一時memory増加 | open中1 cloneだけに限定しcloseで破棄する |
| Mermaid DOM lifecycleとの競合 | source containerを維持し、生成成功後だけinner SVGをdecorate / cloneする |
| drag終了漏れ | pointer captureとup / cancel / lost capture cleanupを使う |
| zoom後に図を見失う | pointer anchor補正、pan clamp、常設Fit / 100%を提供する |
| modal focus漏れ | inert、focus trap、origin復帰を手動scenarioで確認する |
| linked imageの操作差分 | viewer優先を明示し、text link経路を回帰確認する |
| rasterを800%にして粗く見える | raster固有の正常挙動。SVGはvector品質を維持する |
| HTML画像の要望 | security境界が異なるため、必要時は独立spec-changeとして起票する |

現時点で別TODOを必須とするfollow-upはない。Avalonia水平展開はTauri UX評価後に要求が確定した場合だけ別項目として起票する。
