# 開発・実行ルール

## 環境

- macOS arm64 を主な開発環境とする。
- .NET SDK: `10.0+`
- Node.js / npm: Tauri 版の `package-lock.json` と互換のある現行版
- Rust / Cargo: Tauri v2 の依存が要求する stable toolchain
- IDE: Visual Studio Code / Rider / Visual Studio

## セットアップ

```bash
# Avalonia
dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri
cd markdown-viewer-tauri
npm install
```

### PlantUML

PlantUML表示を使う場合はJavaと `plantuml.jar` をローカルに用意する。`plantuml.jar` はコミットしない。

```bash
java -version
```

配置方法は以下のいずれかを使う。

- runtime directory に `plantuml.jar` を置く。
- runtime directory に `plantuml.config.json` を置き、`plantUmlJarPath` にjar pathを記載する。

```json
{
  "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
}
```

runtime directory:

- Avalonia開発実行: コマンド実行時のworking directory、または実行assemblyのdirectory。
- Tauri開発実行: `markdown-viewer-tauri/src-tauri/`、current working directory、Rust実行ファイルのdirectoryの順。
- Tauri macOS bundle: `<app>.app/Contents/MacOS/`。
- publish済みAvalonia: 実行ファイルのdirectory。

2026-05-21時点の開発環境では `openjdk 24.0.2` と PlantUML `1.2026.3` で確認している。

## アプリケーション実行

```bash
# Avalonia
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri
cd markdown-viewer-tauri
npm run tauri dev
```

## ビルド

```bash
# Avalonia
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Avalonia Release
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj -c Release

# Tauri frontend
cd markdown-viewer-tauri
npm run build

# Tauri Rust backend
cd markdown-viewer-tauri/src-tauri
cargo check
```

## Publish

```bash
# Avalonia self-contained publish
dotnet publish Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj \
  -c Release \
  -r osx-arm64 \
  --self-contained true \
  -o publish/avalonia/raw

# Tauri app bundle
cd markdown-viewer-tauri
npm run tauri build
```

Finder から直接起動する `.app` は `publish/` 配下へ配置する。`publish/` は生成物として扱い、原則コミットしない。

## テスト

現時点で専用テストプロジェクトは未整備である。変更時は以下を最低限の検証として扱う。

```bash
# Avalonia compile check
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

# Tauri frontend check
cd markdown-viewer-tauri
npm run build

# Tauri Rust check
cd markdown-viewer-tauri/src-tauri
cargo check
```

UI 動作を変更した場合は、少なくとも以下を手動確認する。

- フォルダ選択
- Explorer から Markdown 選択
- Markdown プレビュー表示
- Mermaid 描画
- Mermaid と PlantUML が同居する `sample_docs/plantuml.md` で両方の図が描画されること
- PlantUML 描画
- PlantUML 描画中に読み込み中表示が出ること
- Light / Dark 切替
- Reload 後の再描画

## 静的解析・整形

```bash
# C# format check
dotnet format Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj --verify-no-changes

# Rust format check
cd markdown-viewer-tauri/src-tauri
cargo fmt -- --check

# Rust format apply
cargo fmt
```

Tauri フロントエンドは現時点で lint script 未定義のため、`npm run build` の TypeScript compile を完了条件に含める。
