# Tauri HTML形式仕様書表示対応 履歴

## 背景

Agentや人間が生成したグラフィカルなHTML形式仕様書を、Markdownと同じproject rootから参照したい要求に対応した。HTMLはscriptやrelative resourceを必要とする一方、既存Markdown previewのReact DOMへ混在させると親UIやTauri IPCへ到達し得るため、document typeと実行境界を分離する必要があった。

## 採用したアプローチ

- Explorer、open command、tab stateをMarkdown / HTMLの型付きdocument modelへ一般化した。
- 選択root内のHTMLと許可resourceだけを配信するroot-scoped custom URI protocolをRust側に追加した。
- HTMLはCSP付きsandboxed iframeで表示し、same-origin privilege、form、download、popup、top navigation、外部networkを許可しない構成にした。
- external linkはactive iframe内のtrusted user clickと`http:` / `https:` schemeを検証し、OS標準ブラウザへ委譲した。
- Markdown preview、relative image / link、Mermaid、PlantUML、Multi-tabの既存経路を維持した。

## 結果

- UTF-8 `.html`をExplorerから開き、tab activate / close / Reloadできるようになった。
- inline SVG / Canvasとroot内のCSS、JavaScript、ES module、JSON、画像等をHTML位置基準で参照できるようになった。
- root外resource、未許可resource、external network、危険なnavigationをprotocol、CSP、sandbox、host policyの多層境界で拒否した。
- macOSでHTML / SVG / PNG表示、外部browser委譲、`javascript:` URL拒否、Markdown相対PNG表示を確認した。
- Windows / Linuxを含む残りの実機matrixは後日確認とし、問題が判明した場合は`docs/issues/`で追跡する方針をユーザーが承認した。

## 参照

- Design analysis: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/`
- Change report: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/change_report.md`
- Branch: `spec-change/tauri-html-document-viewing`
- Main commits:
  - `24bcfb5` Phase 0 requirements
  - `88aae68` Phase 2 design
  - `59193e5` Phase 2 design approval
  - `05039bb` Phase 3 implementation
  - `5ac20d0` Phase 3 implementation approval
  - `a9193cf` Phase 4-a user verification
