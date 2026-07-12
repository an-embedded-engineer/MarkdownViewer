# MarkdownViewer Tauri 版

Tauri v2、React、TypeScript、Rust で実装した読み取り専用 Markdown Viewer です。プロジェクト全体は [ルート README](../README.md) を参照してください。

## 対応 OS と環境構築

Windows、macOS、Linux で開発・実行できます。Node.js/npm と Rust/Cargo に加え、Tauri の OS 固有依存が必要です。

- [Windows](../docs/setup/windows.md)
- [macOS](../docs/setup/macos.md)
- [Linux](../docs/setup/linux.md)
- [環境構築ガイド索引](../docs/setup/README.md)

## 実行

`markdown-viewer-tauri/` で実行します。

```text
npm ci
npm run tauri dev
```

確認コマンド:

```text
npm run build
cd src-tauri
cargo check
```

## Publish / bundle

- [Windows bundle](../docs/setup/windows.md#5-publish--bundle)
- [macOS bundle](../docs/setup/macos.md#5-publish--bundle)
- [Linux bundle](../docs/setup/linux.md#5-tauri-bundle)
- [共通の開発・publish ルール](../docs/rules/development_workflow.md#publish)

## 主な機能

- native folder picker からフォルダを開く
- directory、Markdown、画像を Explorer tree に表示
- GitHub Flavored Markdown の基本表示
- Mermaid / PlantUML fenced code block の描画
- Light / Dark theme 切替
- Tauri asset protocol による相対画像表示
- 相対 Markdown link のアプリ内遷移と外部 URL の既定ブラウザ起動
- 複数タブ、active tab の Reload、recent folders

## 注意事項

- folder scan では `.git`、`node_modules`、`bin`、`obj`、`target`、`.venv`、`__pycache__` を除外します。
- local image 表示のため、現在の MVP は選択フォルダに対して広い asset scope を許可しています。
- split view、tab persistence/reorder、file watching は現在の対象外です。
