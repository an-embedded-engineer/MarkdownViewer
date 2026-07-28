# Tauri Viewer 詳細設計

## 状態管理

`App` (`src/App.tsx`) が React の `useState` で次を保持する。

| state | 役割 | 補足 |
| --- | --- | --- |
| `rootPath` | 選択中フォルダ | `string \| null` |
| `fileTree` | Explorer 用 root ノード | `FileTreeNode \| null` |
| `tabs` | open中Markdown / HTMLと描画cache | `OpenDocumentTab[]`。pathはcollection内で一意 |
| `splitViewState` | single / split、active pane、paneごとのordered tab ID / active tab / pending anchor、requested ratio | `SplitViewState`。pane-local所属・順序・表示選択の唯一の正本 |
| `panePreviewStatuses` | Mermaid / HTML handshakeのpane-local状態 | primary / secondaryごとの`PanePreviewStatus \| null` |
| `theme` | `"light" \| "dark"` | `<html data-theme>` に反映 |
| `rootOperationError` | root / Recent Foldersの代表error | active tab errorより表示優先度が高い |
| `isRootLoading` | root tree scan中フラグ | root collection交換操作のglobal busy |
| `isRecentFoldersBusy` | Recent Folders command 実行中フラグ | app config JSON 読み書き中の重複操作を抑止 |
| `recentFolders` | 最近開いた root folder 一覧 | `RecentFolderEntry[]`。app config JSON から復元 |
| `activeMenu` | 開いている MenuBar dropdown | `"file"` / `"view"` / `null` |
| `requestedExplorerWidth` | 利用者が最後に要求したExplorer幅 | 初期280px。window縮小時の実効clamp後も保持し、再拡大時に復元 |
| `workspaceWidth` | workspace content width | `ResizeObserver`で計測。未計測時は`null` |
| `isExplorerResizing` | Explorer separator drag中フラグ | app shellのselection抑止と`col-resize` cursorに使用 |
| `splitWorkspaceWidth` | PreviewWorkspace content width | Split View幅policy用。未計測時は`null` |
| `isSplitResizing` | Split separator drag中フラグ | Explorer resizeとは独立したpointer lifecycle |
| `isGlobalBusy` | `isRootLoading OR isRecentFoldersBusy` | root競合操作だけを抑止。tab activate / closeは許可 |
| `nextTabIdRef` | tab ID採番 | close後も再利用しない単調増加counter |

各tabの`revision`はReload時に増加し、MarkdownのMermaid / PlantUML再描画、HTML iframe remount、stale async response排除に使う。active tab、error、loading表示は`tabs + splitViewState + panePreviewStatuses`から導出し、旧global `activeTabId` / `pendingNavigation`を並存させない。`splitView.ts`がpane-local group invariant、open / select / local close / atomic move、参照集合、generic resolver、split状態遷移と幅計算を担当し、`paneRuntime.ts`がpane / tab / revision guardとTabStrip表示state合成を担当する。Appはprimary / secondaryのordered IDを`useMemo`でglobal `tabs`へ解決し、missing IDはintegration errorとしてthrowする。

## クラス / モジュール図

