# Avalonia Viewer 既知課題

## 既知課題

- 自動テストが未整備。
- publishした `.app` はローカル確認用のad-hoc構成であり、正式な署名・notarizationは未対応。
- PlantUML、全文検索、複数タブ、ファイル監視はMVP対象外。

## 改善候補

- `FileTreeService` と `MarkdownRenderService` のユニットテスト追加。
- WebView表示とリンク遷移の手動確認手順をサンプルドキュメントとセットで固定化する。

## Planned rolloutの検証課題

- 複数`NativeWebView` hostのmemory、lifecycle、focus、hidden pane描画コストをMulti-tab / Split View設計時に評価する。
- trusted HTMLのnavigation / subresource interception、host bridge制限、root / symlink境界をmacOS / Windows / Linuxで確認する。
- typed user configの保存atomicity、破損JSON / partial field復旧、Unicode / platform pathを確認する。
- Explorer splitterとSplit View separatorのkeyboard / screen reader結果を個別に確認する。
- Tauriのpane-local tab group / pane間移動、上下split、image viewerはAvalonia baselineをブロックせず、最終同期で採否を再評価する。
