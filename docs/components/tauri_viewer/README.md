# Tauri Viewer

## 目的

Tauri v2 + React + TypeScript + Rust による Markdown / trusted HTML document Viewer 実装。

## 責務

- Tauri dialog plugin でフォルダを選択する。
- Rust `DocumentStore` で current root、ファイルツリー構築、Markdown / HTML open、root-scoped protocolを管理する。
- React で MenuBar dropdown、Settings dialog、Recent Folders、root path strip、Explorer、pane-local TabStrip、Markdown / HTML preview、error strip、StatusBar を表示する。
- 同一 root 内の Markdown / HTML をglobal document dataとして保持し、`SplitViewState`のpane-local ordered tab groupをAppで解決してsingle viewまたは左右2 pane Split Viewへ描画する。local closeは最後のgroup参照だけを破棄し、tab moveはsource fallbackとdestination選択をatomicに更新する。
- Markdown本文はpreview pane幅からresponsiveな左右gutterを引いた幅へ追従し、trusted HTML iframeはpreview pane全幅へ追従する。
- `markdown-it`、`mermaid`、Rust 側 PlantUML command で Markdown / Mermaid / PlantUML を描画する。
- Markdown内の通常画像、描画済みMermaid、描画済みPlantUMLをmodal image viewerへ開き、fit、最大800%のzoom、pan、100% resetを提供する。

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
| HTML protocol | Rust `mvhtml` + `percent-encoding` | current root内allowlist resource配信 |
| Test | Vitest / Rust unit test | frontend policy / path・protocol・response検証 |

## ディレクトリ構成

```text
markdown-viewer-tauri/
├── package.json / vite.config.ts / tsconfig*.json
├── index.html
├── public/                       — favicon / アイコンなど静的 asset
├── src/                          — React + TypeScript フロントエンド
│   ├── main.tsx                  — React エントリーポイント
│   ├── App.tsx                   — UI + typed document tab / settings状態管理
│   ├── documentPolicy.ts         — HTML URL / bridge message policy
│   ├── documentPolicy.test.ts    — frontend policy unit test
│   ├── explorerPane.ts           — Explorer幅の境界 / keyboard policy
│   ├── explorerPane.test.ts      — Explorer幅policy unit test
│   ├── splitView.ts              — pane-local tab group / move / Split View状態遷移 / 幅policy
│   ├── splitView.test.ts         — open / local close / move / split / root / resize policy unit test
│   ├── paneRuntime.ts            — pane async guard / TabStrip表示state合成
│   ├── paneRuntime.test.ts       — stale result / pane-local runtime unit test
│   ├── tabStrip.ts               — item reveal / drag threshold / drop pane / scrollbar visibility policy
│   ├── tabStrip.test.ts          — TabStrip geometry / pointer policy unit test
│   ├── imageViewer.ts            — image viewer transform policy / DOM decoration / source resolver
│   ├── imageViewer.test.ts       — zoom / pan / wheel / intrinsic size policy unit test
│   ├── App.css                   — Light / Dark テーマ + MenuBar / resizable Explorer / TabStrip / StatusBar レイアウト
│   └── vite-env.d.ts             — Vite 型定義
└── src-tauri/                    — Rust バックエンド (Tauri 本体)
    ├── Cargo.toml                — クレート / プラグイン
    ├── tauri.conf.json           — Tauri 設定 / asset protocol
    ├── build.rs                  — tauri-build フック
    ├── capabilities/default.json — plugin permission
    └── src/
        ├── main.rs               — exe エントリ → lib::run
        └── lib.rs                — DocumentStore / mvhtml protocol / commands /
                                     PlantUML / app settings / unit tests
```

## 主要要素

