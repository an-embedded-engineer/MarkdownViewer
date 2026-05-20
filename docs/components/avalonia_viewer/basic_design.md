# Avalonia Viewer 基本設計

## 基本方針

MVVM構成でUI状態と処理を分離する。Markdown変換やファイル走査はServiceへ寄せ、ViewModelは操作の調停と表示状態の管理に集中する。

## 責務

- View: レイアウト、バインディング、WebViewホスト。
- ViewModel: 選択中root、ファイルツリー、選択Markdown、テーマ、エラー状態。
- Service: ファイル走査、Markdown変換、HTML文書生成。

## 主要クラス

- `MainWindowViewModel`: Open Folder、Reload、Markdown選択、テーマ切替。
- `FileTreeNodeViewModel`: Explorerノード表示と選択状態。
- `FileTreeService`: 除外ディレクトリを考慮した再帰走査。
- `MarkdownRenderService`: MarkdigによるMarkdown HTML化。
- `HtmlTemplateService`: CSS、Mermaid script、リンク処理を含むHTML生成。

## 依存方向

```text
View -> ViewModel -> Services -> Models
```

ViewModelはViewへ依存しない。ServiceはUI状態へ依存しない。
