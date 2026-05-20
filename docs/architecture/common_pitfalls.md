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