| 要素 | 役割 | ソース |
| --- | --- | --- |
| `main.tsx` | React DOM ルートに `App` をマウント | [markdown-viewer-tauri/src/main.tsx](../../../markdown-viewer-tauri/src/main.tsx) |
| `App` / `DocumentPane` / `MenuBar` / `SettingsDialog` / `RootPathBar` / `FileTree` / `TabStrip` / `MarkdownPreview` / `HtmlPreview` / `ErrorBanner` / `StatusBar` | UI + 状態管理。`tabs`をglobal document data、`SplitViewState`をpane-local groupの正本とし、App境界でordered viewを解決してpaneごとのMarkdown DOM / sandboxed HTML iframeを表示する | [markdown-viewer-tauri/src/App.tsx](../../../markdown-viewer-tauri/src/App.tsx) |
| `splitView.ts` | pane-local ordered ID、open / select / local close / atomic move、split保持、root reset、参照集合、generic group resolver、requested ratioとdynamic幅をpure functionで管理する | [markdown-viewer-tauri/src/splitView.ts](../../../markdown-viewer-tauri/src/splitView.ts) |
| `paneRuntime.ts` | pane / tab / revisionのasync guardと、shared tab state + pane runtimeによるTabStrip表示stateをpure functionで合成する | [markdown-viewer-tauri/src/paneRuntime.ts](../../../markdown-viewer-tauri/src/paneRuntime.ts) |
| `tabStrip.ts` | TabStrip内だけを動かすitem全体reveal delta、6px drag threshold、pane IDをnarrowingするdrop policy、pointer座標とshell矩形の境界判定、pointer / keyboard表示stateのOR policyをpure functionで管理する | [markdown-viewer-tauri/src/tabStrip.ts](../../../markdown-viewer-tauri/src/tabStrip.ts) |
| `documentPolicy.ts` | Markdown / HTML response shape、preview revision URL、opaque-origin bridge messageをpure functionで検証する | [markdown-viewer-tauri/src/documentPolicy.ts](../../../markdown-viewer-tauri/src/documentPolicy.ts) |
| `explorerPane.ts` | Explorerの初期/最小/dynamic最大幅、clamp、ArrowLeft / ArrowRight / Home / End操作をDOM非依存のpure functionで管理する | [markdown-viewer-tauri/src/explorerPane.ts](../../../markdown-viewer-tauri/src/explorerPane.ts) |
| `imageViewer.ts` | image viewerのfit / zoom / pan / wheel / intrinsic size / activation policyと、Markdown DOM内の3種visualだけを扱うdecoration / resolverを提供する | [markdown-viewer-tauri/src/imageViewer.ts](../../../markdown-viewer-tauri/src/imageViewer.ts) |
| `App.css` | Light / Dark テーマ、MenuBar、Settings dialog、幅変更可能なExplorer / Split View、active pane、pane-local TabStrip、error strip、StatusBar、pane相対のMarkdown本文幅と図表スタイル | [markdown-viewer-tauri/src/App.css](../../../markdown-viewer-tauri/src/App.css) |
| `scan_directory` | Rust command。root 配下を再帰走査して `FileTreeNode` を返す。除外ディレクトリあり | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `open_document` | Rust command。`DocumentStore` current root内のMarkdownはUTF-8本文、HTMLはroot-relative `previewUrl`を排他的responseで返す | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `mvhtml` protocol | segment decode、canonical root、MIME allowlist、CSP/CORSを検証し、HTMLへready / external-link bridgeを注入する | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `render_plantuml_diagrams` | Rust command。`spawn_blocking` で各 source を `java -jar plantuml.jar -tsvg -pipe` に渡し、SVG / エラー HTML を返す | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` | Rust command。app config JSON の `recentFolders` を読み込み、成功した root folder を最大 10 件で保存し、明示削除を反映する | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `load_viewer_settings` / `save_viewer_preferences` / `save_window_size` | Rust command。Theme、logical window size、PlantUML jar pathを型付き app config JSON で読み書きする | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| `AppConfigStore` | Store lock 内で config 全体を read-modify-writeし、temporary fileのsync後にatomic replaceする。replace後のdirectory sync失敗はlogical success + durability warningとする | [markdown-viewer-tauri/src-tauri/src/lib.rs](../../../markdown-viewer-tauri/src-tauri/src/lib.rs) |
| Tauri config | window、production/dev shell CSP、asset protocol、bundle target | [markdown-viewer-tauri/src-tauri/tauri.conf.json](../../../markdown-viewer-tauri/src-tauri/tauri.conf.json) |
| Capability | `core:default` / `dialog:default` / `opener:default` | [markdown-viewer-tauri/src-tauri/capabilities/default.json](../../../markdown-viewer-tauri/src-tauri/capabilities/default.json) |
| Cargo manifest | `tauri-plugin-dialog` / `tauri-plugin-opener` / `serde` 依存 | [markdown-viewer-tauri/src-tauri/Cargo.toml](../../../markdown-viewer-tauri/src-tauri/Cargo.toml) |
| Package | `markdown-it` / `mermaid` / Tauri JS API / plugin SDK | [markdown-viewer-tauri/package.json](../../../markdown-viewer-tauri/package.json) |

TabStripは40px固定高の1行表示と上端state indicatorを使う。split時は矢印move buttonに加えてmouseのtab name dragで反対paneのTabStripへ移動できる。touch / pen drag、同一pane reorder、preview paneへのdropは提供せず、keyboard / 支援技術では既存move buttonを使う。

## 依存関係

- Tauri v2 / `tauri-plugin-dialog` / `tauri-plugin-opener`
- React 19 / TypeScript 5.8 / Vite 7
- `markdown-it` / `mermaid`
- Rust / `serde` / `serde_json` / `percent-encoding`
- Vitest
- Java / `plantuml.jar`（PlantUML 表示時のみ、外部プロセス）

## 設計文書

- 基本設計: [basic_design.md](basic_design.md)
- 詳細設計: [detail_design.md](detail_design.md)
- インターフェース仕様: [interface_spec.md](interface_spec.md)
- 既知課題: [issues.md](issues.md)
