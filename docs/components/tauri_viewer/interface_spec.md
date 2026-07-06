# Tauri Viewer インターフェース仕様

## ユーザー操作

- Open Folder: MenuBar の File group からフォルダ選択ダイアログを開く。
- Explorer item click: Markdownファイルを読み込む。
- Reload: MenuBar の File group から rootと選択中Markdownを再読み込みする。
- Theme switch: MenuBar の View group から Light / Dark を切り替える。

## StatusBar 表示

- `Root`: 選択中 root path。未選択時は `No folder selected`。
- `File`: 表示中 Markdown file name。未選択時は `No file selected`。
- `State`: `Ready`、`Loading Markdown...`、`Rendering PlantUML diagrams...`、`Loading Markdown and rendering PlantUML diagrams...` のいずれか。
- `Error`: 代表エラー。エラーがない場合は `None`。

`State` と `Error` の値だけを `aria-live="polite"` とし、`Root` / `File` は live region に含めない。狭幅時は `Error`、`State`、`File`、`Root` の順で表示を優先し、`Root` を最初に短縮する。

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

## Frontend Types

`FileTreeNode`:

- `name: string`
- `path: string`
- `relativePath: string`
- `nodeType: "directory" | "markdown" | "image"`
- `children: FileTreeNode[]`

PlantUML frontend typesはTauri commandの `PlantUmlRenderResponse` / `PlantUmlDiagramResult` とcamelCaseで対応する。
