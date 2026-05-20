# Tauri Viewer インターフェース仕様

## ユーザー操作

- Open Folder: フォルダ選択ダイアログを開く。
- Explorer item click: Markdownファイルを読み込む。
- Reload: rootと選択中Markdownを再読み込みする。
- Theme switch: Light / Dark を切り替える。

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
