# Tauri Viewer インターフェース仕様

## ユーザー操作

- Open Folder: MenuBar の File dropdown からフォルダ選択ダイアログを開く。
- Recent Folders: MenuBar の File dropdown から最近開いた root folder を開く。
- Remove Recent Folder: Recent Folders entry の delete button から該当 entry を削除する。
- Explorer item click: 未openのMarkdown / HTMLはglobal document dataを作成し、active pane group末尾へtabを追加・選択する。同一pathがopen済みならdataを再利用し、active pane groupへdedupe追加・選択する。
- Explorer resize: ExplorerとPreview間のseparatorをpointerでdragする。separatorへfocus後、ArrowLeft / ArrowRightは16px単位、Home / Endは現在の最小 / dynamic最大幅へ移動する。
- Tab activate: TabStripから表示するdocumentを切り替える。ArrowLeft / ArrowRight / Home / Endでもfocusとselectionを移動できる。
- Tab close: 操作元pane groupだけからtabを削除する。active tabならsource local順の右隣、なければ左隣、なければ未選択へ移る。反対groupに同じIDが残る場合はglobal document dataと表示を維持し、どのgroupからも参照されなくなった時だけdataを破棄する。
- Tab move: split時だけactive tabの`→` / `←` buttonで反対paneへ移動する。source removal / fallbackとdestination add / selectをatomicに行い、destinationに同じIDがある場合は既存位置を維持してsourceだけから外す。完了後はdestination tabへfocusする。
- Reload: MenuBar の File dropdown から root treeとactive paneのselected tabだけを再読み込みする。同じtabを両paneで表示している場合は共有revision更新により両方を再描画する。
- Theme switch: MenuBar の View dropdown から Light / Dark を切り替える。
- Split View: MenuBarの`View > Split View`でsingle / 左右2 paneを切り替える。pane内をpointer操作またはfocusするとそのpaneがactiveになる。
- Split resize: pane間separatorをpointerでdragする。ArrowLeft / ArrowRightは16px単位、Home / Endはdynamic最小 / 最大幅へ移動する。
- Settings: MenuBar の File dropdown からSettings dialogを開き、Theme / current window size / PlantUML jar pathを確認する。Themeとjar pathを変更してSave、またはCancelできる。
- Markdown image viewer: 描画済みの通常画像、Mermaid、PlantUMLをclickするか、直後のkeyboard buttonをEnter / Spaceでactivateしてmodal表示する。wheel / trackpad、toolbar、keyboardでzoomし、drag / Arrowでpanする。

## MenuBar 表示

MenuBar は window top に `File` / `View` を表示する React UI で、menu name click により dropdown item を展開する。

- `File`: `Open Folder...`、`Recent Folders`、`Reload`、`Settings...`
- `Recent Folders`: 最大 10 件。主表示は保存時点の folder name、補助表示は absolute path。
- `View`: `Theme: Light` または `Theme: Dark`、`Split View` (`role="menuitemcheckbox"`)

Recent Folders entry click で保存済み path が存在しない場合は error strip に表示し、entry は自動削除しない。削除は delete button による明示操作だけで行う。

## Settings dialog

- `Theme`: Light / Dark select。
- `Window size`: 現在のlogical width x heightをread-only表示し、resizeで自動保存する。
- `PlantUML jar`: path input、`.jar` file picker、`Clear`。空欄はruntime directory自動探索を表す。
- `Save`: pathを検証してpreferencesを保存し、成功後にThemeへ反映して閉じる。
- `Cancel` / Escape / close / backdrop click: draftを破棄する。
- `role="dialog"` / `aria-modal="true"`、初期focus、Tab focus loop、dialog内validation alertを持つ。backgroundは`inert`とし、保存中に全controlがdisabledでもdialog containerへfocusを保持する。file picker失敗はdialog内alertへ表示し、Cancelはerrorにしない。

## Root Path Strip 表示

- `Root`: 選択中 root path。未選択時は `No folder selected`。

MenuBar 直下に常時表示する。長い path は ellipsis と `title` で全文確認できる。

## Explorer 表示

