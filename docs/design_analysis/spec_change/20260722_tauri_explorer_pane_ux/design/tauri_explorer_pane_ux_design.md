# Tauri Explorer ツリーペイン UX 改善 設計

## 1. 背景

Tauri版のworkspaceはExplorerを`280px`、Previewを残り幅とする固定2列である。Explorerの縦scrollは利用できるが、tree rowがpane幅へ縮小され、長い名前はellipsisになる。このため深い階層や長いdocument名を確認するにはtooltipへ依存し、利用者が閲覧対象に合わせてExplorer幅を調整できない。

tree nodeには`MD` / `HTML` / `IMG`の文字表現がある一方、directoryは開閉記号だけであり、開閉操作とnode種別の視覚表現が同じ領域へ混在している。今回、Explorerのlayout・overflow・node先頭表現を一体で見直す。

## 2. 目的と要求

1. ExplorerとPreviewの境界をpointerでdragし、Explorer幅を調整できる。
2. 同じseparatorをkeyboardでも操作できる。
3. tree contentがExplorerの表示幅を超えた場合だけ、Explorer内の水平scrollで末尾へ到達できる。
4. directory、Markdown、HTMLを識別できるアイコンを表示する。imageも既存nodeとして判別可能な表現を維持する。
5. Tauri版を先行実装し、Avalonia版は`TODO-2026-020`でstack固有のUIへ水平展開する。

## 3. 完了条件と設計対応

| 完了条件 | 設計対応 |
| --- | --- |
| pointerで最小・最大範囲内の幅変更 | Pointer Events、pointer capture、typed resize state、pure clamp policyを使う。 |
| keyboardで幅変更 | focus可能な`role="separator"`へArrowLeft / ArrowRight / Home / Endを割り当てる。 |
| Previewが残り幅へ追従 | workspaceを`Explorer / separator / minmax(0, 1fr)`の3列にする。 |
| content超過時だけ水平scroll | pane titleとscroll viewportを分離し、treeを`max-content`、viewportを`overflow: auto`にする。 |
| node種別を識別可能 | disclosureとtype iconを別要素にし、typed inline SVGを表示する。 |
| 既存操作を維持 | Rust契約、tree state、document open、tab、Preview stateは変更しない。 |
| build / test / manual verification | frontend policy unit test、既存frontend / Rust検証、UIシナリオを実施する。 |

## 4. 対象範囲

### 4.1 対象

- `App.tsx`
  - Explorer幅state、workspace計測、pointer / keyboard resize処理。
  - Explorer scroll viewportとseparatorのDOM。
  - disclosure / node type iconの表示責務。
- `explorerPane.ts`
  - 幅境界とkeyboard操作を扱う副作用のないExplorer固有layout policy。
- `explorerPane.test.ts`
  - 幅clampとkeyboard境界値のunit test。
- `App.css`
  - 3列workspace、separator、Explorer内scroll、tree intrinsic width、SVG icon。
- Tauri viewer component docsと開発・手動確認ルール。

### 4.2 非対象

- Explorer幅のapp config保存、再起動後復元。
- directoryごとの展開状態保存。
- tree nodeのdrag and drop、rename、context menu、file system監視。
- Rustのtree走査、`FileTreeNode` / `FileNodeType` data contract、document protocol。
- tab / split view、Preview内scrollの仕様変更。
- Avalonia版の同時変更。

## 5. Before / After

