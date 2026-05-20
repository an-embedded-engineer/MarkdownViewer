# Avalonia Viewer 詳細設計

## 状態管理

`MainWindowViewModel` がroot path、ファイルツリー、選択ファイル、テーマ、エラー状態を保持する。

## 処理フロー

1. ユーザーがOpen Folderを実行する。
2. StorageProviderでディレクトリを選択する。
3. `FileTreeService` が対象ディレクトリを走査する。
4. ExplorerでMarkdownファイルを選択する。
5. Markdown本文を読み込み、`MarkdownRenderService` がHTML fragmentへ非同期変換する。
6. `HtmlTemplateService` がWebView用HTML文書を生成する。

## Mermaid

Mermaid scriptはHTMLテンプレートに含める。Markdown内の `mermaid` fenced code block は通常コードではなくMermaid用DOMへ変換する。

## PlantUML

Markdown内の `plantuml` / `puml` fenced code block は `MarkdownRenderService` が抽出し、`PlantUmlRenderService` へ描画を委譲する。

`PlantUmlRenderService` は `PlantUmlRuntimeResolver` で `plantuml.jar` を解決し、以下のCLIをshellを介さず引数配列で起動する。

```bash
java -jar <plantuml.jar> -tsvg -pipe
```

PlantUML sourceはstdinへ渡し、stdoutのSVGを `.plantuml-diagram` としてHTML fragmentへ差し替える。stderr、exit code、Java起動不可、jar未設定、timeoutは `.plantuml-error` として該当位置に表示する。1図あたりのtimeoutは10秒で、複数図は順次描画する。

`plantuml.jar` はコミットしない。探索順は現在のworking directory、実行assemblyのbase directoryで、各directoryの `plantuml.config.json`、次に `plantuml.jar` を見る。`plantuml.config.json` の相対 `plantUmlJarPath` はconfig fileのdirectory基準で解決する。

Theme切替時はPlantUML CLIを再実行せず、直近のbody HTMLを保持したまま `HtmlTemplateService` でHTML documentだけを再構築する。

## エラーハンドリング

ファイル読み込み、Markdown変換、WebView表示で失敗した場合はViewModelのエラー状態へ反映し、UIで表示する。