```plantuml
@startuml
skinparam shadowing false
hide empty members

package "Frontend (src/App.tsx)" {
  class App {
    +rootPath
    +fileTree
    +tabs
    +splitViewState
    +panePreviewStatuses
    +theme
    +recentFolders
    +activeMenu
    +isRootLoading
    +openFolder()
    +loadRoot(path)
    +recordRecentFolder(path)
    +openRecentFolder(path)
    +removeRecentFolder(path)
    +reload()
    +openOrActivateTab(paneId, file, anchor?)
    +loadTab(tabId, file, revision)
    +activateTab(paneId, tabId)
    +closeTab(paneId, tabId)
    +moveTab(sourcePaneId, tabId)
    +handlePreviewClick(paneId, tab, preview, event)
  }
  class DocumentPane
  class MenuBar
  class RootPathBar
  class FileTree
  class TreeNode
  class TabStrip
  class MarkdownPreview
  class HtmlPreview
  class ErrorBanner
  class StatusBar
  class renderMarkdown <<function>> {
    +md.renderer.rules.fence
    +md.renderer.rules.image
    +md.renderer.rules.heading_open
  }
  class extractPlantUmlSources <<function>>
  class resolveSiblingPath <<function>>
}

package "Tauri JS API" {
  class invoke <<fn>>
  class convertFileSrc <<fn>>
  class openDialog <<fn>>
  class openUrl <<fn>>
}

package "Rust backend (src-tauri/src/lib.rs)" {
  class "scan_directory" as Scan <<command>>
  class "open_document" as Read <<command>>
  class DocumentStore
  class "render_plantuml_diagrams" as Render <<command>>
  class "load_recent_folders" as LoadRecent <<command>>
  class "record_recent_folder" as RecordRecent <<command>>
  class "remove_recent_folder" as RemoveRecent <<command>>
  class AppConfigStore
  class build_tree
  class render_plantuml_diagram
  class render_plantuml_svg
  class resolve_plantuml_runtime
  class sanitize_svg
}

App --> MenuBar
App --> RootPathBar
App --> FileTree
FileTree --> TreeNode
App --> DocumentPane
DocumentPane --> TabStrip
DocumentPane --> MarkdownPreview
DocumentPane --> HtmlPreview
App --> ErrorBanner
App --> StatusBar
MarkdownPreview --> renderMarkdown
App --> extractPlantUmlSources
App --> resolveSiblingPath
App --> invoke
App --> convertFileSrc
App --> openDialog
App --> openUrl
invoke ..> Scan : "scan_directory"
invoke ..> Read : "open_document"
invoke ..> Render : "render_plantuml_diagrams"
invoke ..> LoadRecent : "load_recent_folders"
invoke ..> RecordRecent : "record_recent_folder"
invoke ..> RemoveRecent : "remove_recent_folder"
Scan --> build_tree
LoadRecent --> AppConfigStore
RecordRecent --> AppConfigStore
RemoveRecent --> AppConfigStore
Render --> render_plantuml_diagram
render_plantuml_diagram --> render_plantuml_svg
render_plantuml_svg --> resolve_plantuml_runtime
render_plantuml_diagram --> sanitize_svg
@enduml
```

## 処理フロー (Open Folder → Preview)

1. `@tauri-apps/plugin-dialog` の `open({ directory: true })` でフォルダを選択する。
2. `scan_directory` command で Explorer 用ツリーを取得する。
3. `record_recent_folder` command で選択 root を Recent Folders へ保存する。document file が 1 つもない root でも、`scan_directory` が成功した directory であれば保存対象にする。
4. `findReadme` → `findFirstMarkdown` → `findFirstHtml` の順で初期表示ファイルを決める。
5. 初期documentをloading tabとして作成し、`open_document` commandのdiscriminated responseで分岐する。Markdownは本文を保持し、HTMLはpreview URLだけを保持する。Explorer選択も同じ`openOrActivateTab`を使い、同一pathなら既存tabをactivateする。
6. `renderMarkdown` (`markdown-it`) で HTML 化する。fence rule で:
   - `mermaid` → `<div class="mermaid">`
   - `plantuml` / `puml` → `plantUmlDiagrams[i].html` (pending / 成功 / エラー)
   - 画像の `src` は `isRelativeResource` を満たす場合に `convertFileSrc` で asset URL に置換し、`loading="lazy"` を付ける。
   - heading は `slugify(name)` を `id` に付与する。
7. `loadTab`が`extractPlantUmlSources`でfenceを抽出し、tabへpending placeholderを設定して`render_plantuml_diagrams`をinvokeする。結果は`tabId + revision`一致時だけtab cacheへ反映する。
8. 各`DocumentPane`のeffectがselected tab ID / revision / PlantUML結果 / themeの変化でMermaid taskをApp所有queueへ投入する。queue内で`securityLevel: "strict"`を初期化し、pane / tab / revision / diagram indexを含むIDで`mermaid.render`を直列実行する。
9. paneの`pendingNavigation`がselected tabと一致する場合は80ms後にそのpane内だけをanchor scrollし、pane / tab / revision guard後にclearする。

