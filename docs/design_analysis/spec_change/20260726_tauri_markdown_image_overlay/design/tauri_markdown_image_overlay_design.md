# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 設計

## 1. 背景と目的

Tauri版のMarkdown本文はpreview pane幅へ追従し、通常画像とPlantUML SVGは本文幅以下へ縮小される。Mermaid / PlantUML containerには横scrollもあるが、巨大なUMLは全体表示時に文字が小さくなり、細部を読むには不十分である。

本変更では、Markdown preview内の通常画像、描画済みMermaid SVG、描画済みPlantUML SVGをクリックまたはkeyboard操作でmodal overlayへ開き、文書layoutを変えずにzoom / panできるようにする。

## 2. 要求と完了条件

| ID | 要求 | 設計上の対応 |
| --- | --- | --- |
| AC-1 | 通常画像、Mermaid、PlantUMLをpointer / keyboardから開ける | 3種のtriggerへ共通data属性、focus、event delegationを付与する |
| AC-2 | 初期fit、zoom、pan、fit/resetで細部へ到達できる | viewport中央基準のtransform modelとpointer captureを使う |
| AC-3 | 安全な倍率範囲と一貫した複数入力、倍率表示 | fit倍率から800%までclampし、button / wheel / keyを同じpolicyへ集約する |
| AC-4 | modal close、背景抑止、focus復帰 | `aria-modal`、focus trap、app shellの`inert`、Escape / close / backdrop、trigger復帰を使う |
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

- 通常画像、成功済みMermaid、成功済みPlantUMLを共通のimage viewer triggerとして表現する。
- trigger activate時はapp shell上へmodal overlayを表示する。
- viewerは`Zoom out`、倍率表示、`Zoom in`、`Fit`、`100%`、`Close`を提供する。
- viewport上のwheel / trackpad、drag、keyboardでも同じtransform policyを操作する。
- overlayを閉じると元triggerへfocusを戻す。元triggerが既にDOMから外れていればactive Markdown previewへ戻す。
- overlayを開いていない時の縮小、要素内scroll、link、anchor挙動は維持する。

### 3.3 既存linkとの優先順位

画像がMarkdown linkの子である場合、画像自身のclick / Enter / Spaceはviewer openを優先し、eventを`preventDefault`してlink navigationを同時実行しない。画像以外のlink textやlink自身へのkeyboard操作は既存契約を維持する。1入力でoverlayとnavigationを同時発火させないための意図した仕様差分である。

## 4. 対象範囲

### 4.1 対象

- `markdown-viewer-tauri/src/App.tsx`
  - image viewer stateとlifecycle調停
  - Markdown trigger生成、click / key event delegation
  - `ImageViewerDialog`
- `markdown-viewer-tauri/src/imageViewer.ts`
  - source解決とintrinsic size判定
  - fit、zoom、pan、resize時のpure transform policy
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

clone側にはviewer固有のsizeと`aria-hidden="true"`を設定する。script実行やnetwork URLの再解決を新たに行うsourceは受け付けず、既存Markdown rendererが生成した3種だけをresolverのselector allowlistで扱う。

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

DOM eventやReact state更新は`App.tsx`、数値計算は`ImageViewerTransformPolicy`のstatic methodへ分離する。invalid dimension、非有限値、0以下の倍率はprogramming errorとして`RangeError`にし、不正値をsilent fallbackで隠さない。

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

初期focusはviewportへ置き、close後はrequestが保持するtriggerへ戻す。triggerがunmount済みならactive previewへfallbackする。このfallbackはDOM lifecycle上必要なfocus回復だけであり、別の表示経路を残す互換fallbackではない。

Settings dialogは保存中close抑止や初期focus先が異なる。今回共通modal componentへ置き換えると既存設定UIの回帰範囲が広がるため、共通化しない。focus可能要素列挙の小規模重複は許容し、将来3個目のmodalが必要になった時点で独立refactoringを検討する。

## 6. Source triggerと解決規則

### 6.1 通常画像

Markdown-It image ruleで次を追加する。

- `class="image-viewer-trigger"`
- `data-image-viewer-kind="image"`
- `role="button"`
- `tabindex="0"`
- altを維持し、viewerを開けることを`title`とaccessible labelへ補足する

既存のrelative resource解決と`loading="lazy"`は維持する。未load、natural size 0、表示size 0の画像はresolverが拒否し、壊れた画像を空viewerで開かない。

### 6.2 Mermaid

fence ruleが生成する`.mermaid` containerへtrigger属性を付ける。`mermaid.run`後もouter containerは残るため、React外のSVG生成と共存できる。resolverはcontainer内の直近`svg`だけを採用し、source textの状態では開かない。

