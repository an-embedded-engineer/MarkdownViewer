# Tauri Viewer 既知課題

## 既知課題

- component / WebView lifecycleの自動testは限定的で、platform固有sandbox / CSP / IPC境界は実機matrixが必要。
- Mermaid bundleが大きく、production buildでchunk size warningが出る。
- asset protocol scopeはMVPのため広めに設定している。
- Tauri buildは `.app` 作成後のDMG作成で失敗する場合がある。Finder実行用 `.app` は生成される。
- trusted HTML external linkは`navigator.userActivation`のWebView実装差があり、macOS / Windows / Linuxで確認が必要。
- HTML ready handshakeの5秒timeoutは巨大document / 低速disk fixtureで実機確認が必要。

## 改善候補

- Mermaidのdynamic importまたはdiagram種別ごとの遅延読み込み。
- React component / WebView integration testの追加。
- asset protocol scopeの絞り込み。
- DMG作成の安定化と正式署名・notarization対応。