```plantuml
@startuml
skinparam shadowing false
actor User
participant "App (React)" as App
participant "plugin-dialog" as Dlg
participant "invoke" as Inv
participant "Rust\nscan_directory" as Scan
participant "Rust\nopen_document" as Read
participant "renderMarkdown\n(markdown-it)" as MD
participant "WebView DOM" as DOM
participant "mermaid" as Mer

User -> App : Open Folder click
App -> Dlg : open({ directory: true })
Dlg --> App : path
App -> Inv : invoke("scan_directory", { rootPath })
Inv -> Scan : command
Scan --> Inv : FileTreeNode
Inv --> App : FileTreeNode
App -> Inv : invoke("record_recent_folder", { path })
Inv --> App : RecentFolderEntry[]
App -> App : findReadme / findFirstMarkdown / findFirstHtml
App -> Inv : invoke("open_document", { path })
Inv -> Read : command
Read --> Inv : OpenDocumentResponse
Inv --> App : typed document response
App -> App : create tab / revision = 1
App -> MD : renderMarkdown(markdown, path, plantUmlDiagrams)
MD --> App : HTML
App -> DOM : dangerouslySetInnerHTML = HTML
App -> Mer : App queue -> mermaid.render(pane-scoped id)
@enduml
```

## PlantUML レンダリング

PlantUML 表示は Rust 側の `render_plantuml_diagrams` command で行う。React は Markdown 本文から `plantuml` / `puml` fenced code block を抽出し、source 配列として command へ渡す。Rust command は app configを読み、全sourceで共有するruntimeをblocking task開始前に1回だけ解決する。runtime / app config解決失敗はcommand全体の`Err`とし、runtime解決後は`tauri::async_runtime::spawn_blocking`経由で各 source を順次 `java -jar <plantuml.jar> -tsvg -pipe` に渡し、SVG HTMLまたは図単位のエラーHTMLを返す。Windowsでは`CREATE_NO_WINDOW`を指定し、Java起動時のterminal windowを表示しない。

```plantuml
@startuml
skinparam shadowing false
participant "App (useEffect)" as App
participant "invoke" as Inv
participant "Tauri async_runtime\nspawn_blocking" as Tk
participant "render_plantuml_diagrams_blocking" as Block
participant "render_plantuml_svg" as RSvg
participant "resolve_plantuml_runtime" as RR
participant "java + plantuml.jar" as J

App -> App : extractPlantUmlSources(markdown)
App -> App : setPlantUmlRenderState({pending})
App -> Inv : invoke("render_plantuml_diagrams", { sources })
Inv -> RR : app configからruntimeを1回解決
RR --> Inv : PlantUmlRuntimeOptions / command Err
Inv -> Tk : spawn_blocking
Tk -> Block : 各 source を順次処理
loop 各 source
  Block -> RSvg : render_plantuml_svg
  RSvg -> J : Command::new("java")\n-jar <jar> -tsvg -pipe
  RSvg -> J : stdin: normalized source
  J --> RSvg : stdout SVG / stderr error
  RSvg -> RSvg : sanitize_svg\n(<script> / on* 除去)
  alt 成功
    RSvg --> Block : Ok(svg)
    Block -> Block : PlantUmlDiagramResult { ok: true, html }
  else 失敗
    RSvg --> Block : Err(message)
    Block -> Block : ok: false, html: <pre class="plantuml-error">
    Block -> Block : first_error.get_or_insert(message)
  end
end
Block --> Tk : PlantUmlRenderResponse
Tk --> Inv : Result
Inv --> App : { diagrams, firstError }
App -> App : setPlantUmlRenderState({ key, diagrams })
App -> App : (再描画で markdown-it の fence rule が差し替え)
@enduml
```

- タイムアウトは 10 秒。`render_plantuml_svg` 内で `try_wait` ループしつつ 20ms スリープで監視し、超過時は `child.kill()`。stdout / stderr は別スレッドで読み出し、デッドロックを避ける。
- `sanitize_svg` は `<script>...</script>` ブロックの除去と `on*` イベントハンドラ属性の除去を 2 段で行う。
- `assetProtocol` を使うため `convertFileSrc` 経由で相対画像が表示できる。