| 観点 | Before | After |
| --- | --- | --- |
| Explorer幅 | CSSで`280px`固定。狭幅media queryでは`220px`。 | 初期`280px`。session中にmin / dynamic max内で変更可能。 |
| workspace列 | Explorer / Previewの2列。 | Explorer / separator / Previewの3列。 |
| 幅操作 | なし。 | pointer drag、ArrowLeft / ArrowRight、Home / End。 |
| 長い名前 | ellipsis、`title`でpath確認。 | nameを省略せず、必要時だけtree viewportを横scroll。`title`も維持。 |
| directory先頭 | 開閉用`v` / `>`だけ。 | disclosure chevronとfolder iconを分離。 |
| file先頭 | `MD` / `HTML` / `IMG`文字。 | Markdown / HTML / imageのtyped SVG icon。 |
| pane title | Explorerのscroll領域内でsticky。 | scroll viewport外の固定header。 |
| 再起動 | 固定値へ戻る概念なし。 | 幅は永続化せず、再起動時は初期`280px`。 |

## 6. 採用案

### 6.1 幅policy

Explorer layout policyを`explorerPane.ts`へ閉じ込め、次の定数とpure functionを提供する。

| 値 | 設計値 | 理由 |
| --- | --- | --- |
| 初期幅 | 280px | 現行の通常window表示を維持する。 |
| 最小幅 | 180px | titleと短いnode名を保ちつつPreviewを確保する。 |
| hard最大幅 | 640px | 大画面でExplorerがworkspaceの大半を占有しない上限。 |
| Preview予約幅 | 320px | default 800px windowでdocument内容を確認できる幅を優先する。 |
| separator幅 | 6px | 1px線より広いpointer hit targetを確保する。 |
| keyboard step | 16px | 微調整可能で操作回数が過剰にならない単位。 |

dynamic maxは`min(640, workspaceWidth - 320 - 6)`とし、最小幅を下回るworkspaceでは180pxを優先してPreviewを残り幅へ縮小する。workspace未計測時だけhard最大幅を利用し、`ResizeObserver`の初回通知後に実寸へclampする。

`getExplorerWidthBounds(workspaceWidth)`、`clampExplorerWidth(width, workspaceWidth)`、`getExplorerWidthForKey(key, currentWidth, workspaceWidth)`をExplorer固有policyとして定義する。汎用splitter abstractionは作らない。現時点でsplit viewは未実装であり、向き・pane数・永続化が異なる将来機能まで先取りすると責務が曖昧になるためである。

### 6.2 React stateと計測

`App`は次を保持する。

- `requestedExplorerWidth`: 利用者が最後に要求した幅。初期280px。
- `workspaceWidth`: `ResizeObserver`で取得したworkspace content width。
- `isExplorerResizing`: drag中のselection抑止とcursor表示。
- `workspaceRef`: 計測対象。
- `explorerResizeRef`: active pointer ID、drag開始X、開始時の実効幅。

描画幅は`clampExplorerWidth(requestedExplorerWidth, workspaceWidth)`で求める。window縮小時に実効幅がdynamic maxへclampされても要求値自体は保持し、再拡大時は利用者が選んだ幅へ戻す。pointer / keyboard入力時は新しい要求値もその時点のboundsへclampする。

`ResizeObserver`はmount時にworkspaceをobserveし、cleanupでdisconnectする。I/OやTauri commandは発生しない。root変更、Reload、tab変更ではExplorer幅をresetしない。

### 6.3 Pointer操作

separatorの`onPointerDown`でprimary buttonだけを受け付ける。active pointer IDと開始位置を記録し、separatorへ`setPointerCapture`を行う。`onPointerMove`は一致するpointerだけを処理し、開始幅とX差分から新しい幅をclampする。

`pointerup` / `pointercancel`ではcaptureを解放し、resize stateを必ずclearする。pointer ID不一致は無視する。drag中はapp shellへclassを付与して`user-select: none`と`col-resize` cursorを適用する。HTML iframe上へpointerが移動してもseparatorがeventを受け続けるようpointer captureを正本とし、別のwindow listenerや透明overlayは重複追加しない。

### 6.4 Keyboardとaccessibility

separatorは次の契約を持つ。

- `role="separator"`
- `aria-orientation="vertical"`
- `aria-label="Resize Explorer pane"`
- `aria-controls="explorer-pane document-preview"`
- `aria-valuemin` / `aria-valuemax` / `aria-valuenow`
- `tabIndex={0}`

