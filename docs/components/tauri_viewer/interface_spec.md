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

## Frontend Types

`FileTreeNode`:

- `name: string`
- `path: string`
- `relativePath: string`
- `nodeType: "directory" | "markdown" | "image"`
- `children: FileTreeNode[]`