### PlantUML runtime 解決

```plantuml
@startuml
skinparam shadowing false
start
:plantuml_runtime_directories();
note right
  current_exe の親が
  ".../Contents/MacOS"
  → そのディレクトリだけを使う
  それ以外 →
  [CARGO_MANIFEST_DIR] (debug only)
  current_dir
  exe_dir
end note
repeat
  if (plantuml.config.json) then (あり)
    :resolve_plantuml_runtime_from_config\nplantUmlJarPath を解決;
    if (jar.is_file?) then (yes)
      :return PlantUmlRuntimeOptions;
      stop
    else (no)
      :return Err("PlantUML jar was not found");
      stop
    endif
  elseif (plantuml.jar) then (あり)
    :return PlantUmlRuntimeOptions;
    stop
  endif
repeat while (次の directory?)
:return Err("PlantUML runtime is not configured…");
stop
@enduml
```

- Tauri dev では `markdown-viewer-tauri/src-tauri/` (`CARGO_MANIFEST_DIR`) をランタイムディレクトリとして先に探索する。
- macOS bundle では `<app>.app/Contents/MacOS/` をランタイムディレクトリとし、Finder 起動時の current_dir に依存しない。
- 相対 `plantUmlJarPath` は config file のディレクトリ基準で解決する。

### 再描画方針

- Theme切替やtab activateだけでは`render_plantuml_diagrams`を再実行しない。invokeするのは新規tab読込またはactive paneのselected tab Reload時だけで、結果をtab単位にcacheする。
- PlantUML結果待ちのtabは`loadState=rendering`とし、activeの場合はStatusBarへ`Rendering PlantUML diagrams...`を表示する。別tabのactivate / close / openは許可するため複数Java processが並行し得るが、MVPでは上限・queueを設けずPhase 4で体感を確認する。
- PlantUML の pending placeholder は `.plantuml-loading` で、最終失敗時のみ `.plantuml-error` を使う。これにより pending 状態と失敗状態が視覚的に区別される。

## ローカル画像

相対画像は`resolveSiblingPath(activeTab.path, src)`で絶対パスへ解決し、`convertFileSrc`で`asset://` URLへ変換する。`isRelativeResource`で`data:` / `file:` / `http(s)://` / `#anchor` / 絶対パスは対象外とする。

## Markdown image viewer

- `createImageViewerDomAdapter`は各selected Markdown previewを走査し、load済み通常画像、描画済みMermaid SVG、`.plantuml-diagram > svg`へ同一opaque IDのvisual markerとnative keyboard buttonを付与する。pending / error / invalid sizeは操作対象にしない。
- keyboard buttonは通常時visually hiddenかつ文書flow外とし、focus時だけ対象visual右上へfixed pillとして表示する。通常画像は`img`直後、linked imageは`a`直後、diagramはcontainer直後へ挿入して既存layoutとnested interactive回避を両立する。
- `resolveImageViewerSource`はactive preview root内のID一致visual / buttonが各1個の場合だけ`ImageViewerRequest`を返す。SVG内anchorは既存link処理を優先し、linked imageの画像領域clickはviewerを優先する。
- `ImageViewerDialog`は描画済みvisualを`cloneNode(true)`し、app shellのsiblingに表示する。app shellは`inert`となる。requestに発生元paneを付加し、close後はkeyboard起点ならbutton、pointer起点なら発生元Markdown previewへfocusを戻す。復帰先がdetach済みならprimary paneへfallbackする。
- 初期scaleは左右上下padding内へ収まる`min(1, availableWidth / intrinsicWidth, availableHeight / intrinsicHeight)`。下限は現在のfit、上限は8.0。toolbar / wheel / keyboardは同じpolicyを利用し、drag / Arrow keyのpanをbounds内へclampする。
- viewer stateはtabへ永続化せず、close、発生元paneのtab / revision / document type変更、tab close、split offによるpane unmountで破棄する。ResizeObserverはfit modeを再fitし、custom modeはscaleを維持してoffsetを再clampする。

## Multi-tab処理