ArrowLeftは16px縮小、ArrowRightは16px拡大、Homeは最小、Endはdynamic maxへ移動する。処理したkeyだけ`preventDefault()`し、その他は既定動作を維持する。focus-visible時はtheme変数を使ったoutlineを表示する。

Explorerには`id="explorer-pane"`を付ける。directory buttonには既存button semanticsに加えて`aria-expanded`を設定する。iconとdisclosureはdecorativeなため`aria-hidden="true"`とし、node名をaccessible nameの正本にする。

### 6.5 Layoutと水平scroll

workspaceはinline styleのCSS custom property `--explorer-width`を受け取り、次の3列で表示する。

```text
var(--explorer-width) 6px minmax(0, 1fr)
```

狭幅media queryの固定`220px` overrideは削除し、全window幅で同じstate / clamp policyを正本にする。Explorer右borderはseparatorの中央線へ移し、二重線を避ける。

Explorerはheaderとscroll viewportの2行gridにする。

```text
aside.explorer-pane
├── div.pane-title
└── div.explorer-scroll (overflow: auto)
    └── FileTree
```

`.file-tree`は`width: max-content; min-width: 100%`、`.tree-row`は`width: max-content; min-width: 100%`とする。labelのellipsisを撤去し、`white-space: nowrap`を維持する。indent、leading icons、label、右paddingを含むintrinsic widthがviewportを超えた時だけ、`overflow: auto`によりhorizontal scrollbarが現れる。短いtreeでは各rowがviewport幅を満たし、hover / selected背景がpane端まで届く。

vertical scrollbarも同じ`.explorer-scroll`が所有する。app shell / workspaceの`overflow: hidden`、Previewの独立`overflow: auto`は維持する。

### 6.6 Tree icon

外部icon packageやnetwork assetは追加せず、`currentColor`を使う小さいinline SVGを採用する。`TreeNodeIcon` React componentがtyped `FileNodeType`とdirectoryのexpanded状態から次を選ぶ。

- directory: closed / open folder。
- markdown: document outline + Markdown識別形状。
- html: document outline + code識別形状。
- image: image outline。

directoryのdisclosure chevronはtype iconと分離し、file rowにも同じ幅のspacerを置いてlabel位置を揃える。SVG markupは`TreeNodeIcon`へ集約し、各branchへ重複させない。React function componentをmodule scopeへ置くのは、既存`FileTree` / `TreeNode`と同じframework component契約に従う例外であり、汎用global utilityは増やさない。

iconはnode名の代替ではないためaccessible nameを持たせず、色だけに依存しないshape差で種別を表現する。Light / Darkでは`currentColor`と既存theme変数を使う。

## 7. 不採用案

| 案 | 不採用理由 |
| --- | --- |
| CSS `resize: horizontal` | dynamic max、Preview予約幅、keyboard、ARIA値、pointer終了処理を一貫して制御できない。 |
| 固定幅候補をmenuで選択 | drag要求を満たさず、長いtreeごとの微調整ができない。 |
| window幅に対する百分率 | contentに合わせた直接操作にならず、window resizeで利用者の選択幅が変動する。 |
| widthをapp configへ保存 | user要求外であり、Viewer settings schema・競合制御・migrationまで変更範囲が広がる。 |
| tree labelのellipsisを残す | horizontal scrollbarを出す要求と競合し、content幅がpane幅を超えない。 |
| pane全体をheader込みでscroll | 横scroll時にExplorer titleまで移動し、操作対象の文脈が見えにくくなる。 |
| emoji / platform font icon | OS・WebView・fontで形状とbaselineが変わり、比較実装の視覚契約が安定しない。 |
| icon library追加 | 4種の小さいiconだけに依存追加とbundle増を持ち込む必要がない。 |
| 汎用SplitPane component | 現行はExplorer境界1つだけで、将来split viewの要件を先取りすると過剰抽象化になる。 |

