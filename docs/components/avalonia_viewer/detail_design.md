# Avalonia Viewer 詳細設計

## 状態管理

`MainWindowViewModel` がroot path、ファイルツリー、選択ファイル、テーマ、エラー状態を保持する。

## 処理フロー

1. ユーザーがOpen Folderを実行する。
2. StorageProviderでディレクトリを選択する。
3. `FileTreeService` が対象ディレクトリを走査する。
4. ExplorerでMarkdownファイルを選択する。
5. Markdown本文を読み込み、`MarkdownRenderService` がHTML fragmentへ変換する。
6. `HtmlTemplateService` がWebView用HTML文書を生成する。

## Mermaid

Mermaid scriptはHTMLテンプレートに含める。Markdown内の `mermaid` fenced code block は通常コードではなくMermaid用DOMへ変換する。

## エラーハンドリング

ファイル読み込み、Markdown変換、WebView表示で失敗した場合はViewModelのエラー状態へ反映し、UIで表示する。