- `OpenDocumentTab`はdocumentType、Markdown sourceまたはHTML preview URL、revision、loadState、error、PlantUML結果を保持する。
- `PaneState.orderedTabIds`はpane-local所属と挿入順を保持し、同じIDのprimary / secondary両group参照を許可する。nonempty groupのactive tabは必ずmemberであり、pending navigationはactive tabと一致する。
- 新規openはglobal dataを作成し、active pane group末尾へ追加・選択する。同一pathはdataを重複せず、そのpane groupへdedupe追加・選択する。
- local closeはsource groupだけからIDを外し、activeならsource local順の右、なければ左へfallbackする。reducer適用後の両group参照集合がemptyの場合だけglobal dataを削除する。
- moveはsource removal / fallbackとdestination dedupe add / selectを`move-tab` actionでatomicに更新する。destinationに同じIDがある場合は既存位置を維持し、move後はdestination tabへfocusする。
- 各paneのTabStripはlocal viewだけを描画し、横overflow、roving tabindex、ArrowLeft / ArrowRight / Home / Endを提供する。split時はactive tabにpane間move buttonを加える。
- split off / onは両groupの所属・順序・active tabを変更しない。singleでprimaryがempty、secondaryだけがnonemptyならhidden件数と`Enable Split View`案内を表示する。
- Reloadはtree scan成功後、active paneのselected tabの同じIDでrevisionを増やし、旧content / URLをclearして再openする。共有tab revisionにより同じtabを表示する両paneが再描画される。
- root scan成功をcommit pointとし、成功後に旧tabsを破棄して両pane選択をclearする。split mode / requested ratioは維持し、初期文書はprimaryへ開く。scan失敗時は旧root / tabs / pane stateを維持する。
- document responseは`tabId + revision`、pane DOM結果は`paneId + tabId + revision`でguardし、close済み、Reload前、旧root、unmount済みpaneの結果を無視する。
- pane preview statusのclearは`isPanePreviewStatusCurrent`を使うgeneric effectだけが行う。open / close / move / Reload / root reset / split toggle handlerは独自clearを持たない。

## リンク処理

- `http(s)://` / `mailto:`: `@tauri-apps/plugin-opener` の `openUrl` で OS 既定ブラウザを開く。
- `#anchor`: `previewRef` 内で `scrollIntoView`。
- 相対 `.md` / `.markdown`: `resolveSiblingPath` でパス解決し、`openOrActivateTab`で既存tabを再利用または新規openする。`#anchor`はApp/pane-levelの`pendingNavigation`から読み込み後80msでscrollする。

## trusted HTML preview

- `DocumentStore`は成功した`scan_directory`のcanonical rootを`RwLock<Option<PathBuf>>`へ保持し、`open_document`と`mvhtml` protocolが共有する。protocol read中はread lockを保持する。
- HTML URLはRustがroot-relative segmentを個別percent-encodeして生成し、absolute filesystem pathをWebViewへ公開しない。`convertFileSrc`はMarkdown asset imageだけに使う。
- protocolは`/document/` prefix、segment decode、separator / dot / drive注入、canonical root、symlink、regular file、固定MIME allowlistを検証する。GET / HEAD以外は405、root未設定409、invalid 400、root外403、missing 404とする。
- HTML responseへCSPとbridgeを注入する。各paneのiframeは`sandbox="allow-scripts"`だけを持ち、bridgeの`ready`が5秒以内にsource / opaque origin / pane selection / revision policyを通った場合だけpane runtimeをreadyにする。
- `openExternal`は発生paneのiframe source、`Origin: null`、exact shape、ready済み、transient user activation、pane-local duplicate guard、`http(s)` URLを満たす場合だけOS browserへ渡す。active paneであることはsecurity条件にしない。
- HTML branchではMarkdown変換、Mermaid effect、PlantUML commandを実行しない。Theme変更だけではiframeをremountしない。
- `MarkdownPreview`は`renderMarkdown`結果だけでなく`dangerouslySetInnerHTML`へ渡すobjectもHTML単位でmemoizeする。Mermaidは初期source nodeをReact外でSVGへ置換するため、window size保存やExplorer操作による無関係なApp再描画で元HTMLを再注入しない。Markdown / PlantUML結果 / path変更時は新しいHTMLを注入し、Theme / revision変更時は既存keyとMermaid effectにより再描画する。