## 8. コンポーネント責務と依存方向

```text
App (session state / DOM event coordination)
 ├─ explorerPane.ts (pure width and key policy)
 ├─ Explorer DOM / FileTree / TreeNode / TreeNodeIcon
 └─ App.css (layout / overflow / visual states)

Rust scan_directory ── FileTreeNode contract ──> App
                         （変更なし）
```

- DOM sizeとPointer EventsはReact `App`が所有する。
- 数値境界とkey mappingはDOMへ依存しない`explorerPane.ts`へ分離する。
- iconは表示責務であり、backend node typeを変更しない。
- filesystem / document open / config storeへの依存は追加しない。

## 9. UI / API / データモデル変更

### 9.1 UI契約

- ExplorerとPreview間にfocus可能なseparatorを追加する。
- Explorer内tree viewportへ縦横scrollを限定する。
- disclosureとtype iconを分離する。
- long nameをellipsisせず横scrollで到達可能にする。full pathの`title`は補助情報として維持する。

### 9.2 Frontend state

- Explorer幅・workspace幅・drag状態をsession-only stateとして追加する。
- `FileTreeNode`、`OpenDocumentTab`、Viewer settingsは変更しない。

### 9.3 Tauri / Rust API

- command、capability、CSP、protocol、filesystem contractは変更しない。

## 10. 互換性・移行・default

- 初期280pxにより通常windowでの既存layoutを維持する。
- 既存user configのmigrationは不要。Explorer幅をread / writeしない。
- root / tab / document stateとresize stateを独立させ、root変更やReloadで幅をresetしない。
- app再起動またはfrontend reloadでは280pxへ戻る。
- fixed 220px media queryは削除し、狭幅でもpure clamp policyだけを使用する。旧CSS経路は残さない。
- unsupported key、non-primary pointer、active IDと異なるpointer eventは明示的に無視し、代替resize経路へfallbackしない。

## 11. エラー・境界条件

- workspace未計測時はhard maxを使い、初回計測後に実効幅をclampする。
- workspaceが最小Explorer + Preview予約幅 + separator幅より狭い場合、Explorer最小幅を優先し、Previewは残り幅へ縮む。app shell全体のoverflowは発生させない。
- pointer cancel、component unmount、ResizeObserver cleanupでdrag / observer資源を残さない。
- Pointer EventsとResizeObserverは対象Tauri WebViewの標準APIを前提とし、mouse / touch別listenerやpolling fallbackは追加しない。
- 幅変更はlocal UI操作だけで失敗messageを持たない。NaNや非有限値はpure policyで初期幅へ正規化し、DOM styleへ不正値を渡さない。

## 12. 類似ロジックと抽象化方針

- 既存window resize queueはapp window sizeの永続化を担当し、ExplorerのDOM内layoutとは頻度・副作用・責務が異なるため共通化しない。
- 既存TabStrip horizontal overflowのCSSはscroll責務の参考にするが、tabのflex layoutとtreeのintrinsic hierarchyは異なるためselectorやcomponentを共用しない。
- `documentPolicy.ts`と同様、DOM非依存で直接test可能なpolicyを専用moduleへ置く。
- 将来のTODO-2026-006 split viewが同じ数値policyを必要とすると確定した時点で、方向・pane制約を比較して共通split policyを検討する。今回は先取りしない。

## 13. 影響範囲

| component | 変更 |
| --- | --- |
| `src/App.tsx` | state / refs、ResizeObserver、separator、pointer / key handler、Explorer viewport、icon component。 |
| `src/explorerPane.ts` | 幅bounds / clamp / key policy。 |
| `src/explorerPane.test.ts` | pure policyの境界値test。 |
| `src/App.css` | 3列grid、separator、tree scroll / intrinsic width、icon、drag / focus style。 |
| `docs/components/tauri_viewer/*` | responsibility、state、UI tree、interaction / overflow contract。 |
| `docs/rules/development_workflow.md` | Explorer resize / horizontal scroll / iconの手動確認項目。 |
| Rust / Tauri config | 変更なし。build / testのみ回帰確認。 |

