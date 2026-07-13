# MarkdownViewer Avalonia 版

Avalonia UI、C#、`NativeWebView` で実装した読み取り専用 Markdown Viewer です。プロジェクト全体は [ルート README](../../README.md) を参照してください。

## 対応 OS と要件

- .NET SDK 10.0 以上
- Windows: Microsoft Edge WebView2 Runtime
- macOS: OS 組み込みの WKWebView
- Linux: 現構成の `NativeWebView` は非対応。restore/build は可能でもアプリ実行はサポート対象外
- PlantUML 表示を使う場合: Java と `plantuml.jar`

clone 直後の OS 固有手順:

- [Windows](../../docs/setup/windows.md)
- [macOS](../../docs/setup/macos.md)
- [Linux の制約](../../docs/setup/linux.md)

## 実行

リポジトリルートで実行します。

```text
dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
```

最初の手動確認には `Avalonia/MarkdownViewer.Avalonia/sample_docs/` を開いてください。

## Publish

- [Windows publish](../../docs/setup/windows.md#5-publish--bundle)
- [macOS publish](../../docs/setup/macos.md#5-publish--bundle)
- [共通の開発・publish ルール](../../docs/rules/development_workflow.md#publish)

## 主な機能

- native folder picker からフォルダを開く
- directory、Markdown、画像を Explorer tree に表示
- Markdig による Markdown rendering
- 同梱 `Assets/mermaid.min.js` による Mermaid rendering
- ローカル Java / `plantuml.jar` による PlantUML rendering
- Light / Dark theme 切替
- 相対画像表示、相対 Markdown link のアプリ内遷移
- HTTP/HTTPS link を既定ブラウザで開く
