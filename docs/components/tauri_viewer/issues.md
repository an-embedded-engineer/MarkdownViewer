# Tauri Viewer 既知課題

## 既知課題

- 自動テストが未整備。
- Mermaid bundleが大きく、production buildでchunk size warningが出る。
- asset protocol scopeはMVPのため広めに設定している。
- Tauri buildは `.app` 作成後のDMG作成で失敗する場合がある。Finder実行用 `.app` は生成される。

## 改善候補

- Mermaidのdynamic importまたはdiagram種別ごとの遅延読み込み。
- Rust commandのユニットテスト追加。
- asset protocol scopeの絞り込み。
- DMG作成の安定化と正式署名・notarization対応。
