# Tauri Viewer インターフェース仕様

## ユーザー操作

- Open Folder: MenuBar の File dropdown からフォルダ選択ダイアログを開く。
- Recent Folders: MenuBar の File dropdown から最近開いた root folder を開く。
- Remove Recent Folder: Recent Folders entry の delete button から該当 entry を削除する。
- Explorer item click: 未openのMarkdownは新規tabを開き、同一pathがopen済みならactivateする。
- Tab activate: TabStripから表示するMarkdownを切り替える。ArrowLeft / ArrowRight / Home / Endでもfocusとselectionを移動できる。
- Tab close: 非active tabではselectionを維持する。active tabでは右隣、なければ左隣へ移り、最後のtab close後は未選択表示になる。
- Reload: MenuBar の File dropdown から root treeとactive tabだけを再読み込みする。
- Theme switch: MenuBar の View dropdown から Light / Dark を切り替える。

## MenuBar 表示

MenuBar は window top に `File` / `View` を表示する React UI で、menu name click により dropdown item を展開する。

- `File`: `Open Folder...`、`Recent Folders`、`Reload`
- `Recent Folders`: 最大 10 件。主表示は保存時点の folder name、補助表示は absolute path。
- `View`: `Theme: Light` または `Theme: Dark`

Recent Folders entry click で保存済み path が存在しない場合は error strip に表示し、entry は自動削除しない。削除は delete button による明示操作だけで行う。

## Root Path Strip 表示

- `Root`: 選択中 root path。未選択時は `No folder selected`。

MenuBar 直下に常時表示する。長い path は ellipsis と `title` で全文確認できる。

## TabStrip 表示

- 同一root内でopenしたMarkdownをopen順に表示する。同一pathのtabは重複作成しない。
- active / Loading / Rendering / Errorを表示し、長いfile nameはellipsis、absolute pathは`title`で確認できる。
- 多数tabは横scrollで到達可能にする。`role="tablist"` / `role="tab"` とroving tabindexを使う。
- tab永続化、reorder、pin、split viewは対象外。

## Error Strip 表示

- `Error`: 代表エラー。エラー発生時のみ表示する。

StatusBar 直上に薄い赤背景で表示し、`role="alert"` で支援技術へ通知する。エラーがない場合は表示しない。

## StatusBar 表示

- `File`: 表示中 Markdown file name。未選択時は `No file selected`。
- `State`: `Loading folder...`、`Updating recent folders...`、`Loading Markdown...`、`Rendering PlantUML diagrams...`、`Ready` のいずれか。左から順に優先する。

`State` の値だけを `aria-live="polite"` とし、`File` は live region に含めない。

## Tauri Commands

### `scan_directory(root_path: String) -> Result<FileTreeNode, String>`

root配下を走査し、Explorer表示用のツリーを返す。

除外ディレクトリ:

- `.git`
- `node_modules`
- `bin`
- `obj`
- `target`
- `.venv`
- `__pycache__`

### `read_text_file(root_path: String, path: String) -> Result<String, String>`

root配下のMarkdownファイルをUTF-8テキストとして読み込む。

### `render_plantuml_diagrams(sources: Vec<String>) -> Result<PlantUmlRenderResponse, String>`

PlantUML source配列を受け取り、各図をSVG HTMLまたはエラーHTMLへ変換して返す。Java processを起動できないなどcommand全体の失敗は `Err(String)` とする。jar未設定、PlantUML構文エラー、timeoutなど図ごとの失敗は `PlantUmlDiagramResult` の `ok: false` として返す。

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

## Frontend Types

`FileTreeNode`:

- `name: string`
- `path: string`
- `relativePath: string`
- `nodeType: "directory" | "markdown" | "image"`
- `children: FileTreeNode[]`

PlantUML frontend typesはTauri commandの `PlantUmlRenderResponse` / `PlantUmlDiagramResult` とcamelCaseで対応する。

`RecentFolderEntry`:

- `path: string`
- `name: string`
- `lastOpenedAt: string`

`name` は Rust 側で保存時に確定した値を表示上の正本とする。frontend は `name` が空の場合だけ `path` 全体を fallback 表示する。

`OpenDocumentTab`:

- `id: string`
- `path: string`
- `displayName: string`
- `markdown: string`
- `revision: number`
- `loadState: "loading" | "rendering" | "ready" | "error"`
- `errorMessage: string | null`
- `plantUmlDiagrams: PlantUmlDiagramResult[]`

Markdown / PlantUML responseは`tabId + revision`が現在値と一致する場合だけ適用する。close済み、Reload前、旧rootのresponseは無視する。
