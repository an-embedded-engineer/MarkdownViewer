# Tauri Viewer 詳細設計

## 状態管理

`App.tsx` がroot path、file tree、selected file、Markdown本文、theme、error、preview revisionを保持する。

`previewRevision` はMarkdown本文が同一でもReload時にMermaidを再描画するための更新番号である。

## 処理フロー

1. `@tauri-apps/plugin-dialog` でフォルダを選択する。
2. `scan_directory` commandでExplorer用ツリーを取得する。
3. READMEまたは最初のMarkdownを初期表示する。
4. ExplorerのMarkdown選択時に `read_text_file` commandで本文を取得する。
5. `markdown-it` でHTML化する。
6. Mermaidコードブロックは `.mermaid` DOMとして出力し、プレビュー更新後に `mermaid.run` を実行する。

## ローカル画像

相対画像は選択中Markdownのディレクトリから絶対パスへ解決し、`convertFileSrc` でasset URLへ変換する。

## リンク処理

- `http://` / `https://`: `@tauri-apps/plugin-opener` で既定ブラウザを開く。
- `#anchor`: 同一プレビュー内でスクロールする。
- 相対 `.md` / `.markdown`: 選択中Markdownからパス解決し、アプリ内で読み込む。

## エラーハンドリング

Rust commandの失敗、Markdown読み込み失敗、Mermaid描画失敗はReact側のエラーバナーに表示する。
