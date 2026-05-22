# Tauri Viewer

## 目的

Tauri v2 + React + TypeScript + Rust による Markdown Viewer MVP 実装。

## 責務

- Tauri dialog plugin でフォルダを選択する。
- Rust command でファイルツリー構築と Markdown 読み込みを行う。
- React で Explorer、Toolbar、Markdown preview を表示する。
- `markdown-it`、`mermaid`、Rust 側 PlantUML command で Markdown / Mermaid / PlantUML を描画する。

## 技術スタック

| 区分 | 採用技術 / バージョン | 用途 |
|---|---|---|
| Shell | Tauri v2 (`tauri = "2"`, feature `protocol-asset`) | デスクトップシェル / WebView ホスト |
| Plugins | `tauri-plugin-dialog` / `tauri-plugin-opener` | フォルダ選択 / 外部 URL オープン |
| Backend | Rust (edition 2021) | コマンド実装 / ファイル走査 / PlantUML 起動 |
| Frontend | React 19 + TypeScript 5.8 | UI / 状態管理 |
| Bundler | Vite 7 (`@vitejs/plugin-react`) | dev server / build |
| Markdown | `markdown-it` 14 | Markdown → HTML 変換 |
| Mermaid | `mermaid` 11 | クライアント描画 |
| PlantUML | `java -jar plantuml.jar -tsvg -pipe` | Rust 側で `spawn_blocking` 起動 |
| Serialization | `serde` / `serde_json` (camelCase) | TS ↔ Rust 境界 |
| Asset protocol | `tauri.conf.json` の `assetProtocol.enable=true`, `scope=["**"]` | 相対画像配信 |

## ディレクトリ構成

```
markdown-viewer-tauri/
├── package.json / vite.config.ts / tsconfig*.json
├── index.html
├── public/                       — favicon / アイコンなど静的 asset
├── src/                          — React + TypeScript フロントエンド
│   ├── main.tsx                  — React エントリーポイント
│   ├── App.tsx                   — UI + 状態管理 + Markdown 描画
│   ├── App.css                   — Light / Dark テーマ + 2 ペインレイアウト
│   └── vite-env.d.ts             — Vite 型定義
└── src-tauri/                    — Rust バックエンド (Tauri 本体)
    ├── Cargo.toml                — クレート / プラグイン
    ├── tauri.conf.json           — Tauri 設定 / asset protocol
    ├── build.rs                  — tauri-build フック
    ├── capabilities/default.json — plugin permission
    └── src/
        ├── main.rs               — exe エントリ → lib::run
        └── lib.rs                — commands (scan_directory /
                                     read_text_file / render_plantuml_diagrams)
```

## 主要要素

| 要素 | 役割 | ソース |
|---|---|---|
| `main.tsx` | React DOM ルートに `App` をマウント | [markdown-viewer-tauri/src/main.tsx](markdown-viewer-tauri/src/main.tsx) |
| `App` / `Toolbar` / `FileTree` / `MarkdownPreview` | UI + 状態管理。`useState` で root / fileTree / 選択ファイル / theme / previewRevision / plantUmlRenderState を保持 | [markdown-viewer-tauri/src/App.tsx](markdown-viewer-tauri/src/App.tsx) |
| `App.css` | Light / Dark テーマ、2 ペインレイアウト、`.plantuml-diagram` / `.plantuml-error` / `.mermaid` スタイル | [markdown-viewer-tauri/src/App.css](markdown-viewer-tauri/src/App.css) |
| `scan_directory` | Rust command。root 配下を再帰走査して `FileTreeNode` を返す。除外ディレクトリあり | [markdown-viewer-tauri/src-tauri/src/lib.rs](markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `read_text_file` | Rust command。root 配下チェックと Markdown 拡張子チェックの後 UTF-8 で読み込む | [markdown-viewer-tauri/src-tauri/src/lib.rs](markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `render_plantuml_diagrams` | Rust command。`spawn_blocking` で各 source を `java -jar plantuml.jar -tsvg -pipe` に渡し、SVG / エラー HTML を返す | [markdown-viewer-tauri/src-tauri/src/lib.rs](markdown-viewer-tauri/src-tauri/src/lib.rs) |
| Tauri config | window 設定 / asset protocol / bundle target | [markdown-viewer-tauri/src-tauri/tauri.conf.json](markdown-viewer-tauri/src-tauri/tauri.conf.json) |
| Capability | `core:default` / `dialog:default` / `opener:default` | [markdown-viewer-tauri/src-tauri/capabilities/default.json](markdown-viewer-tauri/src-tauri/capabilities/default.json) |
| Cargo manifest | `tauri-plugin-dialog` / `tauri-plugin-opener` / `serde` 依存 | [markdown-viewer-tauri/src-tauri/Cargo.toml](markdown-viewer-tauri/src-tauri/Cargo.toml) |
| Package | `markdown-it` / `mermaid` / Tauri JS API / plugin SDK | [markdown-viewer-tauri/package.json](markdown-viewer-tauri/package.json) |

## 依存関係

- Tauri v2 / `tauri-plugin-dialog` / `tauri-plugin-opener`
- React 19 / TypeScript 5.8 / Vite 7
- `markdown-it` / `mermaid`
- Rust / `serde` / `serde_json`
- Java / `plantuml.jar`（PlantUML 表示時のみ、外部プロセス）

## 設計文書

- 基本設計: [docs/components/tauri_viewer/basic_design.md](docs/components/tauri_viewer/basic_design.md)
- 詳細設計: [docs/components/tauri_viewer/detail_design.md](docs/components/tauri_viewer/detail_design.md)
- インターフェース仕様: [docs/components/tauri_viewer/interface_spec.md](docs/components/tauri_viewer/interface_spec.md)
- 既知課題: [docs/components/tauri_viewer/issues.md](docs/components/tauri_viewer/issues.md)