- 初期幅280px、最小幅180px、hard最大幅640pxとする。dynamic最大幅は`max(180, min(640, workspaceWidth - 320 - 6))`で、Preview予約幅320pxとseparator幅6pxを考慮する。
- 幅はsession中だけ保持し、root変更やReloadでは維持する。アプリ再起動またはfrontend reloadでは初期幅へ戻す。
- separatorは`role="separator"`、vertical orientation、`explorer-pane preview-workspace`への`aria-controls`、現在の有効範囲と値を公開する。
- pane titleは固定し、tree viewportだけが縦横scrollを所有する。深い階層・長い名前は省略せず、表示幅を超える場合だけ水平scrollで末尾へ到達可能にする。
- directoryは開閉chevronとfolder icon、Markdown / HTML / imageは種別ごとのinline SVG iconを表示する。iconは装飾扱いとし、node名をaccessible nameの正本にする。

## TabStrip 表示

- 各TabStripは自paneのgroupに属するMarkdown / HTMLだけを表示する。global document dataはroot内でpath一意とし、同一pathのdocumentを重複作成しない。
- active / Loading / Rendering / Errorを表示し、長いfile nameはellipsis、absolute pathは`title`で確認できる。
- 多数tabは横scrollで到達可能にする。`role="tablist"` / `role="tab"` とroving tabindexを使う。
- 各TabStripは自paneの`orderedTabIds`に属するtabだけをlocal挿入順で表示する。ArrowLeft / ArrowRight / Home / Endもlocal順へ適用する。
- single時はactivate / closeの2領域、split時はactivate / move / closeの3領域を持つ。activate buttonとactive tabのmove / close buttonだけをTabキーのfocus順に含める。非active tabを操作する場合は、先に矢印キーでactivateする。
- move buttonはprimaryで`→`、secondaryで`←`を表示し、accessible nameへdocument名とdestination paneを含める。close buttonもdocument名とsource paneを含める。
- 同じtab IDを両groupで参照できるが、document dataだけを共有し、選択とLoading / Rendering / Error表示、Markdown DOM、HTML iframeはpaneごとに分離する。
- DOM IDは`tab-${paneId}-${tabId}`、`document-preview-${paneId}`、`document-pane-${paneId}`とし、single時もprimary prefixを使う。
- tab永続化、reorder、pinは対象外。

## Split View 表示

- 初期modeはsingle、requested ratioは0.5、両groupはempty。split on時は両groupの所属・順序・選択を変更せずprimaryをactiveにするため、初回secondaryはemptyである。
- split off時はprimary / secondary groupをmerge、copy、clearせず、両groupの順序とactive tabを保持したままsingle / active primaryへ戻す。secondary pending navigationだけをclearし、split再有効化時は保持したsecondary groupを復元する。
- primary groupがempty、secondary groupだけがnonemptyのsingle viewでは、hidden document件数と`Enable Split View`の回復案内をprimary previewへ表示する。
- separator幅は6px、preferred pane minimumは240px。狭幅では`min(240, floor((workspaceWidth - 6) / 2))`まで等幅方向へ縮める。自動clampはrequested ratioへ書き戻さず、再拡大時に直前の指定比率へ戻す。
- `role="separator"`は計測完了後に描画し、`aria-controls="document-pane-primary document-pane-secondary"`とclamp済みpxのmin / max / nowを持つ。
- split mode、選択、比率はsession-onlyで、再起動後はsingle / 0.5へ戻る。上下分割、3 pane以上、layout persistenceは対象外。

## Document Preview 表示

- Markdown本文はpreview pane content boxから左右gutterを引いた幅へ追従し、固定px最大幅を持たない。
- 通常のMarkdown左右gutterは24pxとする。window viewportが760px以下の場合は既存responsive layoutにより14pxへ切り替える。Explorer resizeなどでpreview paneだけが狭くなってもgutterは切り替えない。
- Markdown内のtable、code block、Mermaid、PlantUMLは必要時に要素内で横scrollし、imageとPlantUML SVGは本文幅以下へ縮小する。
- 描画済みMermaidはwindow / Explorer resize後もSVG表示を維持し、元のdiagram source文字列へ戻らない。
- MermaidはApp所有queueでpane間を直列描画し、pane / tab / revision / diagram indexを含むrender IDで同一document内のSVG IDを分離する。
- trusted HTML iframeはpreview pane全幅へ追従し、HTML文書自身の`width` / `max-width`とsecurity境界をViewerから変更しない。
- documentの縦scrollは`.preview-pane`が所有し、app shell全体へscrollを移さない。

### Markdown image viewer