### 6.3 PlantUML

成功結果`result.ok === true`の時だけ、既存`result.html`をtrigger wrapperで囲む。pending / error HTMLにはtrigger属性を付けない。resolverはwrapper内の`.plantuml-diagram > svg`だけを採用する。

### 6.4 Resolver契約

`ImageViewerSourceResolver.resolve(eventTarget, tabId, revision)`はselector allowlistからtriggerとvisualを決定し、次を返す。

```text
ImageViewerRequest
  kind: "image" | "mermaid" | "plantuml"
  accessibleName: string
  intrinsicWidth: number
  intrinsicHeight: number
  visual: HTMLImageElement | SVGSVGElement
  trigger: HTMLElement
  tabId: string
  revision: number
```

SVG intrinsic sizeは正の`viewBox.width / height`、次に明示width / height、最後に正のrendered bounding boxの順で決める。通常画像は`naturalWidth / naturalHeight`を正本とする。allowlist外targetは`null`を返し、既存link処理へ渡す。allowlist内だがvisualやsizeが不正な場合も`null`とし、pending / broken visualをviewer対象にしない。

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
- wheel / trackpad: `deltaY`の方向を共通zoom factorへ正規化し、1 eventごとに急激なjumpを起こさない
- 表示倍率: natural sizeを100%とした整数percent

fitより縮小して周囲に無意味な空白を増やす操作は許可しない。800%はSVG文字とraster pixelの双方を確認でき、極端なtransform値を避ける上限として採用する。

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

offset上限は次とする。

```text
maxOffsetX = max(0, (intrinsicWidth * scale - availableWidth) / 2)
maxOffsetY = max(0, (intrinsicHeight * scale - availableHeight) / 2)
```

## 9. Keyboardとfocus

| Key | 操作 |
| --- | --- |
| Enter / Space on trigger | viewerを開く |
| `+` / `=` | zoom in |
| `-` | zoom out |
| `0` | 100% reset |
| `f` / `F` | fit |
| Arrow | pan 48px |
| Shift+Arrow | pan 160px |
| Escape | close |
| Tab / Shift+Tab | dialog内focus loop |

viewportには短いvisible instructionを置き、toolbar buttonは英語labelと`aria-label`を一致させる。倍率`output`は`aria-live="polite"`にするが、pointermove中は倍率が変わらないためpanで過剰通知しない。

## 10. Event delegationとstate lifecycle

### 10.1 Preview event順序

`handlePreviewClick`は最初に`ImageViewerSourceResolver`へ問い合わせる。requestが得られた場合はprevent / stopしてviewerを開き、それ以外は既存anchor処理をそのまま実行する。

`MarkdownPreview`へ`onKeyDown`を追加し、Enter / Spaceかつtrigger由来の場合だけviewerを開く。その他のkeyは変更しない。

### 10.2 State所有

`App`が`ImageViewerRequest | null`を所有する。transform、geometry、pointer dragはdialog内部の一時state / refとし、tab stateへ保存しない。

### 10.3 破棄条件

- explicit close
- backdropのpointer down / upがbackdrop自身で完結
- Escape
- active tab ID変更
- active tab revision変更
- document typeがMarkdown以外へ変化
- triggerまたはvisualがDOMから外れたことをclose時に検出

overlay中はapp shellがinertなため通常のtab / Reload / Theme操作はできない。async completionなど外部state更新でrequestのtab / revisionと不一致になった場合はeffectで閉じる。

### 10.4 Window resize

`ResizeObserver`でviewer viewport geometryを更新する。

- mode `fit`: 新geometryでfitを再計算してcenterへ戻す
- mode `custom`: 現scaleを新しい`[fitScale, 8]`へclampし、offsetだけ新boundsへclampする

これによりfit表示は常に全体を保ち、拡大閲覧中は可能な範囲で利用者の倍率と位置を維持する。

## 11. コンポーネント責務と依存方向

```text
App
  -> MarkdownPreview event delegation
  -> ImageViewerSourceResolver (DOM -> typed request)
  -> ImageViewerDialog (modal lifecycle / DOM clone / input adapter)
       -> ImageViewerTransformPolicy (pure geometry)

Markdown renderer / Mermaid / PlantUML cached HTML
  -> existing rendered DOM
  -> allowlisted clone only
```

