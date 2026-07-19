# Tauri Viewer

## 目的

Tauri v2 + React + TypeScript + Rust による Markdown Viewer MVP 実装。

## 責務

- Tauri dialog plugin でフォルダを選択する。
- Rust command でファイルツリー構築、Markdown 読み込み、Recent Folders / Viewer settings の永続化を行う。
- React で MenuBar dropdown、Settings dialog、Recent Folders、root path strip、Explorer、TabStrip、Markdown preview、error strip、StatusBar を表示する。
- 同一 root 内の Markdown を複数タブで保持し、active tabだけを単一preview paneへ描画する。
- `markdown-it`、`mermaid`、Rust 側 PlantUML command で Markdown / Mermaid / PlantUML を描画する。

## 技術スタック

| 区分 | 採用技術 / バージョン | 用途 |
| --- | --- | --- |
| Shell | Tauri v2 (`tauri = "2"`, feature `protocol-asset`) | デスクトップシェル / WebView ホスト |
| Plugins | `tauri-plugin-dialog` / `tauri-plugin-opener` | フォルダ選択 / 外部 URL オープン |
| Backend | Rust (edition 2021) | コマンド実装 / ファイル走査 / PlantUML 起動 |
| Frontend | React 19 + TypeScript 5.8 | UI / 状態管理 |
| Bundler | Vite 7 (`@vitejs/plugin-react`) | dev server / build |
| Markdown | `markdown-it` 14 | Markdown → HTML 変換 |
| Mermaid | `mermaid` 11 | クライアント描画 |
| PlantUML | `java -jar plantuml.jar -tsvg -pipe` | Rust 側で `spawn_blocking` 起動 |
| Serialization | `serde` / `serde_json` (camelCase) | TS ↔ Rust 境界 / app config JSON |
| Asset protocol | `tauri.conf.json` の `assetProtocol.enable=true`, `scope=["**"]` | 相対画像配信 |

## ディレクトリ構成

```text
markdown-viewer-tauri/
├── package.json / vite.config.ts / tsconfig*.json
├── index.html
├── public/                       — favicon / アイコンなど静的 asset
├── src/                          — React + TypeScript フロントエンド
│   ├── main.tsx                  — React エントリーポイント
│   ├── App.tsx                   — UI + tab / settings状態管理 + Markdown 描画
│   ├── App.css                   — Light / Dark テーマ + MenuBar / TabStrip / 2 ペイン / StatusBar レイアウト
│   └── vite-env.d.ts             — Vite 型定義
└── src-tauri/                    — Rust バックエンド (Tauri 本体)
    ├── Cargo.toml                — クレート / プラグイン
    ├── tauri.conf.json           — Tauri 設定 / asset protocol
    ├── build.rs                  — tauri-build フック
    ├── capabilities/default.json — plugin permission
    └── src/
        ├── main.rs               — exe エントリ → lib::run
        └── lib.rs                — commands (scan_directory / read_text_file /
                                     render_plantuml_diagrams / app settings)
```

## 主要要素

| 要素 | 役割 | ソース |
| --- | --- | --- |
| `main.tsx` | React DOM ルートに `App` をマウント | [markdown-viewer-tauri/src/main.tsx](../../../markdown-viewer-tauri/src/main.tsx) |
| `App` / `MenuBar` / `SettingsDialog` / `RootPathBar` / `FileTree` / `TabStrip` / `MarkdownPreview` / `ErrorBanner` / `StatusBar` | UI + 状態管理。`tabs` / `activeTabId` を文書状態の正本とし、Theme / window size / PlantUML path を typed settings として扱う。foreground config 操作と background resize 保存を分離する | [markdown-viewer-tauri/src/App.tsx](../../../markdown-viewer-tauri/src/App.tsx) |
| `App.css` | Light / Dark テーマ、MenuBar、Settings dialog、TabStripのactive/loading/error/横overflow、2ペイン、error strip、StatusBar、Markdown図表スタイル | [markdown-viewer-tauri/src/App.css](../../../markdown-viewer-tauri/src/App.css) |
| `scan_directory` | Rust command。root 配下を再帰走査して `FileTreeNode` を返す。除外ディレクトリあり | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `read_text_file` | Rust command。root 配下チェックと Markdown 拡張子チェックの後 UTF-8 で読み込む | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `render_plantuml_diagrams` | Rust command。`spawn_blocking` で各 source を `java -jar plantuml.jar -tsvg -pipe` に渡し、SVG / エラー HTML を返す | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` | Rust command。app config JSON の `recentFolders` を読み込み、成功した root folder を最大 10 件で保存し、明示削除を反映する | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `load_viewer_settings` / `save_viewer_preferences` / `save_window_size` | Rust command。Theme、logical window size、PlantUML jar pathを型付き app config JSON で読み書きする | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `AppConfigStore` | Store lock 内で config 全体を read-modify-writeし、temporary fileのsync後にatomic replaceする | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| Tauri config | window 設定 / asset protocol / bundle target | [markdown-viewer-tauri/src-tauri/tauri.conf.json](../../../markdown-viewer-tauri/src-tauri/tauri.conf.json) |
| Capability | `core:default` / `dialog:default` / `opener:default` | [markdown-viewer-tauri/src-tauri/capabilities/default.json](../../../markdown-viewer-tauri/src-tauri/capabilities/default.json) |
| Cargo manifest | `tauri-plugin-dialog` / `tauri-plugin-opener` / `serde` 依存 | [markdown-viewer-tauri/src-tauri/Cargo.toml](../../../markdown-viewer-tauri/src-tauri/Cargo.toml) |
| Package | `markdown-it` / `mermaid` / Tauri JS API / plugin SDK | [markdown-viewer-tauri/package.json](../../../markdown-viewer-tauri/package.json) |

## 依存関係

- Tauri v2 / `tauri-plugin-dialog` / `tauri-plugin-opener`
- React 19 / TypeScript 5.8 / Vite 7
- `markdown-it` / `mermaid`
- Rust / `serde` / `serde_json`
- Java / `plantuml.jar`（PlantUML 表示時のみ、外部プロセス）

## 設計文書

- 基本設計: [basic_design.md](basic_design.md)
- 詳細設計: [detail_design.md](detail_design.md)
- インターフェース仕様: [interface_spec.md](interface_spec.md)
- 既知課題: [issues.md](issues.md)
