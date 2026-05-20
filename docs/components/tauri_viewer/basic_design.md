# Tauri Viewer 基本設計

## 基本方針

OS連携とファイルシステム境界はRust commandへ寄せ、画面状態とMarkdown表示はReact側で扱う。

## 責務

- React: Toolbar、Explorer、Preview、テーマ、エラー表示。
- TypeScript renderer: Markdown HTML化、相対画像変換、相対Markdownリンク処理。
- Rust: root配下の安全なファイル走査とMarkdown本文読み込み。
- Tauri config: dialog、opener、asset protocolの権限管理。

## データモデル

`FileTreeNode` はRustとTypeScriptで対応する。

- `name`
- `path`
- `relativePath`
- `nodeType`
- `children`

## 依存方向

```text
React UI -> Tauri invoke -> Rust commands -> filesystem
React UI -> markdown-it / mermaid -> WebView DOM
```