## ファイル走査 (`scan_directory`)

```plantuml
@startuml
skinparam shadowing false
start
:normalize_path(root);
if (root.is_dir?) then (no)
  :return Err("Selected path is not a directory.");
  stop
endif
:build_tree(root, root);
note right
  ディレクトリは再帰
  ファイルは markdown / html / image 拡張子のみ採用
  SKIPPED_DIRS:
  .git node_modules bin obj target
  .venv __pycache__
end note
:children.sort_by(compare_nodes);
note right
  Directory(0) → Markdown(1) → Html(2) → Image(3)
  同種は name の lowercase 昇順
end note
:return FileTreeNode;
stop
@enduml
```

- `open_document` はcurrent root配下のregular Markdown / HTMLだけをUTF-8で検証し、排他的な`sourceText` / `previewUrl` responseを返す。

## Recent Folders

Recent Folders は React の MenuBar dropdown から操作し、永続化と path 検証は Rust command に集約する。OS native menu は使わず、window top の `File` / `View` menu name をクリックして dropdown item を展開する React UI とする。

### データと永続化

`RecentFolderEntry` は次のフィールドを持つ。

| field | 役割 |
| --- | --- |
| `path` | `record_recent_folder` で canonicalize した絶対 directory path |
| `name` | Rust 側で保存時に確定した basename snapshot。frontend は通常 `getFileName(entry.path)` で再導出しない |
| `lastOpenedAt` | Unix seconds 文字列 |

Rust は `AppConfigStore` を Tauri state として管理し、Recent Folders、Viewer settings、PlantUML runtime設定のreadとapp config JSON更新を同一 lockで直列化する。document rootは別の`DocumentStore`が管理し、`scan_directory`、document open / protocol read、Java processによるPlantUML rendering本体をconfig lockへ含めない。

設定ファイルは Tauri app config directory 配下の `settings.json` で、Recent Folders部分は次の通り。完全schemaは後述のViewer Settingsを参照する。

```json
{
  "recentFolders": [
    {
      "path": "/absolute/path/to/project",
      "name": "project",
      "lastOpenedAt": "1783440000"
    }
  ]
}
```

`AppConfigStore` はRecent FoldersとViewer settingsのfield-specific updateを同じlock内のread-modify-writeへ集約する。保存は同じdirectoryのtemporary fileへ全量write / syncし、Unixはrename、Windowsはreplace-existing + write-throughでdestinationを置換する。replace成功をlogical commit pointとし、serialize / temporary create / write / sync / replace失敗時は既存`settings.json`を維持する。replace後のdirectory sync失敗はlogical saveを成功のままdurability warningとしてstderrへ記録する。

`record_recent_folder` は directory であることを確認してから同一 `path` の既存 entry を削除し、新しい entry を先頭へ挿入する。最大件数は 10 件で、超過分は末尾から切り捨てる。保存後に folder が OS 側でリネームされた場合、既存 entry の `name` は保存時点の snapshot のまま残る。

### UI と操作

- App 起動時に `load_recent_folders` を呼び、復元できた entry を File dropdown に表示する。
- `File` dropdown には `Open Folder...`、`Recent Folders` list、`Reload`、separator、application-wideな`Settings...`を表示する。Settings dialogを閉じた後はFile menu triggerへfocusを戻す。
- Recent entry は `entry.name` を主表示、`entry.path` を補助表示にする。`entry.name` が空の場合のみ path 全体を fallback 表示する。
- Recent entry click は `scan_directory` → `record_recent_folder` → initial Markdown 読み込みの順で既存 `loadRoot` に統合する。
- `x` delete button は `remove_recent_folder` を呼び、entry を明示削除する。
- 保存済み path が存在しない場合、recent entry click は `scan_directory` / `record_recent_folder` の失敗を error strip に表示し、entry を自動削除しない。

## Viewer Settings

app config JSON の`viewerSettings`へTheme、logical window size、PlantUML jar pathを保存する。既存の`recentFolders`だけのJSONはserde defaultで読み、次回保存時に新schemaへ更新する。

