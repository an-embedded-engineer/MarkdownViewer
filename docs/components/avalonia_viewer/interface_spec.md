# Avalonia Viewer インターフェース仕様

## ユーザー操作

- Open Folder: Markdownルートを選択する。
- Explorer item click: Markdownファイルを選択して表示する。
- Reload: 現在のrootと選択ファイルを再読み込みする。
- Theme switch: Light / Dark を切り替える。

## Service境界

- `FileTreeService`: root pathを受け取り、Explorer表示用ノードを返す。
- `MarkdownRenderService`: Markdown文字列をHTML fragmentへ非同期変換する。
- `PlantUmlRenderService`: PlantUML sourceをSVG HTMLまたはエラーHTMLへ変換する。
- `PlantUmlRuntimeResolver`: `plantuml.config.json` または `plantuml.jar` からPlantUML runtime設定を解決する。
- `HtmlTemplateService`: HTML fragment、base path、themeを受け取りWebView用HTMLを返す。

### `IMarkdownRenderService.RenderToHtmlFragmentAsync`

```csharp
Task<string> RenderToHtmlFragmentAsync(string markdown, CancellationToken cancellationToken)
```

Markdown本文をHTML fragmentへ変換する。`mermaid` fenceはMermaid用DOMへ、`plantuml` / `puml` fenceはPlantUML SVGまたはエラーHTMLへ差し替える。

### `PlantUmlRuntimeOptions`

- `JarPath`: 解決済み `plantuml.jar` path。
- `ConfigPath`: 使用した `plantuml.config.json` path。configを使わない場合は `null`。

## 外部連携

- フォルダ選択はAvalonia StorageProviderを使う。
- 外部URLはOS既定ブラウザで開く。
- PlantUML表示はローカルJava processと `plantuml.jar` を使う。
