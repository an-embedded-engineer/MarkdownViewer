# Avalonia Viewer インターフェース仕様

## ユーザー操作

- Open Folder: Markdownルートを選択する。
- Explorer item click: Markdownファイルを選択して表示する。
- Reload: 現在のrootと選択ファイルを再読み込みする。
- Theme switch: Light / Dark を切り替える。

## Service境界

- `FileTreeService`: root pathを受け取り、Explorer表示用ノードを返す。
- `MarkdownRenderService`: Markdown文字列をHTML fragmentへ変換する。
- `HtmlTemplateService`: HTML fragment、base path、themeを受け取りWebView用HTMLを返す。

## 外部連携

- フォルダ選択はAvalonia StorageProviderを使う。
- 外部URLはOS既定ブラウザで開く。