```json
{
  "recentFolders": [],
  "viewerSettings": {
    "theme": "dark",
    "windowSize": { "width": 1200, "height": 800 },
    "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
  }
}
```

- `Builder::setup`がmain windowへ保存済みlogical sizeを適用する。範囲外sizeだけは800 x 600へ正規化してwarningを返し、frontendが正常値を再保存する。
- frontendは`load_viewer_settings`と`load_recent_folders`を`Promise.allSettled`で読み、Dark themeのstartup flashを避けるため完了までloading shellを表示する。
- `View > Theme`と`File > Settings...`は同じ`save_viewer_preferences`を使う。Settings dialogはdraftを持ち、Save成功前にapp Theme / runtimeを変更しない。
- Settings dialog表示中はbackground app shellを`inert`かつ`aria-hidden`にする。保存中に全controlがdisabledでもdialog containerへfocusを保持し、Tabでbackgroundへ移動させない。jar file pickerのplugin / OS errorはdialog内alertへ表示し、Cancelはerrorにしない。
- window resizeはphysical sizeをscale factorでlogical sizeへ変換し、500ms debounce後に`save_window_size`へ送る。maximized / minimized / fullscreen中は保存しない。resize commandは直列queueにし、最新pending sizeを追送する。
- foreground config操作はoperation countでbusyを管理する。background resizeはMenuBarをdisableせず、backend lockとfield-specific updateでRecent Folders / preferencesとの競合を防ぐ。
- 明示`plantUmlJarPath`がある場合は最優先し、削除済み・無効pathをruntime directory探索へfallbackしない。`Clear`した場合だけ`plantuml.config.json`、同梱`plantuml.jar`の探索へ戻る。

## エラーハンドリング

| 失敗箇所 | 表示 |
| --- | --- |
| Tauri command 失敗 | `errorMessage` を StatusBar 直上の error strip に表示 |
| Markdown / HTML open失敗 | 同上。global tabをerrorにし、選択中のpaneで表示する |
| HTML ready timeout | 5秒で発生pane runtimeだけをerrorにし、iframe eventを成功判定に使わない |
| HTML resource / CSP failure | iframe内resource failureとして分離し、shellは維持する |
| Recent Folders 読み書き失敗 | error strip に表示。missing path は自動削除しない |
| Settings validation / 保存失敗 | Settings dialog内の`role="alert"`へ表示し、draftを維持 |
| startup / background window size保存失敗 | error stripに表示。malformed configは自動上書きしない |
| Mermaid 描画失敗 | 発生pane runtimeへ帰属させ、active paneならerror stripに表示 |
| PlantUML 図単位失敗 | 該当位置に `.plantuml-error`、`firstError` を `errorMessage` にも反映 |
| PlantUML pending | 該当位置に `.plantuml-loading`、`MenuBar / Explorer` を一時無効化して重複操作を抑止 |
| PlantUML タイムアウト (10 秒) | 図単位失敗として表示 |
| `render_plantuml_diagrams` 全体失敗 | 全図を `.plantuml-error` に置換し error strip を更新 |

## UI レイアウト

`App.tsx` は次の DOM 構造を返す。

```text
<main.app-shell>
  <MenuBar/>           ← File操作、View: Theme / Split View
  <RootPathBar/>       ← root path。未選択時は No folder selected
  <section.workspace>
    <aside#explorer-pane.explorer-pane>
      <div.pane-title/>
      <div.explorer-scroll>
        <FileTree/>      ← 再帰 TreeNode、disclosureとtyped inline SVG icon
      </div>
    </aside>
    <div.explorer-separator role="separator"/> ← pointer / keyboard resize、ARIA値
    <section#preview-workspace.preview-workspace>
      <div.preview-grid.single|split>
        <section#document-pane-primary.document-pane role="region">
          <TabStrip/> + <div#document-preview-primary.preview-pane/>
        </section>
        <div.split-separator role="separator"/>  ← split時・計測後だけ表示
        <section#document-pane-secondary.document-pane role="region">...</section>
      </div>
    </section>
  </section>
  <ErrorBanner/>       ← 代表 error。エラー発生時のみ表示
  <StatusBar/>         ← File / State
</main>
<SettingsDialog/>      ← modal。Theme / window size / PlantUML jar path
```

