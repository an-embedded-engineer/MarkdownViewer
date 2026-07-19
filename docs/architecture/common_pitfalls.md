# よくある落とし穴

## 1. Mermaid再描画

- ReactでMarkdown本文が同じままReloadすると、state変更が発火せずMermaidが再実行されないことがある。
- Tauri版ではプレビュー更新番号を持ち、Reload時もDOMを再生成してMermaidを再実行する。

## 2. ローカル画像表示

- TauriのWebViewでローカル画像を表示するには asset protocol と capability / Cargo feature の整合が必要。
- `tauri.conf.json`、`Cargo.toml`、`src-tauri/capabilities/default.json` をセットで確認する。

## 3. ファイルパス検証

- 相対リンクや画像パスを文字列連結だけで扱うと、OS差や `..` による意図しない参照を見落とす。
- Rust側では `PathBuf` と `canonicalize`、TypeScript側では専用の正規化関数へ閉じ込める。

## 4. Avalonia UIスレッド

- フォルダ走査やMarkdown変換をUIスレッドで重く実行すると画面が固まる。
- 重い処理はServiceへ分離し、必要に応じて非同期化する。

## 5. Publish生成物

- `publish/`、Tauriの `dist/`、Rustの `target/`、.NETの `bin/` / `obj/` は生成物である。
- 起動確認用にローカル作成しても、原則コミットしない。

## 6. PlantUML runtime配置

- `plantuml.jar` と `plantuml.config.json` はローカルruntimeファイルであり、コミットしない。
- Tauri devでは `markdown-viewer-tauri/src-tauri/`、Tauri bundleでは `.app/Contents/MacOS/`、Avalonia publishでは実行ファイルのdirectoryをruntime directoryとして扱う。
- Finder起動時のworking directoryは `/` になり得るため、Tauri bundleのjar探索をworking directory前提にしない。
- Theme切替だけでPlantUML CLIを再実行すると多数図の文書で体感遅延が出るため、SVG再生成はMarkdown本文またはReload更新時に限定する。

## 7. Windows固有の注意点

- Rustの`Path::canonicalize`はWindowsで`\\?\`付きのverbatim pathを返す。filesystem検証にはそのまま使い、Java processの引数やfrontendへ返す文字列では通常のdrive / UNC pathへ変換する。
- WebView2の`NavigateToString`にはHTML size上限がある。Mermaid runtimeを埋め込んだHTMLは上限を超えるため、Avalonia版は一時HTML fileへ書き出してfile URIへnavigateする。
- .NET正規表現のmultiline `$`はCRLFの`\r`より前には一致しない。fenced code blockの終了行を判定する場合は末尾の`\r?`を明示し、LF / CRLFの両方を扱う。

## 8. HTML custom protocol URL

- `convertFileSrc(path, "mvhtml")` は absolute path 全体を単一 segment に encodeするため、HTML 内の相対 resource base として使わない。
- Rust が current root からの相対 path を segment ごとに encodeし、macOS / Linux は `mvhtml://localhost/document/...`、Windows は `http://mvhtml.localhost/document/...` を生成する。
- protocol handler は URI 文字列の prefix 判定だけで許可せず、decode後segment検査、canonicalize、root boundary、regular file、extension allowlistをすべて確認する。

## 9. sandboxed iframe の load 判定

- cross-origin / opaque-origin iframe は HTTP error responseでも `load` eventを発火し得るため、`load` / `error` eventをprotocol成功判定に使わない。
- 成功HTMLにだけ注入される`ready` handshakeを正本とし、source / origin / revisionを検証する。timeoutとlistenerはrevision変更・unmount時に必ず解除する。
- HTMLを表示するためにcapability remote origin、`allow-same-origin`、external network sourceを追加して境界を緩和しない。
