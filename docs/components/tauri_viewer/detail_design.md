# Tauri Viewer 詳細設計

## 状態管理

`App.tsx` がroot path、file tree、selected file、Markdown本文、theme、error、preview revisionを保持する。

`previewRevision` はMarkdown本文が同一でもReload時にMermaidとPlantUMLを再描画するための更新番号である。

## 処理フロー

1. `@tauri-apps/plugin-dialog` でフォルダを選択する。
2. `scan_directory` commandでExplorer用ツリーを取得する。
3. READMEまたは最初のMarkdownを初期表示する。
4. ExplorerのMarkdown選択時に `read_text_file` commandで本文を取得する。
5. `markdown-it` でHTML化する。
6. PlantUMLコードブロックはReactが抽出し、`render_plantuml_diagrams` commandでRust側に描画を依頼する。
7. `markdown-it` のfence rendererがPlantUML描画結果を `.plantuml-diagram` または `.plantuml-error` として出力する。
8. Mermaidコードブロックは `.mermaid` DOMとして出力し、プレビュー更新後に `mermaid.run` を実行する。PlantUML結果の反映でDOMが再生成された場合もMermaidを再描画する。

## PlantUML

PlantUML表示はRust側の `render_plantuml_diagrams` commandで行う。ReactはMarkdown本文から `plantuml` / `puml` fenced code blockを抽出し、source配列としてcommandへ渡す。Rust commandは各sourceを順次 `java -jar <plantuml.jar> -tsvg -pipe` へ渡し、SVG HTMLまたはエラーHTMLを返す。

PlantUML描画はJava process起動と待機を伴うため、Tauri commandは `spawn_blocking` でblocking workとして実行する。これにより、PlantUML描画中もWebView側の表示更新と読み込み中バナー表示を維持する。

`plantuml.jar` はコミットしない。Tauri devでは `markdown-viewer-tauri/src-tauri/` をruntime directoryとして先に探索し、次にcurrent working directory、Rust実行ファイルのdirectoryを見る。macOS bundleでは `<app>.app/Contents/MacOS/` をruntime directoryとし、Finder起動時のworking directoryには依存しない。

`plantuml.config.json` がある場合は `plantUmlJarPath` を読み、相対pathはconfig fileのdirectory基準で解決する。configがない場合はruntime directoryの `plantuml.jar` を見る。

Theme切替だけでは `render_plantuml_diagrams` を再実行しない。PlantUML CLIを起動するのは、選択ファイル、Markdown本文、Reloadに伴う `previewRevision` が変わった場合だけである。

PlantUML描画結果待ちの図がある間は、React側のpending状態をもとにプレビュー上部へ読み込み中バナーを表示する。Markdown本文とMermaidは先に表示し、PlantUML結果が返った時点で該当コードブロックをSVGまたはエラー表示へ差し替える。

## ローカル画像

相対画像は選択中Markdownのディレクトリから絶対パスへ解決し、`convertFileSrc` でasset URLへ変換する。

## リンク処理

- `http://` / `https://`: `@tauri-apps/plugin-opener` で既定ブラウザを開く。
- `#anchor`: 同一プレビュー内でスクロールする。
- 相対 `.md` / `.markdown`: 選択中Markdownからパス解決し、アプリ内で読み込む。

## エラーハンドリング

Rust commandの失敗、Markdown読み込み失敗、Mermaid描画失敗はReact側のエラーバナーに表示する。PlantUMLの図ごとの失敗は該当位置に `.plantuml-error` として表示し、代表エラー1件をエラーバナーにも表示する。
