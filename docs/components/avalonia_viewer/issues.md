# Avalonia Viewer 既知課題

## 既知課題

- 自動テストが未整備。
- publishした `.app` はローカル確認用のad-hoc構成であり、正式な署名・notarizationは未対応。
- PlantUML、全文検索、複数タブ、ファイル監視はMVP対象外。

## 改善候補

- `FileTreeService` と `MarkdownRenderService` のユニットテスト追加。
- WebView表示とリンク遷移の手動確認手順をサンプルドキュメントとセットで固定化する。
