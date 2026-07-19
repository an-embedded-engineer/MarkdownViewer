---
title: "HTML形式仕様書の表示対応に関する影響調査"
created_date: "2026-07-19"
category: research_analysis
components:
  - Avalonia/MarkdownViewer.Avalonia
  - markdown-viewer-tauri
  - docs/components
status: draft
related_commits: []
source_design_path: docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md
---

# HTML形式仕様書の表示対応 調査メタ情報

## Scope

- 調査対象: Avalonia版・Tauri版のファイル探索、読み込み、HTML生成・表示、リンク・画像・Mermaid・JavaScript処理。
- 入力例: self-containedな単一HTML形式仕様書 `user_agent_assets_v2_structure.html`。
- 利用形態: Open Folderで選択したproject rootのExplorerからHTMLを選択し、HTML本体またはroot内相対resourceとして画像・SVG・CSS・JavaScript等を表示する。
- 確認観点: 影響範囲、両実装の変更候補、画像・ダイアグラム、セキュリティ、互換性、テスト観点、推奨実装方針。
- 非対象: 本workflow内でのHTML対応実装、HTML編集機能、外部リソースを多用する一般Webサイトの閲覧対応。

## Expected output

- Markdown表示を維持しつつHTMLとroot内関連resourceを表示する場合の実装差分と制約。
- 次workflowへ渡せる推奨方針、リスク、未解決事項。