`MenuBar` は React アプリ内の window-top menu として扱う。`File` / `View` は native button の menu trigger であり、`aria-haspopup="menu"` / `aria-expanded` を持ち、click で `role="menu"` の dropdown を開く。`File` dropdown は `Open Folder...`、Recent Folders list、`Reload`、separator、`Settings...`を持ち、`View` dropdown は theme切替と`role="menuitemcheckbox"`のSplit View切替を持つ。Settingsはapplication-wideな操作であり、dialog close後はFile triggerへfocusを戻す。dropdown 内の実行 item は `role="menuitem"`、layout wrapper は `role="none"` とする。`role="menubar"` は矢印キー移動・roving tabindex と併せて導入すべき ARIA pattern であるため、今回の最小範囲では使わない。outside click と Escape で dropdown を閉じる。矢印キー移動とフォーカストラップは導入しない。

`RootPathBar` は MenuBar 直下に root path を常時表示し、長い path は ellipsis と `title` で全文確認できる。Explorer幅は`explorerPane.ts`のpure policyで180pxからworkspace実寸に応じたdynamic最大幅へclampし、`ResizeObserver`によるwindow追従とpointer captureによるdragを`App`が調停する。Split Viewは`splitView.ts`でpreferred minimum 240px、separator 6px、16px keyboard stepを扱い、狭幅時の実効clampをrequested ratioへ書き戻さない。各`DocumentPane`はAppで解決済みのpane-local ordered tab viewを受ける`TabStrip`とtabpanelを持ち、active paneはaccent枠で示す。split時のtab itemはactivate / move / closeの3列とminimum 160pxを使い、single時はactivate / closeの2列を使う。TabStrip rowはstate labelやhorizontal scrollbarの有無に左右されない58px固定高とし、split左右のpreview上端を揃える。Explorer、Reload、StatusBar、代表errorはactive paneを対象とする。`ErrorBanner`は`role="alert"`、StatusBarの`State`だけを`aria-live="polite"`とする。

`html` / `body` / `#root` / `.app-shell` / `.workspace` は全体 overflow を隠し、アプリ外枠にはスクロールバーを出さない。Explorer titleは固定し、treeの縦横scrollは`.explorer-scroll`、documentのscrollは`.preview-pane`へ限定する。`.file-tree`と`.tree-row`は`width: max-content; min-width: 100%`を併用し、短いtreeのrow背景をpane端まで維持しながら、深い階層・長い名前で必要な場合だけ水平scrollを発生させる。tree rowはdisclosure / type icon / labelの3列を共通利用し、labelはellipsisしない。MenuBar / RootPathBar / ErrorBanner / StatusBar は常時表示領域として固定する。`ErrorBanner` は条件付き描画のため、chrome 要素は CSS grid の自動配置に依存せず、`grid-row` で MenuBar / RootPathBar / workspace / ErrorBanner / StatusBar の行を明示する。

Markdown本文の`.markdown-body`は、固定px最大幅を持たず、containing blockである各`.preview-pane`のcontent boxを基準に`calc(100% - 48px)`で幅を決め、`margin: 0 auto`で左右24pxのgutterを確保する。window viewportが760px以下の場合だけ既存media queryにより`calc(100% - 28px)`へ切り替え、左右gutterを14pxとする。本文widthの基準はpaneだがgutterのbreakpointはwindow viewportであるため、viewportが760px超のままsplitで個別paneだけが狭くなっても24pxを維持する。table、code block、Mermaid、PlantUMLは必要時の要素内横scroll、imageとPlantUML SVGは`max-width: 100%`による縮小を維持する。MermaidはApp所有queueで直列描画し、paneを含むrender IDを指定する。trusted HTML iframeはpane全幅を使い、iframe内文書自身の`width` / `max-width`はViewerから上書きしない。

テーマは `document.documentElement.dataset.theme` に `"light" \| "dark"` を書き込み、`App.css` の `:root[data-theme=...]` で CSS 変数を切り替える。
