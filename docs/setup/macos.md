# macOS 環境構築

Terminal を使用し、コマンドは明記がない限りリポジトリルートで実行します。

## 1. 前提ツール

1. Xcode Command Line Tools をインストールする。
2. [.NET SDK](https://dotnet.microsoft.com/download) 10.0 以上をインストールする。
3. [Node.js](https://nodejs.org/) の LTS 版をインストールする。
4. [Rustup](https://www.rust-lang.org/tools/install) で Rust stable / Cargo をインストールする。

```bash
xcode-select --install
```

新しい Terminal を開き、確認します。

```bash
git --version
dotnet --version
node --version
npm --version
rustc --version
cargo --version
```

Tauri desktop 開発では Xcode 全体ではなく Command Line Tools で構いません。詳細は [Tauri 公式 prerequisites](https://v2.tauri.app/start/prerequisites/#macos) を参照してください。Avalonia の `NativeWebView` は OS 組み込みの WKWebView を使用します。

## 2. clone と依存復元

```bash
git clone https://github.com/an-embedded-engineer/MarkdownViewer.git
cd MarkdownViewer

dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
cd markdown-viewer-tauri
npm ci
cd ..
```

## 3. build

```bash
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

cd markdown-viewer-tauri
npm run build
cd src-tauri
cargo check
cd ../..
```

## 4. 実行

```bash
# Avalonia
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri
cd markdown-viewer-tauri
npm run tauri dev
```

## PlantUML（任意）

`java -version` で Java を確認します。Avalonia はリポジトリルートから `dotnet run` する場合はリポジトリルート、Tauri は `markdown-viewer-tauri/src-tauri/`、Tauri process の current working directory、または Rust 実行ファイルの directory に `plantuml.jar` を配置します。jar はコミットしません。設定ファイルを使う場合を含む詳細は [共通 PlantUML 手順](README.md#plantuml任意)を参照してください。次節の統合 publish スクリプトを使うと、jar を両方の `.app` へ配置できます。

## 5. publish / bundle

リポジトリルートに `plantuml.jar` を置いた場合、両実装をまとめて publish できます。このスクリプトは macOS 専用です。

```bash
./scripts/publish_apps_with_plantuml.sh
```

Intel Mac では Avalonia RID を指定します。

```bash
./scripts/publish_apps_with_plantuml.sh --runtime osx-x64
```

jar の場所や Tauri bundle を指定する例:

```bash
./scripts/publish_apps_with_plantuml.sh \
  --plantuml-jar /absolute/path/to/plantuml.jar \
  --tauri-bundles app,dmg
```

スクリプトを `. ./scripts/...` のように source 実行しないでください。出力は `publish/avalonia/` と `publish/tauri/` に生成されます。

PlantUML を含めない個別 build は次のとおりです。

```bash
dotnet publish Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj \
  -c Release -r osx-arm64 --self-contained true \
  -o publish/avalonia/raw

cd markdown-viewer-tauri
npm run tauri -- build --bundles app --ci
```

## 6. トラブルシューティング

- `xcrun`、compiler、linker が見つからない: `xcode-select -p` を確認し、Command Line Tools を再設定する。
- Finder 起動時だけ PlantUML が見つからない: `.app/Contents/MacOS/` に `plantuml.jar` を置くか、統合 publish スクリプトを使う。
- Intel Mac: Avalonia の RID を `osx-x64` にする。Apple Silicon は `osx-arm64` を使う。