## 14. 恒久ドキュメント更新予定

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`
- 完了時に`docs/history/`へ実装履歴を追加する。

ADRは追加しない。Explorer固有のsession layout判断であり、複数案件へ適用済みの横断判断ではない。

## 15. 自動テスト

`explorerPane.test.ts`で少なくとも次を確認する。

1. workspace未計測時のmin / hard max。
2. default 800px相当workspaceでPreview予約幅を差し引くdynamic max。
3. min未満、max超過、範囲内のclamp。
4. 非有限値をdefaultへ正規化する。
5. ArrowLeft / ArrowRightが16px単位で変化し、boundsを超えない。
6. Home / Endがその時点のmin / dynamic maxへ移動する。
7. unsupported keyは`null`を返す。

既存の`npm test -- --run`も全件実行し、document policyを回帰確認する。DOM pointer captureとCSS overflowの見え方はmanual UI verificationで確認する。

## 16. ユーザ確認シナリオ

1. default 800x600で起動し、Explorer初期幅が従来相当の280pxである。
2. separatorを左右へdragし、ExplorerとPreviewが追従する。
3. 最小値より左、dynamic maxより右へdragしても境界を超えない。
4. separatorへTabでfocusし、ArrowLeft / ArrowRight / Home / Endで幅を変更でき、focus indicatorとARIA値が対応する。
5. windowを狭めてdynamic maxが縮み、再拡大すると直前の要求幅へ戻る。
6. 深いdirectoryと長いMarkdown / HTML / image名を含むrootで、必要時だけ水平scrollbarが現れ、末尾へ到達できる。
7. 短いtreeでは不要な水平scrollbarが出ず、hover / selected背景がviewport幅を覆う。
8. directoryを開閉し、chevronとfolder icon、Markdown / HTML / image iconがLight / Darkで識別できる。
9. root選択、Reload、Markdown / HTML open、tab activate / close、Preview縦scrollを確認する。
10. resize中にpointerをPreview / HTML iframe側へ移動してrelease / cancelしてもdrag状態が残らない。

## 17. 検証コマンド

```bash
cd markdown-viewer-tauri
npm run build
npm test -- --run

cd src-tauri
cargo check
cargo test
cargo fmt -- --check
```

Rust source変更はないが、Tauri bundle境界を含む回帰として`cargo check` / `cargo test` / format checkを実行する。

## 18. リスクとfollow-up

| リスク | 対応 |
| --- | --- |
| intrinsic width指定により短いrowの背景がpane端まで届かない | `min-width: 100%`を併用し、短い／長いtreeをmanual確認する。 |
| scrollbarの常時表示設定がOSごとに異なる | `overflow: auto`を契約とし、content overflow時の到達性を確認する。 |
| iframe上でdrag eventが途切れる | pointer captureとpointercancel cleanupを使い、HTML tabでもmanual確認する。 |
| 狭いwindowでPreviewが読みにくい | Explorer最小幅とPreview予約幅を通常時のdynamic maxに使い、極端な狭幅ではPreviewを残り幅へ縮小してapp外枠overflowを避ける。 |
| SVG iconの細線がthemeで見えにくい | `currentColor`、既存muted/text変数、Light / Dark manual確認を使う。 |
| 幅永続化が必要になる | Tauri先行UX評価後、settings schema変更を伴う独立spec-changeとして起票する。 |

Avalonia水平展開は`TODO-2026-020`で行う。Tauriの数値を機械的に写さず、GridSplitter / TreeViewのDPI・min width・ScrollViewer契約に合わせて確定する。
