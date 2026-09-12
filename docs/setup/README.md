# 環境構築ガイド

## 対応状況

| OS | Avalonia 版 | Tauri 版 | ガイド |
| --- | --- | --- | --- |
| Windows | 開発・実行・publish | 開発・実行・bundle | [windows.md](windows.md) |
| macOS | 開発・実行・publish | 開発・実行・bundle | [macos.md](macos.md) |
| Linux | restore/build のみ。`NativeWebView` のため実行非対応 | 開発・実行・bundle | [linux.md](linux.md) |

## 共通要件

- Git
- Avalonia 版: .NET SDK 10.0 以上
- Tauri 版: Node.js LTS、npm、Rust 1.89以上 / Cargo、OS 固有の Tauri 依存
- PlantUML 表示を使う場合のみ: Java と `plantuml.jar`

各 SDK は公式の配布元からインストールしてください。

- [.NET SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
- [PlantUML downloads](https://plantuml.com/download)

## 共通の依存復元

次のコマンドは clone したリポジトリのルートから開始し、`cd` 後は `markdown-viewer-tauri/` で `npm ci` を実行します。

```text
dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
cd markdown-viewer-tauri
npm ci
```

`npm ci` は `package-lock.json` に固定された依存を再現します。依存パッケージを更新して lock file も変更する場合に限り `npm install` を使います。

## PlantUML（任意）

PlantUML 表示には Java と `plantuml.jar` が必要です。`plantuml.jar` はリポジトリへコミットしません。

```text
java -version
```

開発時は実装ごとに次のいずれかを使用します。

- Avalonia: リポジトリルートから `dotnet run` する場合はリポジトリルート、または実行 assembly の directory に `plantuml.jar` を置く。
- Tauri: `markdown-viewer-tauri/src-tauri/`、Tauri process の current working directory、または Rust 実行ファイルの directory に `plantuml.jar` を置く。
- runtime directory の `plantuml.config.json` から絶対 path を指定する。

```json
{
  "plantUmlJarPath": "/absolute/path/to/plantuml.jar"
}
```

詳細な探索順と publish 時の配置は [開発・実行ルール](../rules/development_workflow.md#plantuml) を参照してください。