- 対象はMarkdown React DOM内のload済み通常画像、描画成功済みMermaid SVG、描画成功済みPlantUML SVG。trusted HTML iframe内の画像、pending / error diagram、dimension不明visualは対象外。
- pointer clickと隣接native buttonのEnter / Spaceで開く。SVG内anchorはlinkを優先する。linked imageの画像領域clickはviewerを優先し、link自体のkeyboard activationはnavigationを維持する。
- 初期表示と`Fit`はvisual全体をpadding 24px（window viewport 760px以下は12px）内へ収め、100%を超えて拡大しない。zoom範囲は現在のfit倍率から800%。`100%`はnatural size、offset 0へ戻す。
- `Zoom out` / `Zoom in`、wheel / trackpad、`+` / `-`を提供する。wheelはpointer位置、それ以外はviewport中央をzoom中心とする。現在倍率を整数percentで表示する。
- primary pointer drag、Arrow 48px、Shift+Arrow 160pxでpanする。visualがviewportより小さい軸は中央へ固定し、大きい軸は各端へ到達可能な範囲へclampする。
- `Escape`、Close、backdrop clickで閉じる。keyboard起点では発生元paneの起点button、pointer起点では発生元previewへfocusを戻す。発生元tab / revisionの変更、tab close、split offで発生元paneがunmountした場合も閉じ、接続済み起点がなければprimary paneへfocusを戻す。Tab / Shift+Tabはdialog内でloopし、表示中の背景UIは`inert`となる。
- 通常時の画像縮小、diagram containerのborder / padding / horizontal scroll、Markdown title、本文の行組みを変更しない。transform stateはclose / tab / Reloadを跨いで保持しない。

## Error Strip 表示

- `Error`: 代表エラー。エラー発生時のみ表示する。

StatusBar 直上に薄い赤背景で表示し、`role="alert"` で支援技術へ通知する。エラーがない場合は表示しない。

## StatusBar 表示

- `File`: 表示中 document file name。未選択時は `No file selected`。
- `State`: `Loading folder...`、`Updating app settings...`、`Loading Markdown...`、`Loading HTML preview...`、`Rendering PlantUML diagrams...`、`Rendering Mermaid diagrams...`、`Ready` のいずれか。active paneを対象に優先度順で表示する。

`State` の値だけを `aria-live="polite"` とし、`File` は live region に含めない。

## Tauri Commands

### `scan_directory(root_path: String) -> Result<FileTreeNode, String>`

root配下を走査し、Explorer表示用のツリーを返す。

成功したtree構築後だけ`DocumentStore.current_root`をcanonical rootへ切り替える。失敗時は旧rootを維持する。case-insensitiveな`.html`を列挙し、`.htm`は除外する。

除外ディレクトリ:

- `.git`
- `node_modules`
- `bin`
- `obj`
- `target`
- `.venv`
- `__pycache__`

### `open_document(path: String) -> Result<OpenDocumentResponse, String>`

`DocumentStore.current_root`配下のUTF-8 documentを開く。Markdownは`sourceText`、HTMLはRust生成のroot-relative`previewUrl`だけを返す。root未設定、root外、directory、unsupported extension、非UTF-8は`Err(String)`とする。旧`read_text_file` commandは提供しない。

`OpenDocumentResponse`:

- Markdown: `{ documentType: "markdown", sourceText: string, previewUrl: null }`
- HTML: `{ documentType: "html", sourceText: null, previewUrl: string }`

### `mvhtml` custom protocol

- URL: macOS / Linuxは`mvhtml://localhost/document/<segments>`、Windowsは`http://mvhtml.localhost/document/<segments>`。
- method: `GET` / `HEAD`。`OPTIONS`を含むその他は405。
- path: segment単位で一度だけpercent-decodeし、空、`.`、`..`、NUL、decode後separator、drive / UNC注入を拒否する。root join後にcanonicalizeし、root外symlinkを403で拒否する。
- resource: HTML、CSS、JS/MJS、JSON、SVG、PNG、JPEG、GIF、WebP、BMP、ICO、AVIF、WOFF/WOFF2だけを固定MIMEで配信する。
- CORS: Origin不在または厳密な`Origin: null`だけを許可し、success responseへ`Access-Control-Allow-Origin: null`を返す。JSONはsimple GETだけを対象とする。
- HTML: response CSPとViewer bridgeを注入し、`ready` / user-clicked `openExternal` messageだけをparentへ送る。

### `render_plantuml_diagrams(sources: Vec<String>) -> Result<PlantUmlRenderResponse, String>`