- `ImageViewerTransformPolicy`: DOMやReactへ依存しない数値policy。
- `ImageViewerSourceResolver`: Markdown preview DOMの3種allowlistとsize解決だけを担当する。
- `ImageViewerDialog`: React lifecycle、focus、ResizeObserver、pointer capture、clone appendを担当する。
- `App`: active tab / revisionとの整合とopen / closeを調停する。

module直下の新規global計算関数は追加せず、policy / resolver classのstatic methodへ置く。React componentとhook lifecycleはframework contract上module scopeが必要なため、既存`App.tsx`のcomponent形式を継続する。

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
- 通常時のpreview layoutとimage scalingを維持する。
- Mermaid effectの依存条件とstable `dangerouslySetInnerHTML` objectを維持する。
- PlantUML success HTMLは内側を変更せず、frontend trigger wrapperだけを追加する。
- external / relative / anchor link処理は画像trigger優先規則以外を維持する。
- HTML iframe security contractは変更しない。

## 14. エラーハンドリング

- resolver対象外、pending、broken image、SVG dimension不明: viewerを開かず既存event処理へ戻す。
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
- `.image-viewer-viewport`: overflow hidden、position relative、focus outline、touch-action none。
- `.image-viewer-content`: absolute center、transform origin center、max-width解除。
- cloneされた`img` / `svg`: intrinsic pixel sizeを明示し、Markdown側`max-width: 100%`の影響を受けないviewer固有selectorを使う。
- trigger: `cursor: zoom-in`とfocus-visible outline。通常のimage sizingは変更しない。
- 760px以下ではtoolbarをwrapし、viewerの操作領域を確保する。

## 17. 自動テスト

`imageViewer.test.ts`で少なくとも次を検証する。

1. 大画像 / 小画像 / 縦長画像のfit scale。
2. invalid / zero / non-finite geometryが`RangeError`になる。
3. zoom in / outがfitと800%でclampされる。
4. center zoomのoffset。
5. pointer anchor zoomで同じimage座標が維持される。
6. 片軸だけoverflowする場合のpan clamp。
7. Arrow / drag相当deltaのpan clamp。
8. 100% resetがcenterとcustom modeを返す。
9. fit mode resizeは新fit、custom mode resizeはscale保持とoffset clamp。

既存`documentPolicy.test.ts`、`explorerPane.test.ts`も全件実行する。DOM event / focus / cloneは現在jsdom dependencyがないため新規test dependencyを増やさず、TypeScript buildと手動確認で検証する。

## 18. 手動確認scenario

`sample_docs/image_viewer.md`に通常画像、横長・縦長Mermaid、巨大PlantUMLを配置し、次を確認する。

1. 3種をclick、Tab移動後Enter / Spaceで開く。
2. 初期fitで全体が見え、倍率が表示される。
3. toolbar、wheel / trackpad、`+` / `-`でfitから800%まで操作する。
4. drag、Arrow、Shift+Arrowで四隅と中央へ到達し、端で空白が過剰に露出しない。
5. `Fit`と`100%`が定義どおりcenterへ戻る。
6. backdrop、close、Escapeで閉じ、元triggerへfocusが戻る。
7. Tab / Shift+Tabがdialog外へ出ず、背景Explorer / tab / previewが操作されない。
8. overlay表示中にwindowを拡大縮小し、fit / custom modeが仕様どおり更新される。
9. Light / Darkでtoolbar、背景、diagramが読める。
10. close後にTheme、tab切替、Reloadを行い、再度開いて前回transformが残らない。
11. 通常text link、anchor、relative Markdown link、画像以外のpreview scrollが退行しない。
12. trusted HTML fixtureが従来どおり表示され、画像viewer triggerがiframeへ侵入しない。

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

## 21. リスクとfollow-up

| Risk | 対応 |
| --- | --- |
| 巨大SVG cloneの一時memory増加 | open中1 cloneだけに限定しcloseで破棄する |
| Mermaid DOM lifecycleとの競合 | outer triggerを維持し、生成済みinner SVGだけをcloneする |
| drag終了漏れ | pointer captureとup / cancel / lost capture cleanupを使う |
| zoom後に図を見失う | pointer anchor補正、pan clamp、常設Fit / 100%を提供する |
| modal focus漏れ | inert、focus trap、trigger復帰を手動scenarioで確認する |
| linked imageの操作差分 | viewer優先を明示し、text link経路を回帰確認する |
| rasterを800%にして粗く見える | raster固有の正常挙動。SVGはvector品質を維持する |
| HTML画像の要望 | security境界が異なるため、必要時は独立spec-changeとして起票する |

現時点で別TODOを必須とするfollow-upはない。Avalonia水平展開はTauri UX評価後に要求が確定した場合だけ別項目として起票する。
