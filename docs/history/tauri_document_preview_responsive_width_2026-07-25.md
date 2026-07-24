# Tauri document preview 横幅の可変化 履歴

## 背景

Tauri版Markdown preview本文には980pxの固定最大幅があり、広いwindowへ拡張しても横長のtable、Mermaid、PlantUML、imageが利用可能なpreview pane幅を使えなかった。

## 採用したアプローチ

- `.markdown-body`の固定980px上限を撤去し、preview pane content boxから通常48px、window viewport 760px以下では28pxを引いた幅へ追従させた。
- table、code、Mermaid、PlantUMLの局所overflowと、image / PlantUML SVGの縮小契約を維持した。
- trusted HTML iframeはpreview pane全幅を使い、HTML文書自身のlayoutとsandbox / protocol / CSP境界を変更しなかった。
- Phase 4-aで見つかったMermaidのリサイズ退行は、`dangerouslySetInnerHTML`値をMarkdown HTML単位で安定化し、内容を変えないReact再描画によるSVG上書きを防いだ。
- 横長contentとMermaid resizeを確認できる`sample_docs/preview_width.md`を追加した。

## 結果

- Markdown本文が980pxで止まらず、利用可能なpreview pane幅へgutterを残して追従するようになった。
- window / Explorer resize後もMermaidがSVG表示を維持し、Theme切替とReloadでは正常に再描画される。
- ユーザー実機確認でresponsive widthとMermaidの4項目がPASSした。
- frontend build / 29 tests、Rust check / 22 tests / format checkが成功した。
- Claude design / implementation reviewはいずれも未解決0件で承認された。

## 参照

- Design analysis: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/`
- Change report: `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/change_report.md`
- Branch: `spec-change/tauri-document-preview-responsive-width`
- Main commits:
  - `3aaa5a2` Phase 0 requirements
  - `3942be4` Phase 2 design
  - `8078b28` Phase 2 design approval
  - `9694e2b` Phase 3 responsive width implementation
  - `d9e8ba2` Phase 3 implementation approval
  - `adc1a49` Phase 4-a Mermaid feedback fix
  - `87d438a` Mermaid fix approval
  - `7b6dee5` Phase 4-a user verification