PlantUML source配列を受け取り、各図をSVG HTMLまたはエラーHTMLへ変換して返す。app config読込、明示jar missing、automatic discovery失敗などblocking task開始前のruntime解決失敗はcommand全体の`Err(String)`とする。runtime解決後のPlantUML構文エラー、Java process error、timeoutなどは図ごとの`PlantUmlDiagramResult`の`ok: false`として返す。frontendはcommand全体の`Err`でも全PlantUML placeholderをerror表示へ変換し、Markdown / Mermaid表示を維持する。

`PlantUmlRenderResponse`:

- `diagrams: PlantUmlDiagramResult[]`
- `firstError: string | null`

`PlantUmlDiagramResult`:

- `ok: boolean`
- `html: string`
- `error: string | null`

### `load_recent_folders() -> Result<Vec<RecentFolderEntry>, String>`

app config JSON から Recent Folders を読み込み、保存順の配列で返す。設定ファイルが存在しない場合は空配列を返す。

### `record_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>`

`path` を canonicalize し、directory であることを確認した上で Recent Folders の先頭へ保存する。同一 canonical path の既存 entry は削除してから先頭へ移動する。最大件数は 10 件。

### `remove_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>`

指定 `path` と一致する entry を Recent Folders から削除し、更新後の配列を返す。`path` の存在確認は行わない。

### `load_viewer_settings() -> Result<ViewerSettingsLoadResult, String>`

Viewer settingsを読む。範囲外window sizeは既定値へ部分正規化し、`warnings`へ理由を返す。malformed JSONは`Err`。

### `save_viewer_preferences(theme, plant_uml_jar_path) -> Result<ViewerSettingsLoadResult, String>`

ThemeとPlantUML jar pathだけをStore lock内で部分更新する。pathは空欄を`null`、それ以外はabsolute regular fileかつASCII case-insensitiveな`.jar`としてcanonicalizeする。

### `save_window_size(width, height) -> Result<WindowSize, String>`

logical sizeを検証し、window sizeだけを部分更新する。有効範囲はwidth 640..10000、height 480..10000。

## Frontend Types

`FileTreeNode`:

- `name: string`
- `path: string`
- `relativePath: string`
- `nodeType: "directory" | "markdown" | "html" | "image"`
- `children: FileTreeNode[]`

PlantUML frontend typesはTauri commandの `PlantUmlRenderResponse` / `PlantUmlDiagramResult` とcamelCaseで対応する。

`RecentFolderEntry`:

- `path: string`
- `name: string`
- `lastOpenedAt: string`

`name` は Rust 側で保存時に確定した値を表示上の正本とする。frontend は `name` が空の場合だけ `path` 全体を fallback 表示する。

`ViewerSettings`:

- `theme: "light" | "dark"`
- `windowSize: { width: number, height: number }`
- `plantUmlJarPath: string | null`

`ViewerSettingsLoadResult`:

- `settings: ViewerSettings`
- `warnings: string[]`

`OpenDocumentTab`:

- `id: string`
- `path: string`
- `displayName: string`
- `documentType: "markdown" | "html"`
- `sourceText: string | null`
- `previewUrl: string | null`
- `revision: number`
- `loadState: "loading" | "rendering" | "ready" | "error"`
- `errorMessage: string | null`
- `plantUmlDiagrams: PlantUmlDiagramResult[]`

Markdown / HTML / PlantUML responseは`tabId + revision`が現在値と一致する場合だけ適用する。close済み、Reload前、旧rootのresponseは無視する。

## HTML Preview / Message interface

- iframeは`sandbox="allow-scripts"`だけを持ち、`allow-same-origin`、forms、popup、top navigation、downloadを許可しない。
- HTML sourceはfrontendへ返さず、Theme変更だけではiframe URL / keyを変更しない。
- `ready`は`event.source === iframe.contentWindow`、`event.origin === "null"`、発生paneのselected tab / revision、exact message shapeを満たす最初の1回だけ受理する。5秒以内に届かなければ当該pane runtimeだけをerrorにする。
- `openExternal`は上記に加え、absolute `http:` / `https:`、transient user activation、duplicate guardを満たす場合だけ`openUrl`へ渡す。`file:`、`javascript:`、`data:`、`mailto:`、custom schemeは拒否する。
- reject理由はdevelopment consoleへ残し、messageを信頼境界とはみなさない。active pane条件はsecurity判定へ追加せず、pane間はiframe sourceとtab / revisionで区別する。HTMLは利用者が信頼するdocumentに限定する。
