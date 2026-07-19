あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: research-analysis
review kind: research report review
topic: HTML document viewing support
issue dir: docs/design_analysis/research_analysis/20260719_html_document_viewing_support
review target commit: 0f021b9

以下の調査レポートをレビューしてください。

- docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md
- docs/design_analysis/research_analysis/20260719_html_document_viewing_support/meta.md

必要に応じて、Avalonia / Tauriの現行実装、project docs、依存packageの現行APIを確認してください。

レビュー結果は以下のファイルに作成してください。

- docs/design_analysis/research_analysis/20260719_html_document_viewing_support/html_document_viewing_support_report_review.md

レビュー観点:
- 実装との整合性。
- 根拠の十分性。
- 考慮漏れの有無。
- 結論の飛躍や過剰一般化の有無。
- 次のspec-change workflowへ渡せる粒度になっているか。
- 現在と同じOpen Folder / Explorer操作でHTMLを選択できる設計になっているか。
- root内相対画像、SVG、CSS、JavaScript、font、JSONと、UML / diagramの対応方針が実現可能か。
- Tauriのroot-scoped custom URI protocol + sandboxed iframe + CSP方針がplatform差とsecurity boundaryを適切に扱っているか。
- Avaloniaのfile URI直接Navigate、subresource制御、host bridge制限が実現可能か。
- HTML内`http:` / `https:` linkをembedded WebViewへ表示せず、OS標準ブラウザへ安全に委譲できる方針か。
- Markdown / Mermaid / PlantUMLの既存経路を壊さないか。

レビュー文書には、少なくとも以下を含めてください。

- 総評。
- 指摘一覧（重大度、対象箇所、理由、根拠、推奨対応）。
- 未解決事項。
- 承認可否。

レビュー文書を作成・更新したら、必ずコミットまで実施してください。
