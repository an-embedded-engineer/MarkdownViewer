# Linux 環境構築

現構成で Linux 上の開発・実行・bundle をサポートするのは Tauri 版です。Avalonia 版は `NativeWebView` を画面へ埋め込んでおり、Avalonia WebView の Linux 対応対象外です。GTK/WebKitGTK を追加しても Avalonia 版の埋め込みプレビューは動作しません。

以下は Debian/Ubuntu 系を基準にし、コマンドは明記がない限りリポジトリルートで実行します。他 distribution の package 名は [Tauri 公式 prerequisites](https://v2.tauri.app/start/prerequisites/#linux) を参照してください。

## 1. 前提ツール

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

続けて Git、[Node.js LTS](https://nodejs.org/)、[Rust stable](https://www.rust-lang.org/tools/install) を導入します。.NET の restore/build も確認する場合のみ [.NET SDK](https://dotnet.microsoft.com/download) 10.0 以上を導入します。

```bash
git --version
node --version
npm --version
rustc --version
cargo --version
```

## 2. clone と依存復元

```bash
git clone https://github.com/an-embedded-engineer/MarkdownViewer.git
cd MarkdownViewer

cd markdown-viewer-tauri
npm ci
cd ..
```

.NET SDK を導入済みなら Avalonia の package restore と compile 可否は確認できますが、アプリ実行の完了条件にはしません。

```bash
dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
```

## 3. Tauri build

```bash
cd markdown-viewer-tauri
npm run build
cd src-tauri
cargo check
cd ..
```

## 4. Tauri 実行

`markdown-viewer-tauri/` で実行します。

```bash
npm run tauri dev
```

## PlantUML（任意）

`java -version` で Java を確認し、開発時は `markdown-viewer-tauri/src-tauri/`、current working directory、または Rust 実行ファイルの directory に `plantuml.jar` を配置します。jar はコミットしません。設定ファイルを使う場合を含む詳細は [共通 PlantUML 手順](README.md#plantuml任意)を参照してください。

## 5. Tauri bundle

```bash
npm run tauri build
```

成果物は `markdown-viewer-tauri/src-tauri/target/release/bundle/` 以下に生成されます。生成される package 形式は distribution とインストール済みの bundle tool に依存します。

macOS 専用の `scripts/publish_apps_with_plantuml.sh` は Linux では使用しません。PlantUML を配布物に含める場合は、生成された実行ファイルがある runtime directory へ `plantuml.jar` を手動配置してください。

## 6. トラブルシューティング

- `webkit2gtk-4.1` や `appindicator` が見つからない: distribution に対応する Tauri 公式 package 一覧を確認する。
- Wayland で表示問題がある: [Tauri Linux graphics troubleshooting](https://v2.tauri.app/develop/debug/#linux) を確認し、X11 session でも切り分ける。
- Avalonia 版の画面が動かない: 現行設計上の制約です。Linux では Tauri 版を使用してください。
